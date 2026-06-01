import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeCtx, makeTmpDir } from '../helpers.js';
import { notebookEditTool } from '../../src/tools/notebook.js';

const signal = new AbortController().signal;

function notebook(cells: unknown[]): string {
  return JSON.stringify({ cells, metadata: {}, nbformat: 4, nbformat_minor: 5 });
}

describe('NotebookEdit', () => {
  it('replaces a cell source identified by id', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);
    writeFileSync(
      join(dir, 'n.ipynb'),
      notebook([{ cell_type: 'code', id: 'c1', source: ['old'], outputs: [], execution_count: null, metadata: {} }]),
    );
    ctx.readFiles.add(ctx.sandbox.resolve('n.ipynb', dir));

    const res = await notebookEditTool.run({ notebook_path: 'n.ipynb', cell_id: 'c1', new_source: 'print(1)' }, ctx, signal);
    expect(res.isError).toBeFalsy();
    const saved = JSON.parse(readFileSync(join(dir, 'n.ipynb'), 'utf8'));
    expect(saved.cells[0].source).toEqual(['print(1)']);
  });

  it('requires the notebook to have been Read first', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);
    writeFileSync(join(dir, 'n.ipynb'), notebook([{ cell_type: 'code', id: 'c1', source: ['x'] }]));

    const res = await notebookEditTool.run({ notebook_path: 'n.ipynb', cell_id: 'c1', new_source: 'y' }, ctx, signal);
    expect(res.isError).toBe(true);
    expect(res.output).toMatch(/has not been Read/);
  });

  it('inserts then deletes cells', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);
    writeFileSync(
      join(dir, 'n.ipynb'),
      notebook([{ cell_type: 'code', id: 'c1', source: ['a'], outputs: [], execution_count: null, metadata: {} }]),
    );
    ctx.readFiles.add(ctx.sandbox.resolve('n.ipynb', dir));

    await notebookEditTool.run(
      { notebook_path: 'n.ipynb', cell_id: 'c1', edit_mode: 'insert', cell_type: 'markdown', new_source: '# title' },
      ctx,
      signal,
    );
    let saved = JSON.parse(readFileSync(join(dir, 'n.ipynb'), 'utf8'));
    expect(saved.cells).toHaveLength(2);
    expect(saved.cells[1].cell_type).toBe('markdown');
    expect(saved.cells[1].source).toEqual(['# title']);

    await notebookEditTool.run({ notebook_path: 'n.ipynb', cell_id: 'c1', edit_mode: 'delete' }, ctx, signal);
    saved = JSON.parse(readFileSync(join(dir, 'n.ipynb'), 'utf8'));
    expect(saved.cells).toHaveLength(1);
    expect(saved.cells[0].cell_type).toBe('markdown');
  });

  it('rejects non-notebook paths', async () => {
    const dir = makeTmpDir();
    const ctx = makeCtx(dir);
    writeFileSync(join(dir, 'note.txt'), 'hi');
    ctx.readFiles.add(ctx.sandbox.resolve('note.txt', dir));
    const res = await notebookEditTool.run({ notebook_path: 'note.txt', cell_id: '0', new_source: 'x' }, ctx, signal);
    expect(res.isError).toBe(true);
  });
});
