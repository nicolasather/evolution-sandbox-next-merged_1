/* Mode-exclusive acting, part 2: Decipher (dc-), Alien Archaeology (al-), Reverse Evolution (re-), Minimum Path (mp-) and the main
   bench (me-). Again each clip is something the mode actually has the player do: count glyphs, set a confidence slider, take a phone
   apart down to stone, walk a graph edge by edge, drag a piece off the inventory rail. */
import { ARMS_UP, rep, seq } from './clipdsl';
import { K } from './clipcore';

const sw = (n: number, t0: number, t1: number, f: (a: boolean) => string) => rep(n, t0, t1, i => f(i % 2 === 0));
const CROUCH = 'body.sy.74 body.y3 head.y2';

/* ── DECIPHER: a tablet of unknown glyphs; count them, compare them, anchor on the clue, assign meanings, check ── */
K('dc-study-tablet', 2800, '0=prop.o0|0.2=prop.o1 prop.x4 prop.y-3 head.y1.5 eye.sx1.3|0.45=prop.o1 prop.x4 eye.x-3|0.7=prop.o1 prop.x4 eye.x3 head.r-6|0.9=head.r0|1=prop.o0', { prop: 'slate', fx: ['question'] });
K('dc-trace-glyph', 2400, `0=|0.15=armR.r-90 eye.x2|${sw(5, 0.25, 0.9, a => `armR.r${a ? -105 : -80} eye.x${a ? 3 : 2} eye.y${a ? 1 : -1}`)}|1=`);
K('dc-tally-frequency', 2800, `0=|${sw(6, 0.1, 0.9, a => `armR.r${a ? -50 : -70} head.y${a ? .5 : 0} eye.x${a ? 2 : -2}`)}|0.95=armR.r-100 eye.sy1.4|1=`, { fx: ['question'] });
K('dc-compare-glyphs', 2600, '0=|0.2=armL.r75 armR.r-75 eye.x-3|0.4=armL.r75 armR.r-75 eye.x3|0.6=armL.r75 armR.r-75 eye.x-3 head.r-6|0.8=head.r6 eye.sy1.3|1=', { fx: ['question'] });
K('dc-copy-glyph', 2600, `0=prop.o0|0.12=prop.o1 prop.x4 prop.y-2|${sw(6, 0.2, 0.9, a => `prop.o1 prop.x4 prop.y-2 armR.r${a ? -40 : -66} eye.x${a ? 2 : -2} head.y1`)}|1=prop.o0`, { prop: 'slate' });
K('dc-pick-concept', 2400, `0=|0.15=armR.r-60|${sw(4, 0.25, 0.8, a => `armR.r${a ? -80 : -100} eye.x${a ? -2 : 2} head.r${a ? -6 : 6}`)}|0.9=armR.r-110 eye.sy1.3|1=`, { fx: ['question'] });
K('dc-assign-meaning', 2000, '0=prop.o1 prop.x6 prop.y-12|0.3=armR.r-130|0.45=armR.r-60 prop.y2 body.sy.92|0.65=armR.r-60 body.sy.92 eye.sy1.3|0.9=armR.r-130|1=prop.o0', { prop: 'marker', fx: ['sparkle'] });
K('dc-replace-assignment', 2600, `0=prop.o1 prop.x5 prop.y-3|${sw(5, 0.1, 0.5, a => `armR.r${a ? -40 : -70} prop.o1 prop.x${a ? 4 : 7} head.r${a ? -6 : 6}`)}|0.6=armR.r-130 eye.sy1.3|0.8=armR.r-50 head.y1|1=prop.o0`, { prop: 'marker', fx: ['question'] });
K('dc-context-anchor', 2400, '0=|0.2=armR.r-95 head.r6 eye.x3|0.45=armR.r-100 body.sx1.04 eye.sy1.5|0.7=armR.r-95 head.r-4 eye.x2|1=', { fx: ['exclaim'] });
K('dc-spot-pattern', 2200, `0=|0.2=eye.sx1.5 eye.sy1.5 head.r-8|0.4=armR.r-170 body.sy1.1 head.y-1.5|0.7=armR.r-165|1=`, { fx: ['exclaim', 'sparkle'] });
K('dc-count-dots', 2400, `0=|${sw(4, 0.12, 0.8, a => `armR.r${a ? -60 : -76} head.y${a ? 1 : 0} eye.y2`)}|0.9=armR.r-110 eye.sy1.3 body.sy1.04|1=`);
K('dc-read-line', 2800, '0=|0.15=armR.r-80 eye.x-3 head.r-6|0.4=armR.r-85 eye.x-1|0.65=armR.r-90 eye.x1.5|0.85=armR.r-95 eye.x3 head.r6|1=');
K('dc-hold-breath-check', 2200, '0=|0.3=body.sx1.1 body.sy1.1 eye.sy1.4 armR.r-60|0.65=body.sx1.12 body.sy1.12 armR.r-90|0.8=armR.r-60 body.sx.96|1=', { fx: ['exclaim'] });
K('dc-partial-nod', 2000, `0=|0.2=head.y1.5 head.r5|0.35=head.y-.5|0.5=head.y1.5 head.r5|0.7=armR.r-60 eye.sy.8 head.r-6|1=`, { fx: ['question'] });
K('dc-poor-wince', 2000, '0=|0.15=body.sy.92 head.y1.5 eye.sy.3|0.4=head.r-12 eye.sy.5|0.65=armR.r-165 head.r8|0.9=head.r-4|1=', { fx: ['frown', 'sweat'] });
K('dc-read-aloud-solved', 3000, seq([1, `0=|0.5=armR.r-80 eye.x-3 head.y-1|1=armR.r-85 eye.x3 head.y-1`], [1.3, `0=armR.r-85|0.35=${ARMS_UP} root.y-4 body.sy1.1|0.7=${ARMS_UP} root.y0|1=`]), { fx: ['sparkle', 'smile'] });
K('dc-rotate-tablet', 2400, '0=prop.o1 prop.x4 prop.y-4|0.3=armL.r50 armR.r-50 prop.r90 prop.x4|0.6=prop.r180 head.r-8 eye.x2|0.85=prop.r360 head.r4|1=prop.o0', { prop: 'slate', fx: ['question'] });
K('dc-rubbing', 2600, `0=prop.o1 prop.x4 prop.y2|0.12=body.sy.84 head.y1.5|${sw(8, 0.2, 0.92, a => `body.sy.84 head.y1.5 armR.r${a ? -20 : -45} prop.o1 prop.x${a ? 3 : 6} prop.y2`)}|1=prop.o0`, { prop: 'slate', fx: ['dust'] });
K('dc-tutorial-nod', 2400, '0=|0.2=armR.r-70 head.y1|0.4=armR.r-70 head.y-.5|0.6=armR.r-70 head.y1|0.8=armR.r-40 head.y0|1=', { fx: ['smile'] });
K('dc-peek-answer', 2400, '0=|0.2=eye.x-3 head.r-8 body.sy.94|0.45=eye.x3 eye.sy1.5 head.r10|0.7=eye.sy.5 head.r-6 armR.r-60|0.9=eye.x-3 head.r-8|1=', { fx: ['blush'] });
K('dc-lose-track', 2400, `0=|${sw(6, 0.1, 0.9, a => `head.r${a ? -16 : 16} eye.x${a ? -3 : 3} armR.r${a ? -130 : -60} body.r${a ? -3 : 3}`)}|1=`, { fx: ['swirl', 'question'] });
K('dc-jot-notes', 2400, `0=prop.o0|0.12=prop.o1 prop.x4 prop.y-2 armL.r35|${sw(6, 0.2, 0.9, a => `prop.o1 prop.x4 prop.y-2 armR.r${a ? -32 : -50} head.y1.5 head.r6`)}|1=prop.o0`, { prop: 'slate' });
K('dc-compare-notes', 2600, '0=prop.o1 prop.x5 prop.y-3|0.25=armR.r-70 prop.x7 head.r8|0.55=armR.r-90 eye.x3|0.8=armR.r-60 head.r-4|1=prop.o0', { roles: ['0=prop.o1 prop.x-5 prop.y-3|0.3=armL.r70 prop.x-7 head.r-8|0.6=eye.x-3 eye.sy1.4|0.85=armL.r40|1=prop.o0'], prop: 'slate', fx: ['question'] });

