/** Registers the Phase 1 core tool set and exposes helpers for subsets. */
import type { Tool } from './types.js';
import { readTool } from './read.js';
import { writeTool } from './write.js';
import { editTool } from './edit.js';
import { bashTool } from './bash.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { lsTool } from './ls.js';
import { todoWriteTool } from './todo.js';
import { taskTool } from './task.js';
import { bashOutputTool } from './bashOutput.js';
import { killShellTool } from './killShell.js';
import { exitPlanModeTool } from './exitPlanMode.js';
import { webFetchTool, webSearchTool } from './web.js';
import { notebookEditTool } from './notebook.js';

export const coreTools: Tool[] = [
  readTool,
  writeTool,
  editTool,
  bashTool,
  globTool,
  grepTool,
  lsTool,
  todoWriteTool,
  taskTool,
  bashOutputTool,
  killShellTool,
  exitPlanModeTool,
  webFetchTool,
  webSearchTool,
  notebookEditTool,
];

/** Tools a subagent may use: read-only, no further fan-out, no plan-mode control. */
export function subagentTools(): Tool[] {
  const allowed = new Set(['Read', 'Glob', 'Grep', 'LS', 'BashOutput']);
  return coreTools.filter((t) => allowed.has(t.name));
}

export * from './types.js';
export * from './registry.js';
export { ShellManager } from './shellManager.js';
