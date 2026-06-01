/** Pure text-input editor state: a value plus a cursor offset. Free of Ink so it
 *  can be unit-tested directly; InputBox is a thin wrapper over these operations. */
export interface EditorState {
  value: string;
  cursor: number;
}

export const empty: EditorState = { value: '', cursor: 0 };

export function fromValue(value: string): EditorState {
  return { value, cursor: value.length };
}

export function insert(s: EditorState, text: string): EditorState {
  return {
    value: s.value.slice(0, s.cursor) + text + s.value.slice(s.cursor),
    cursor: s.cursor + text.length,
  };
}

export function backspace(s: EditorState): EditorState {
  if (s.cursor === 0) return s;
  return { value: s.value.slice(0, s.cursor - 1) + s.value.slice(s.cursor), cursor: s.cursor - 1 };
}

export function del(s: EditorState): EditorState {
  if (s.cursor >= s.value.length) return s;
  return { value: s.value.slice(0, s.cursor) + s.value.slice(s.cursor + 1), cursor: s.cursor };
}

export function left(s: EditorState): EditorState {
  return { value: s.value, cursor: Math.max(0, s.cursor - 1) };
}

export function right(s: EditorState): EditorState {
  return { value: s.value, cursor: Math.min(s.value.length, s.cursor + 1) };
}

export function home(s: EditorState): EditorState {
  return { value: s.value, cursor: 0 };
}

export function end(s: EditorState): EditorState {
  return { value: s.value, cursor: s.value.length };
}

const isWS = (c: string | undefined): boolean => c !== undefined && /\s/.test(c);

export function wordLeft(s: EditorState): EditorState {
  let i = s.cursor;
  while (i > 0 && isWS(s.value[i - 1])) i--;
  while (i > 0 && !isWS(s.value[i - 1])) i--;
  return { value: s.value, cursor: i };
}

export function wordRight(s: EditorState): EditorState {
  let i = s.cursor;
  const n = s.value.length;
  while (i < n && isWS(s.value[i])) i++;
  while (i < n && !isWS(s.value[i])) i++;
  return { value: s.value, cursor: i };
}

export function deleteWordLeft(s: EditorState): EditorState {
  const start = wordLeft(s).cursor;
  return { value: s.value.slice(0, start) + s.value.slice(s.cursor), cursor: start };
}

export function killToEnd(s: EditorState): EditorState {
  return { value: s.value.slice(0, s.cursor), cursor: s.cursor };
}

export function clearLine(): EditorState {
  return empty;
}