/* ── ALIEN ARCHAEOLOGY: crated specimens, hypotheses on axes, a calibrated confidence slider, a field report ── */
K('al-open-crate', 2600, '0=prop.o1 prop.x5 prop.y1|0.2=body.sy.84 armL.r-30 armR.r30|0.4=armL.r-60 armR.r60 body.r-8 root.x-.4|0.55=body.r8 root.x.4 prop.y-3|0.8=body.sy1.02 eye.sy1.5 armL.r40 armR.r-40|1=prop.o0', { prop: 'item', fx: ['dust'] });
K('al-study-specimen', 2800, '0=prop.o1 prop.x3 prop.y-4|0.25=prop.y-7 head.r-10 eye.sx1.4 eye.sy1.4 armL.r-50 armR.r50|0.5=prop.r60 head.r8|0.75=prop.r-40 eye.sy1.5 body.sy1.05|1=prop.o0', { prop: 'item', fx: ['sparkle'] });
K('al-scan-wand', 2800, `0=prop.o1 prop.x6 prop.y-4|${sw(5, 0.12, 0.9, a => `armR.r${a ? -50 : -100} prop.o1 prop.x${a ? 4 : 9} prop.y-4 eye.x${a ? -2 : 3} head.r${a ? -6 : 6}`)}|1=prop.o0`, { prop: 'marker', fx: ['sparkle'] });
K('al-sniff-sample', 2000, '0=prop.o1 prop.x3 prop.y-4|0.25=prop.y-5 head.y1 eye.sy.4 body.r6|0.45=head.y1.8 eye.sy.2|0.65=head.y1 eye.sy1.5 head.r-10 body.r-4|1=prop.o0', { prop: 'item', fx: ['question'] });
K('al-measure-specimen', 2600, '0=prop.o1 prop.x4 prop.y-3|0.25=armL.r75 armR.r-45 head.r-8|0.5=armL.r55 armR.r-45 eye.x-2|0.75=armL.r75 head.r6 eye.sy1.3|1=prop.o0', { prop: 'item' });
K('al-compare-anatomy', 2600, '0=|0.2=armL.r60 armR.r-60 eye.x-3 head.r-6|0.4=eye.x3 head.r6|0.6=eye.x-3 head.r-8|0.8=eye.sy1.5 armR.r-120|1=', { fx: ['question'] });
K('al-weigh-in-hands', 2400, `0=|0.2=armL.r40 armR.r-40|${sw(4, 0.3, 0.85, a => `armL.r${a ? 60 : 30} armR.r${a ? -30 : -60} head.r${a ? -6 : 6}`)}|1=`, { prop: 'item', fx: ['question'] });
K('al-set-axis-dial', 2600, `0=|0.15=armR.r-70|${sw(4, 0.25, 0.85, a => `armR.r${a ? -50 : -90} body.r${a ? -4 : 5} eye.x${a ? -2 : 2}`)}|0.95=armR.r-110 eye.sy1.3|1=`, { fx: ['question'] });
K('al-confidence-slide-right', 2200, '0=prop.o1 prop.x-4 prop.y-4|0.2=armR.r-70 prop.x-4|0.6=armR.r-80 prop.x8 body.r6|0.85=armR.r-70 prop.x8 eye.sy1.3|1=prop.o0', { prop: 'marker', travel: 0.5 });
K('al-confidence-slide-left', 2200, '0=prop.o1 prop.x8 prop.y-4|0.2=armR.r-70 prop.x8|0.6=armR.r-60 prop.x-4 body.r-6|0.85=armR.r-70 prop.x-4 eye.sy.7|1=prop.o0', { prop: 'marker', travel: -0.5 });
K('al-overconfident-puff', 2400, '0=|0.25=body.sy1.1 body.sx1.12 head.y-1.5 armL.r40 armR.r-40|0.7=body.sy1.14 body.sx1.16 head.y-2 armL.r60 armR.r-60|0.9=body.sy1.05|1=', { fx: ['sparkle'] });
K('al-underconfident-shrink', 2400, '0=|0.3=body.sy.84 body.sx.94 head.y2 eye.x-2 eye.sy.7 armL.r-20 armR.r20|0.8=body.sy.8 body.sx.92 head.y2.5 eye.sy.6|1=', { fx: ['sweat'] });
K('al-calibrate-balance', 2800, `0=|0.2=armL.r70 armR.r-70|${sw(5, 0.3, 0.9, a => `armL.r${a ? 85 : 60} armR.r${a ? -60 : -85} body.r${a ? 4 : -4} head.r${a ? -4 : 4}`)}|0.95=armL.r70 armR.r-70 body.r0|1=`, { fx: ['sparkle'] });
K('al-evidence-clash', 2400, '0=|0.2=armL.r40 armR.r-40 eye.x-3|0.4=armL.r30 armR.r-30 root.x.6 eye.sy1.5|0.6=body.r-10 head.r-14 armL.r90 armR.r-90|0.85=head.r14 eye.sy.7|1=', { fx: ['exclaim', 'question'] });
K('al-model-fit-click', 2000, '0=|0.3=armL.r40 armR.r-40 body.sx1.06|0.5=armL.r15 armR.r-15 body.sx.96 body.sy.94|0.7=body.sy1.06 eye.sy1.4|1=', { fx: ['sparkle', 'smile'] });
K('al-suspect-truth', 2600, '0=|0.2=eye.sy.45 eye.x2 head.r6|0.5=eye.sy.45 eye.x-2 head.r-6 armR.r-60|0.8=eye.sy.45 eye.x2 head.r6|1=', { fx: ['question'] });
K('al-awe-structure', 3000, '0=|0.3=body.sy1.08 eye.sy1.6 eye.y-3 head.y-1.5 head.r-4 armL.r30 armR.r-30|0.9=body.sy1.08 eye.sy1.6 eye.y-3 head.y-1.5 head.r-4 armL.r30 armR.r-30|1=', { fx: ['sparkle'] });
K('al-sketch-xeno-form', 2800, `0=prop.o0|0.12=prop.o1 prop.x4 prop.y-2|${sw(7, 0.2, 0.9, a => `prop.o1 prop.x4 prop.y-2 armR.r${a ? -30 : -75} eye.x${a ? 1 : 3} head.y1.5`)}|1=prop.o0`, { prop: 'slate' });
K('al-listen-to-hum', 2800, `0=|0.25=head.r12 eye.sy.3 body.r4|${sw(4, 0.35, 0.85, a => `head.r12 eye.sy.3 body.r${a ? 5 : 3} tail.r${a ? 12 : -12}`)}|1=`, { fx: ['note'] });
K('al-flinch-from-glow', 1800, '0=|0.12=body.r-12 root.x-2 armL.r120 armR.r-120 eye.sy.1|0.4=armL.r120 armR.r-120 eye.sy.2|0.75=armL.r60 armR.r-60 eye.sy.7|1=', { fx: ['exclaim'] });
K('al-file-field-report', 3000, `0=prop.o0|0.12=prop.o1 prop.x4 prop.y-2 armL.r35 head.y1.5|${sw(8, 0.2, 0.85, a => `prop.o1 prop.x4 prop.y-2 armR.r${a ? -34 : -52} head.y1.5`)}|0.95=armR.r-120 eye.sy1.3|1=prop.o0`, { prop: 'slate' });
K('al-await-verdict', 2600, `0=|0.2=armL.r-30 armR.r30 body.sy.94|${sw(5, 0.3, 0.9, a => `armL.r-30 armR.r30 body.sy.94 legs.y${a ? 0 : -1.2} eye.sy1.3`)}|1=`, { fx: ['sweat'] });
K('al-revise-theory', 2800, `0=prop.o1 prop.x4 prop.y-2|0.2=armR.r-60|${sw(4, 0.25, 0.6, a => `armR.r${a ? -40 : -70} prop.o1 prop.x4 prop.y-2`)}|0.75=armR.r-130 eye.sy1.3 head.y-1|0.9=armR.r-60|1=prop.o0`, { prop: 'slate', fx: ['exclaim'] });
K('al-debate-theory', 2800, `0=|${sw(5, 0.1, 0.9, a => `armR.r${a ? -100 : -60} head.r${a ? 6 : -4} body.r${a ? 3 : -3}`)}|1=`, { roles: [`0=|${sw(5, 0.15, 0.9, a => `armL.r${a ? 60 : 100} head.r${a ? -4 : 6} body.r${a ? -3 : 3}`)}|1=`], fx: ['question'] });

