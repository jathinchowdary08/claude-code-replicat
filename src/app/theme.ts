/**
 * Central palette and glyphs for the TUI. Components import from here instead of
 * hardcoding colors/markers, so the look stays consistent and easy to retune.
 *
 * Only text-presentation glyphs are used (e.g. `●`, not the emoji-default `⏺`),
 * so `color=` is always respected by the terminal.
 */

export const colors = {
  accent: '#d97757', // Claude orange
  dim: 'gray',
  user: 'gray',
  assistant: 'white',
  tool: 'gray',
  error: 'red',
  success: 'green',
  warning: 'yellow',
  info: 'cyan',
} as const;

export const glyphs = {
  assistant: '●',
  user: '>',
  toolResult: '⎿',
  modeArrow: '⏵⏵',
  bullet: '•',
  selected: '❯',
  todoPending: '○',
  todoActive: '▶',
  todoDone: '✔',
} as const;

export type ColorName = (typeof colors)[keyof typeof colors];
