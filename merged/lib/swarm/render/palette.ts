/** Central colour and stroke tokens for every Swarm drawing. Storybook fantasy (rich map edges, props) + toybox arcade (flat chunky actors, dark outlines).
 *  Nothing here is copied from another game; every shape is drawn from primitives in sprites.ts. */
export const INK = '#1D2C35';
export const INK_HC = '#000000';
export const PAPER = '#FFF3DC';
export const PAPER_2 = '#FFFBF1';
export const NAVY = '#27414F';
export const MINT = '#5CBBA0';
export const GOLD = '#FFCD55';
export const CORAL = '#F77765';
export const SKY = '#3C7BD9';
export const PLUM = '#9A6BD8';
export const SAFE = '#3FBF8A';
export const WARN = '#F2602C';
export const STROKE = 3; // logical units at 960×600
export type Theme = { ink: string; stroke: number; hc: boolean; reduced: boolean };
export const theme = (hc: boolean, reduced: boolean): Theme => ({ ink: hc ? INK_HC : INK, stroke: hc ? 4 : STROKE, hc, reduced });
