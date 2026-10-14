import type { CreativeProvider, DecideInput, DecideOutput } from '../types';

/* Ticket 075 — deterministic fake. Counts calls so tests can prove "zero provider calls" for nonsense. */

let SEQ = 0;
export type FakeScript = (input: DecideInput) => unknown;

export class FakeProvider implements CreativeProvider {
  readonly name = 'fake';
  calls = 0;
  constructor(private script: FakeScript = () => ({ schemaVersion: 1, decision: 'none', reasonCodes: ['NO_CAUSAL_MECHANISM'] })) {}
  async decide(input: DecideInput): Promise<DecideOutput> {
    this.calls++;
    return {
      decision: this.script(input),
      meta: { provider: 'fake', modelId: 'fake-model-1', promptVersion: input.promptVersion, requestId: `fake-${++SEQ}`, inputTokens: 100, outputTokens: 20, costUsd: 0 },
    };
  }
}
