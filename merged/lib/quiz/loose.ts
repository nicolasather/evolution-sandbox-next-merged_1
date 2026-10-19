/** Question payloads and answer keys are polymorphic by `kind` (five shapes, plus optional media/scoring/meta) and arrive from JSON, the database and
 *  the network. They are validated at the boundary by the zod schemas in validation.ts; inside rendering/grading helpers they are read structurally.
 *  `Loose` names that deliberate looseness in ONE place instead of scattering `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically shaped, schema-validated JSON (see above)
export type Loose = any;
