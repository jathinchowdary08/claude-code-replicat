/** Classify a submitted input line into how it should be handled (pure/testable). */
export type InputMode =
  | { kind: 'empty' }
  | { kind: 'command'; text: string } // /slash command
  | { kind: 'bash'; command: string } // !shell command
  | { kind: 'memory'; note: string } // #note to remember
  | { kind: 'prompt'; text: string }; // ordinary message to the agent

export function classifyInput(raw: string): InputMode {
  if (!raw.trim()) return { kind: 'empty' };
  if (raw.startsWith('/')) return { kind: 'command', text: raw };
  if (raw.startsWith('!')) return { kind: 'bash', command: raw.slice(1).trim() };
  if (raw.startsWith('#')) return { kind: 'memory', note: raw.slice(1).trim() };
  return { kind: 'prompt', text: raw };
}