/* ── REVERSE EVOLUTION: take a complex object apart, step by step, down to the raw materials ── */
K('re-ponder-target', 2600, '0=prop.o1 prop.x4 prop.y-5|0.25=head.r-10 eye.sx1.3 armR.r-60|0.5=prop.r30 head.r8|0.8=prop.r-20 eye.sy1.4|1=prop.o0', { prop: 'item', fx: ['question'] });
K('re-hold-up-gadget', 2200, '0=prop.o1 prop.x3 prop.y-4|0.3=armL.r-50 armR.r50 prop.y-8 head.y-1|0.6=prop.y-8 prop.r15 eye.sy1.3|0.9=prop.y-5|1=prop.o0', { prop: 'item' });
K('re-unscrew', 2400, `0=prop.o1 prop.x5 prop.y-3|0.15=armR.r-70|${sw(6, 0.2, 0.9, a => `armR.r${a ? -80 : -60} prop.o1 prop.x5 prop.y-3 prop.r${a ? 30 : 0} head.y1 head.r${a ? 4 : -2}`)}|1=prop.o0`, { prop: 'item' });
K('re-pry-casing', 2400, '0=prop.o1 prop.x5 prop.y1|0.2=body.sy.88 armR.r-50 armL.r-30|0.45=body.r8 armR.r-90 body.sy.84|0.6=body.r-6 prop.sx1.2 root.x-.8|0.85=eye.sy1.4 body.sy.98|1=prop.o0', { prop: 'item', fx: ['exclaim'] });
K('re-peel-layer', 2400, `0=prop.o1 prop.x5 prop.y-3|${sw(4, 0.15, 0.8, a => `armR.r${a ? -50 : -100} body.r${a ? 4 : -6} prop.o1 prop.x5 prop.y-3`)}|0.92=head.y1.5 eye.sy1.3|1=prop.o0`, { prop: 'item' });
K('re-pull-component', 2400, '0=prop.o1 prop.x7 prop.y-3|0.2=armR.r-60 body.r-6|0.45=armR.r-30 body.r-12 prop.x3|0.7=prop.x0 prop.y-6 armR.r-60 body.r0 eye.sy1.4|1=prop.o0', { prop: 'item', fx: ['sparkle'] });
K('re-examine-circuit', 2600, '0=prop.o1 prop.x4 prop.y-4|0.2=head.y1.5 head.r-10 eye.sx1.5 eye.sy1.5|0.5=armR.r-80 eye.x-2|0.75=armR.r-90 eye.x2|1=prop.o0', { prop: 'marker', fx: ['question'] });
K('re-ask-what-made-this', 2400, '0=|0.2=armR.r-130 head.r-10 eye.y-2|0.5=armR.r-130 head.r-10 head.y1|0.75=armR.r-165 eye.sy1.4|1=', { fx: ['question'] });
K('re-tap-option', 1800, '0=|0.2=armR.r-60 root.x1|0.4=armR.r-80 body.r3|0.5=armR.r-55|0.7=armR.r-60|1=');
K('re-pick-several', 2600, `0=|${sw(6, 0.1, 0.9, a => `armR.r${a ? -75 : -55} armL.r${a ? 20 : 55} head.r${a ? 4 : -4} eye.x${a ? 2 : -2}`)}|1=`, { fx: ['question'] });
K('re-submit-answer', 2200, '0=|0.2=body.sx1.06 armR.r-60|0.45=armR.r-100 body.sy.94|0.7=armR.r-60 eye.sy1.4|1=', { fx: ['exclaim'] });
K('re-correct-drop-down', 2400, `0=|0.2=armR.r-90 body.sy1.06|0.4=armR.r-60 head.y1.5 head.r5|0.6=head.y-.5|0.8=armR.r-90 eye.y2 eye.sy1.2|1=`, { fx: ['sparkle', 'smile'] });
K('re-wrong-reassemble', 2800, `0=prop.o1 prop.x5 prop.y-3|0.2=eye.sy1.5 body.r-8|${sw(4, 0.3, 0.8, a => `armR.r${a ? -90 : -40} prop.o1 prop.x5 prop.y-3 prop.r${a ? -30 : 20} body.r${a ? -4 : 4}`)}|0.92=head.y1.5 eye.sy.6|1=prop.o0`, { prop: 'item', fx: ['frown', 'question'] });
K('re-show-me', 2200, '0=|0.25=armL.r60 armR.r-60 body.sy.96 head.r6|0.55=armL.r60 armR.r-60 head.r-6|0.85=armL.r50 armR.r-50|1=', { fx: ['question'] });
K('re-descend-tree', 2600, `0=|${sw(5, 0.1, 0.95, a => `root.y${a ? 0 : -1} legs.r${a ? 16 : -16} body.sy${a ? .94 : 1} armL.r${a ? 90 : 30} armR.r${a ? -30 : -90}`)}|1=`, { travel: 1.4 });
K('re-expand-node', 2200, '0=|0.25=armL.r30 armR.r-30|0.5=armL.r100 armR.r-100 body.sx1.08 eye.sy1.3|0.75=armL.r100 armR.r-100|1=', { fx: ['sparkle'] });
K('re-trace-line-down', 2600, `0=|0.15=armR.r-60 eye.y-1|${sw(5, 0.2, 0.9, a => `armR.r${-60 + (a ? 0 : 1) * 12} eye.y${a ? 1 : 2} head.y${a ? .5 : 1}`)}|0.95=armR.r-30 eye.y2|1=`);
K('re-reach-raw-material', 3000, seq([1, `0=prop.o1 prop.x4 prop.y-3|0.5=prop.y-6 eye.sy1.5 armR.r-70|1=prop.y-6 eye.sy1.5 armR.r-70`], [1.4, `0=armR.r-70 prop.o1 prop.y-6|0.3=${ARMS_UP} prop.y-16 root.y-4|0.7=${ARMS_UP} prop.y-16 root.y0|1=prop.o0`]), { prop: 'item', fx: ['sparkle'] });
K('re-smelt-mime', 2800, `0=|0.2=armL.r-30 armR.r30 eye.sy.7|${sw(4, 0.3, 0.9, a => `armL.r${a ? -50 : -20} armR.r${a ? 20 : 50} eye.sy.7 body.sy${a ? .94 : 1}`)}|1=`, { fx: ['sparkle', 'sweat'] });
K('re-grind-mime', 2600, `0=|0.15=${CROUCH}|${sw(8, 0.2, 0.9, a => `${CROUCH} armR.r${a ? -10 : 30} armL.r${a ? -30 : 10}`)}|1=`, { fx: ['dust'] });
K('re-count-chain-depth', 2600, `0=|${sw(5, 0.12, 0.85, a => `armR.r${a ? -50 : -70} eye.y${a ? 1 : 2.5} head.y${a ? 0 : .8}`)}|0.92=armR.r-110 eye.sy1.3|1=`);
K('re-complete-bow', 2600, '0=|0.3=armL.r40 armR.r-40 body.sy1.04|0.55=body.r22 body.y2 head.r18|0.8=body.r22 body.y2|0.95=body.r0|1=', { fx: ['sparkle', 'smile'] });
K('re-pass-component', 2400, '0=prop.o1 prop.y-3|0.3=armR.r-70 prop.x6|0.55=prop.x10|0.6=prop.o0|1=', { roles: ['0=prop.o0|0.55=armL.r70 prop.o1 prop.x-10 prop.y-3|0.8=prop.o1 prop.x-3 prop.y-4 head.y1.5 eye.sx1.3|1=prop.o0'], prop: 'item' });

