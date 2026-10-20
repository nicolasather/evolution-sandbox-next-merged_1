import type { StoredQuestion } from '../../quiz/public';
import type { Sql } from './store';
import { fixtureQuestions } from './fixtures';

export interface QuizSource { load(): Promise<StoredQuestion[]> }
export class FixtureSource implements QuizSource { constructor(private n = 40) {} async load() { return fixtureQuestions(this.n); } }
/** The room's own copy of the quiz (rooms/room_questions are created by the existing create_room flow, so edits to the source quiz never change a live match). */
export class PgSource implements QuizSource {
  constructor(private sql: Sql, private roomId: string) {}
  async load(): Promise<StoredQuestion[]> {
    const r = await this.sql.query<{ id: string; position: number; kind: string; prompt: string; payload: Record<string, unknown>; answer_key: Record<string, unknown>; base_points: number }>(
      'select id, position, kind, prompt, payload, answer_key, base_points from room_questions where room_id = $1 order by position', [this.roomId]);
    return r.rows.map((x) => ({ id: x.id, position: Number(x.position), kind: x.kind, prompt: x.prompt, payload: x.payload, answer_key: x.answer_key, base_points: Number(x.base_points) }));
  }
}
