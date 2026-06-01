/**
 * NotebookEdit — edit a Jupyter (.ipynb) notebook cell: replace its source,
 * insert a new cell, or delete a cell. The notebook must have been Read first
 * (same safety rule as Edit/Write). Writes are atomic.
 */
import { z } from 'zod';
import { readFile, stat } from 'node:fs/promises';
import { relative } from 'node:path';
import { randomBytes } from 'node:crypto';
import { atomicWrite } from '../util/fs.js';
import { errorResult, textResult, type Tool } from './types.js';

const schema = z.object({
  notebook_path: z.string().describe('Path to the .ipynb notebook (absolute or relative to the cwd).'),
  new_source: z.string().optional().describe('The new cell source (required for replace and insert).'),
  cell_id: z
    .string()
    .optional()
    .describe("Target cell: its notebook id, or its 0-based index as a string (e.g. '2')."),
  cell_type: z.enum(['code', 'markdown']).optional().describe('Cell type for insert, or to convert on replace.'),
  edit_mode: z.enum(['replace', 'insert', 'delete']).optional().describe('Defaults to replace.'),
});

type Input = z.infer<typeof schema>;

interface NbCell {
  cell_type: string;
  source: string | string[];
  metadata?: unknown;
  outputs?: unknown[];
  execution_count?: unknown;
  id?: string;
  [k: string]: unknown;
}

interface Notebook {
  cells: NbCell[];
  [k: string]: unknown;
}

/** Split text into nbformat source lines (each line keeps its trailing newline). */
function toSourceLines(text: string): string[] {
  const parts = text.split('\n');
  const lines = parts.map((l, i) => (i < parts.length - 1 ? `${l}\n` : l));
  // Drop a trailing empty fragment produced by a final newline.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function newId(): string {
  return randomBytes(4).toString('hex');
}

function findIndex(cells: NbCell[], cellId: string | undefined): number {
  if (cellId === undefined) return -1;
  const byId = cells.findIndex((c) => c.id === cellId);
  if (byId >= 0) return byId;
  if (/^\d+$/.test(cellId)) {
    const n = Number(cellId);
    if (n >= 0 && n < cells.length) return n;
  }
  return -1;
}

export const notebookEditTool: Tool<Input> = {
  name: 'NotebookEdit',
  schema,
  readOnly: false,
  description: [
    'Edit a Jupyter notebook (.ipynb) cell. `edit_mode` is replace (default), insert, or',
    'delete. For replace/insert provide `new_source`; identify the cell with `cell_id`',
    '(its id, or its 0-based index). Insert places a new cell after `cell_id` (or at the',
    'end). The notebook must have been Read first.',
  ].join(' '),
  prompt: (i) => `Edit notebook ${i.notebook_path}`,
  async run(input, ctx) {
    const abs = ctx.sandbox.resolve(input.notebook_path, ctx.cwd);
    const rel = relative(ctx.cwd, abs) || abs;
    if (!abs.toLowerCase().endsWith('.ipynb')) {
      return errorResult('NotebookEdit only works on .ipynb files.');
    }
    const st = await stat(abs).catch(() => null);
    if (!st) return errorResult(`Notebook not found: ${input.notebook_path}`);
    if (!ctx.readFiles.has(abs)) {
      return errorResult(`Notebook ${rel} has not been Read yet. Read it before editing.`);
    }

    let nb: Notebook;
    try {
      nb = JSON.parse(await readFile(abs, 'utf8')) as Notebook;
    } catch {
      return errorResult(`Could not parse ${rel} as JSON.`);
    }
    if (!Array.isArray(nb.cells)) return errorResult(`Invalid notebook ${rel}: missing "cells" array.`);

    const mode = input.edit_mode ?? 'replace';

    if (mode === 'delete') {
      const idx = findIndex(nb.cells, input.cell_id);
      if (idx < 0) return errorResult(`Cell not found: ${input.cell_id ?? '(none provided)'}`);
      nb.cells.splice(idx, 1);
      await atomicWrite(abs, `${JSON.stringify(nb, null, 1)}\n`);
      return textResult(`Deleted cell ${input.cell_id} from ${rel}.`, { title: `NotebookEdit ${rel} (delete)` });
    }

    if (input.new_source === undefined) {
      return errorResult('new_source is required for replace and insert.');
    }
    const source = toSourceLines(input.new_source);

    if (mode === 'insert') {
      const cellType = input.cell_type ?? 'code';
      const cell: NbCell =
        cellType === 'code'
          ? { cell_type: 'code', id: newId(), metadata: {}, source, outputs: [], execution_count: null }
          : { cell_type: 'markdown', id: newId(), metadata: {}, source };
      const idx = findIndex(nb.cells, input.cell_id);
      const at = idx >= 0 ? idx + 1 : nb.cells.length;
      nb.cells.splice(at, 0, cell);
      await atomicWrite(abs, `${JSON.stringify(nb, null, 1)}\n`);
      return textResult(`Inserted a ${cellType} cell into ${rel}.`, { title: `NotebookEdit ${rel} (insert)` });
    }

    // replace
    const idx = findIndex(nb.cells, input.cell_id);
    if (idx < 0) {
      return errorResult(`Cell not found: ${input.cell_id ?? '(none provided)'}. Provide cell_id (id or index).`);
    }
    const cell = nb.cells[idx]!;
    cell.source = source;
    if (input.cell_type && input.cell_type !== cell.cell_type) {
      cell.cell_type = input.cell_type;
      if (input.cell_type === 'code') {
        cell.outputs = (cell.outputs as unknown[]) ?? [];
        cell.execution_count = cell.execution_count ?? null;
      } else {
        delete cell.outputs;
        delete cell.execution_count;
      }
    }
    await atomicWrite(abs, `${JSON.stringify(nb, null, 1)}\n`);
    return textResult(`Updated cell ${input.cell_id} in ${rel}.`, { title: `NotebookEdit ${rel} (replace)` });
  },
};