/* ── MINIMUM PATH: a graph of discoveries; choose each next node, count steps, backtrack, compare with the shortest route ── */
K('mp-read-map', 2600, '0=prop.o0|0.2=prop.o1 prop.x4 prop.y-2 armL.r40 armR.r-40|0.4=prop.o1 prop.x4 eye.x-3|0.65=prop.o1 prop.x4 eye.x3 head.r6|0.9=eye.sy1.3|1=prop.o0', { prop: 'map', fx: ['question'] });
K('mp-plant-start-flag', 2200, '0=prop.o1 prop.x-5 prop.y-4|0.25=armL.r-40 body.sy.86|0.45=prop.y2 armL.r-60|0.7=body.sy1 armL.r-30|1=prop.o0', { prop: 'marker', fx: ['sparkle'] });
K('mp-plant-target-flag', 2200, '0=prop.o1 prop.x5 prop.y-4|0.25=armR.r-40 body.sy.86|0.45=prop.y2 armR.r-60|0.7=body.sy1 armR.r-30 eye.sy1.3|1=prop.o0', { prop: 'marker', fx: ['sparkle'] });
K('mp-count-edges', 2600, `0=|${sw(6, 0.1, 0.85, a => `armR.r${-40 - (a ? 0 : 1) * 0} armR.r${a ? -60 : -80} head.y${a ? 0 : .6} eye.x${a ? 1 : 3}`)}|0.95=armR.r-120 eye.sy1.4|1=`);
K('mp-step-to-node', 1200, '0=|0.15=body.sy.86|0.5=root.y-6 root.x2.4 body.sy1.1|0.85=root.y0 root.x3 body.sy.9|1=', { travel: 0.6 });
K('mp-weigh-neighbours', 2600, '0=|0.2=armL.r90 armR.r-90 eye.x-3 head.r-8|0.4=eye.x0 head.r0|0.6=eye.x3 head.r8|0.8=armR.r-110 eye.sy1.4 head.r4|1=', { fx: ['question'] });
K('mp-walk-the-edge', 2200, `0=|0.1=armL.r75 armR.r-75|${sw(5, 0.15, 0.9, a => `legs.r${a ? 16 : -16} armL.r75 armR.r-75 body.r${a ? 3 : -3}`)}|1=`, { travel: 2 });
K('mp-dead-end', 2400, `0=|${sw(3, 0.05, 0.4, a => `legs.r${a ? 14 : -14} body.r3`)}|0.5=root.x1.4 body.sx.7 eye.sy1.5|0.62=root.x-1 body.sx1.1 body.r-8|0.85=head.r10 eye.sy.7 armR.r-130|1=`, { fx: ['exclaim', 'question'] });
K('mp-backtrack-step', 2000, `0=|0.2=body.r-6 head.r-8 eye.x-2|${sw(3, 0.3, 0.85, a => `legs.r${a ? -14 : 14} body.y${a ? -1 : 0} head.r-8 eye.x-2`)}|0.95=armR.r-60 head.r6|1=`, { travel: -1.2, fx: ['question'] });
K('mp-detour-groan', 2200, '0=|0.2=body.sy.92 head.y2 head.r-8 eye.sy.5|0.45=armL.r-20 armR.r20 body.sy.9|0.75=head.y2.5 head.r-10|1=', { fx: ['frown', 'sweat'] });
K('mp-spot-shortcut', 2200, '0=|0.15=eye.sx1.5 eye.sy1.5 eye.x3|0.35=armR.r-100 body.sy1.08 root.x1|0.6=armR.r-100 eye.sy1.3|1=', { fx: ['exclaim', 'sparkle'] });
K('mp-compare-lengths', 2600, `0=|0.2=armL.r60 armR.r-60|0.4=armL.r80 armR.r-40 head.r-8|0.6=armL.r40 armR.r-80 head.r8|0.85=armL.r60 armR.r-60 eye.sy1.3|1=`, { fx: ['question'] });
K('mp-optimal-flourish', 3000, seq([1, `0=|0.5=armR.r-130 body.sy1.06|1=armR.r-130 body.sy1.06`], [1.3, `0=armR.r-130|0.3=${ARMS_UP} root.y-6|0.6=${ARMS_UP} root.y0 body.sy.94|1=`]), { fx: ['sparkle', 'smile'] });
K('mp-reached-but-long', 2400, '0=|0.2=armL.r30 armR.r-30 body.sy.96|0.5=head.y1 head.r4 eye.sy.7|0.8=armR.r-60 head.r-4|1=', { fx: ['smile'] });
K('mp-squint-at-hint', 2400, '0=|0.2=eye.sy.4 head.y1.5 head.r-8|0.5=eye.sy.3 eye.x3 armR.r-90|0.8=eye.sy1.4 armR.r-100 body.sy1.04|1=', { fx: ['exclaim'] });
K('mp-compare-with-solution', 2800, '0=|0.2=armL.r70 armR.r-70 eye.x-3 head.r-6|0.45=eye.x3 head.r6|0.7=eye.x-3 head.r-6|0.9=armR.r-120 eye.sy1.4|1=', { prop: 'map', fx: ['question', 'sparkle'] });
K('mp-path-limit-warning', 2000, `0=|0.15=eye.sy1.5 armL.r40 armR.r-40|${sw(4, 0.2, 0.85, a => `armR.r${a ? -150 : -120} eye.sy1.5 body.r${a ? -3 : 3}`)}|1=`, { fx: ['exclaim'] });
K('mp-flip-chapter-page', 2200, '0=prop.o1 prop.x4 prop.y-3|0.3=armR.r-70 prop.r0|0.55=armR.r-40 prop.r25 prop.x6|0.8=prop.r-5 head.r4 eye.x2|1=prop.o0', { prop: 'map' });
K('mp-browse-missions', 2600, `0=|${sw(5, 0.1, 0.9, a => `armR.r${a ? -80 : -100} eye.x${a ? -3 : 3} head.r${a ? -6 : 6}`)}|1=`, { fx: ['question'] });
K('mp-trace-path-finger', 2800, `0=|0.15=armR.r-70 eye.x-3|${sw(6, 0.2, 0.9, a => `armR.r${a ? -90 : -65} eye.x${a ? -1 : 2} eye.y${a ? -1 : 1}`)}|0.95=armR.r-100 eye.x3|1=`);
K('mp-export-save', 2400, '0=prop.o1 prop.x4 prop.y-3|0.25=armR.r-60 armL.r40|0.5=prop.x8 prop.y-5 armR.r-80|0.8=prop.o0 armR.r-40|1=', { prop: 'slate' });
K('mp-wave-the-flag', 2600, `0=prop.o1 prop.x6 prop.y-8|0.1=armR.r-140|${sw(6, 0.15, 0.9, a => `armR.r${a ? -150 : -120} prop.o1 prop.x${a ? 5 : 8} prop.y-12 prop.r${a ? -20 : 20} body.r${a ? 3 : -3}`)}|1=prop.o0`, { prop: 'marker', fx: ['sparkle'] });
K('mp-race-to-flag', 2400, `0=|${sw(6, 0.1, 0.9, a => `legs.r${a ? 26 : -26} body.r6 body.y${a ? -2 : 0} armL.r${a ? 50 : 10} armR.r${a ? -10 : -50}`)}|1=`, { travel: 3.2, roles: [`0=|${sw(6, 0.15, 0.95, a => `legs.r${a ? -26 : 26} body.r8 body.y${a ? 0 : -2} armL.r${a ? 10 : 50} armR.r${a ? -50 : -10}`)}|1=`], fx: ['laugh'] });

