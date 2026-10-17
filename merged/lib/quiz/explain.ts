/** Turn a Zod issue into a sentence a quiz author can act on. Shared by the editor (pre-flight) and the API. */
const FIELD: Record<string, string> = {
  prompt: 'the question text', basePoints: 'base points', title: 'the quiz title', options: 'an option', statements: 'a statement',
  left: 'a left item', right: 'a right item', accepted: 'an accepted answer', columns: 'a column heading', rows: 'a table cell', cells: 'a blank-cell answer',
  text: 'text', label: 'text',
};
export function explainIssue(issue: { path: (string | number)[]; message: string; code?: string }): string {
  const { path, message, code } = issue;
  const qi = path[0] === 'questions' && typeof path[1] === 'number' ? (path[1] as number) : -1;
  const rest = qi >= 0 ? path.slice(2) : path;
  const named = rest.find((p) => typeof p === 'string' && FIELD[p]) as string | undefined;
  const idx = rest.find((p) => typeof p === 'number') as number | undefined;
  const empty = code === 'too_small' && /at least 1 character|Required/i.test(message) || /Required/.test(message);
  const field = named ? `${FIELD[named]}${idx !== undefined ? ` #${idx + 1}` : ''}` : '';
  const body = empty && field ? `${field} is empty` : message.startsWith('String must contain') && field ? `${field} is empty` : field && code && code !== 'custom' ? `${field}: ${message}` : message;
  return qi >= 0 ? `Question ${qi + 1}: ${body}` : body;
}