/* ── MAIN EVOLUTION'S BENCH: the inventory rail, the techniques, the exhibit drawer, the hint, the graph, the question in the corner ── */
K('me-browse-inventory', 2600, `0=|${sw(5, 0.1, 0.9, a => `armR.r${a ? -90 : -110} eye.y${a ? 1 : 2.5} eye.x${a ? -3 : -2} head.r${a ? -6 : -3}`)}|1=`);
K('me-drag-from-rail', 2200, '0=prop.o0|0.15=armR.r-80 eye.x-3|0.3=prop.o1 prop.x-8 prop.y-3 armR.r-70|0.7=prop.o1 prop.x6 prop.y-4 armR.r-80 root.x1.2|0.9=prop.o0 armR.r-50|1=', { prop: 'item', travel: 0.8 });
K('me-drop-on-bench', 1800, '0=prop.o1 prop.x4 prop.y-6|0.3=armR.r-60 prop.y-2|0.5=prop.y3 body.sy.94|0.7=prop.o0 body.sy1.02 eye.sy1.3|1=', { prop: 'item', fx: ['sparkle'] });
K('me-filter-search', 2400, `0=|0.12=armR.r-50|${sw(5, 0.2, 0.8, a => `armR.r${a ? -34 : -52} head.y1 eye.y${a ? -2 : -1}`)}|0.92=armR.r-110 eye.sy1.3|1=`);
K('me-pick-technique', 2200, '0=|0.15=armR.r-70 eye.x3|0.35=armR.r-90 body.r4 eye.sy1.3|0.55=armR.r-90 head.r-4|0.8=armR.r-60|1=', { fx: ['sparkle'] });
K('me-smash-stone', 2400, `0=prop.o1 prop.x7 prop.y2|${sw(6, 0.12, 0.88, a => `armR.r${a ? -160 : -40} body.r${a ? -8 : 12} body.sy${a ? 1.06 : .9}`)}|1=prop.o0`, { prop: 'item', fx: ['dust'] });
K('me-brush-surface', 2400, `0=prop.o1 prop.x5 prop.y1|0.12=body.sy.88|${sw(8, 0.2, 0.9, a => `body.sy.88 armR.r${a ? -60 : -35} prop.o1 prop.x${a ? 7 : 3} prop.y1`)}|1=prop.o0`, { prop: 'brush', fx: ['dust'] });
K('me-separate-pieces', 2200, '0=prop.o1 prop.x0 prop.y-4|0.25=armL.r-30 armR.r30|0.5=armL.r70 armR.r-70 prop.x0 prop.sx1.4|0.75=armL.r90 armR.r-90 eye.sy1.3|1=prop.o0', { prop: 'proxy' });
K('me-pull-fibre', 2400, '0=prop.o1 prop.x-3 prop.y-3|0.25=armL.r-40 armR.r40 body.r-4|0.55=armL.r-70 armR.r70 body.r-10 prop.sx1.8|0.75=prop.sx2.2 root.x-.6|0.9=body.r0|1=prop.o0', { prop: 'proxy' });
K('me-open-exhibit', 2400, '0=|0.2=armR.r-80 head.y1|0.45=armR.r-90 eye.sy1.4|0.7=head.r-6 eye.y2 armL.r35|1=', { prop: 'slate', fx: ['sparkle'] });
K('me-read-hint-line', 2200, '0=|0.2=head.y1 eye.y2.5 eye.x-2|0.5=eye.x2|0.8=armR.r-120 eye.sy1.4 head.y0|1=', { fx: ['exclaim'] });
K('me-scrub-timeline', 2600, `0=|0.15=armR.r-70|${sw(5, 0.2, 0.9, a => `armR.r-70 armR.x${a ? 0 : 1} root.x${a ? 0 : .6} eye.x${a ? -2 : 3}`)}|1=`);
K('me-follow-graph-edge', 2600, `0=|0.15=armR.r-80 eye.x-3|${sw(5, 0.2, 0.9, a => `armR.r${a ? -90 : -75} eye.x${a ? -1 : 2.5} eye.y${a ? -1.5 : 1}`)}|1=`);
K('me-new-discovery-reveal', 3200, seq([1, `0=prop.o1 prop.y-4|0.5=prop.y-8 eye.sy1.5 armL.r40 armR.r-40 body.sy1.06|1=prop.y-8 eye.sy1.5`], [1.4, `0=prop.o1 prop.y-8|0.3=${ARMS_UP} prop.y-16 root.y-5|0.7=${ARMS_UP} prop.y-16 root.y0|1=prop.o0`]), { prop: 'item', fx: ['sparkle', 'exclaim'] });
K('me-answer-corner-question', 2400, '0=|0.2=armR.r-130 head.r-8|0.45=armR.r-130 head.r8 eye.x2|0.7=armR.r-90 eye.sy1.3|1=', { fx: ['question'] });
K('me-wait-for-bench-physics', 2600, `0=|${sw(5, 0.15, 0.85, a => `eye.x${a ? -3 : 3} eye.y${a ? 1 : 2} head.r${a ? -6 : 6}`)}|1=`);
