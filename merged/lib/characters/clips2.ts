/* The animation library, part 2: the 137 clips that complete the requested 215-animation list (see library.ts for the numbering).
   Same pose DSL, same retargeting. Small line-drawn effect marks (tears, stars, zzz, thought bubbles…) come from the `fx` option. */
import { ARMS_OUT, ARMS_UP, hop, rep, seq, steps } from './clipdsl';
import { K } from './clipcore';

const osc = (n: number, t0: number, t1: number, f: (up: boolean) => string) => rep(n, t0, t1, i => f(i % 2 === 0));

/* ── 1 basic movement ──────────────────────────────────────────────── */
K('move-walk', 1400, `0=|${steps(4, 1.2, 2, 14)}|1=`, { travel: 2.2 });
K('move-sprint', 600, `0=|${steps(5, 2.2, 8, 30, 'body.r6 head.y-.8 armL.r-30 armR.r30')}|1=`, { travel: 4.2 });
K('move-hop', 1000, seq([1, hop(4)], [1, hop(5)], [1, hop(4)]), { travel: 2 });
K('move-skip', 1500, `0=|${rep(6, 0.05, 0.95, i => `root.y${i % 2 ? 0 : -4} legs.r${i % 2 ? -26 : 26} armL.r${i % 2 ? 90 : 20} armR.r${i % 2 ? -20 : -90} head.r${i % 2 ? 6 : -6}`)}|1=`, { travel: 2.6, fx: ['smile'] });
K('move-slide', 1000, '0=|0.15=body.r-8 legs.r-30|0.5=body.r-14 legs.r-40 armL.r50 armR.r-50 root.x1.5|0.85=body.r-6 legs.r-20|1=', { travel: 2.6 });
K('move-crawl', 1800, `0=|0.1=body.sy.55 body.y3|${rep(6, 0.15, 0.9, i => `body.sy.55 body.y3 legs.r${i % 2 ? -22 : 22} armL.r${i % 2 ? 40 : -10} armR.r${i % 2 ? 10 : -40}`)}|1=`, { travel: 1.6 });
K('move-float', 2600, '0=|0.2=root.y-6 legs.sy.55 tail.r10|0.45=root.y-8 legs.sy.5 tail.r-12 body.r2|0.7=root.y-6.5 legs.sy.55 tail.r10 body.r-2|0.9=root.y-1|1=');

/* ── 2 emotional reactions ─────────────────────────────────────────── */
K('emote-celebrate-wild', 2800, seq([1, hop(14, ARMS_UP)], [1, hop(10, ARMS_UP)], [1.2, `0=|0.4=root.r360 root.y-6 ${ARMS_UP}|0.8=root.r720 root.y0|1=root.r720`]), { fx: ['sparkle'] });
K('emote-dance-happy', 2600, `0=|${rep(8, 0.05, 0.95, i => `root.x${i % 2 ? -1.6 : 1.6} root.y${i % 2 ? 0 : -2.5} body.r${i % 2 ? -9 : 9} head.r${i % 2 ? 8 : -8} armL.r${i % 2 ? 110 : 30} armR.r${i % 2 ? -30 : -110} tail.r${i % 2 ? 18 : -18}`)}|1=`, { fx: ['note'] });
K('emote-bounce-excited', 1500, `0=|${rep(6, 0.05, 0.95, i => `root.y${i % 2 ? 0 : -7} body.sy${i % 2 ? .82 : 1.14} armL.r${i % 2 ? 40 : 120} armR.r${i % 2 ? -40 : -120} eye.sy1.3`)}|1=`, { fx: ['sparkle'] });
K('emote-laugh', 1800, `0=|0.1=head.r-12 head.y-1|${rep(8, 0.15, 0.9, i => `body.sy${i % 2 ? .94 : 1.05} head.r-12 head.y-1 eye.sy.35 armL.r30 armR.r-30`)}|1=`, { fx: ['laugh'] });
K('emote-smile', 1600, '0=|0.25=head.y-.6 eye.sy.45 body.sy1.03|0.8=head.y-.6 eye.sy.45 body.sy1.03|1=', { fx: ['smile'] });
K('emote-thumbs-up', 1500, '0=|0.25=armR.r-75 head.y1 body.r3|0.4=armR.r-85 head.y-.5|0.55=armR.r-75 head.y1|0.85=armR.r-75|1=', { fx: ['smile'] });
K('emote-blush', 1800, '0=|0.25=head.r10 head.y1 eye.x-2 eye.sy.7 armL.r40 armR.r-40|0.8=head.r10 head.y1 eye.x-2 eye.sy.7 armL.r40 armR.r-40|1=', { fx: ['blush'] });
K('emote-scratch-head', 1800, `0=|0.2=armR.r-165 head.r-8|${osc(5, 0.3, 0.85, up => `armR.r${up ? -158 : -172} head.r-8`)}|1=`, { fx: ['question'] });
K('emote-shocked', 1400, `0=|0.12=body.sy1.14 eye.sy1.6 eye.sx1.3 ${ARMS_UP} root.y-3|0.5=body.sy1.1 eye.sy1.6 ${ARMS_UP} root.y-1.5|0.85=body.sy1.05 eye.sy1.4|1=`, { fx: ['exclaim'] });
K('emote-jump-surprise', 1000, hop(10, `${ARMS_UP} eye.sy1.6`), { fx: ['exclaim'] });
K('emote-cry', 2400, `0=|0.2=head.y2.5 head.r-8 body.sy.94|${rep(8, 0.25, 0.9, i => `head.y2.5 head.r-8 body.sy.94 body.x${i % 2 ? .3 : -.3} armL.r30 armR.r-30`)}|1=`, { fx: ['tears'] });
K('emote-pout', 1800, '0=|0.3=head.y1.5 head.r6 body.sx.96 armL.r-30 armR.r30 eye.sy.7|0.8=head.y1.5 head.r6 body.sx.96 armL.r-30 armR.r30 eye.sy.7|1=', { fx: ['frown'] });
K('emote-angry', 1800, `0=|0.15=body.sy.9 body.sx1.06|${rep(6, 0.2, 0.9, i => `body.sy.9 body.sx1.06 root.x${i % 2 ? -.5 : .5} legs.y${i % 2 ? 0 : -1.5} armL.r30 armR.r-30 eye.sy.55`)}|1=`, { fx: ['anger'] });
K('emote-roll-eyes', 1400, `0=|${rep(6, 0.1, 0.9, i => ['eye.x3 eye.y0', 'eye.x2 eye.y-3', 'eye.x0 eye.y-3.5', 'eye.x-2 eye.y-3', 'eye.x-3 eye.y0', 'eye.x0 eye.y2'][i] + ' head.r5')}|1=`);
K('emote-fall-asleep', 2800, '0=|0.25=head.y1 eye.sy.5|0.45=head.y2.5 head.r8 eye.sy.2 body.sy.96|0.6=head.y.5 eye.sy.6|0.8=head.y3 head.r12 eye.sy.08 body.sy.9|1=', { fx: ['zzz'] });
K('emote-wake-up', 1200, '0=head.y3 head.r12 eye.sy.08 body.sy.9|0.2=root.y-5 body.sy1.12 eye.sy1.5 armL.r60 armR.r-60|0.55=root.y0 body.sy.94 eye.sy1.2|0.8=eye.sy.6|1=', { fx: ['exclaim'] });

/* ── 3 silly animations ────────────────────────────────────────────── */
K('silly-spin-out-of-control', 1800, `0=|0.25=root.r360 root.x1.5|0.5=root.r720 root.x-1.5|0.75=root.r1080 root.x1|0.9=root.r1160 root.x0 body.r-8|1=root.r1080`, { fx: ['swirl'] });
K('silly-slip-fall', 1600, '0=|0.2=legs.r-34 body.r-14 armL.r90 armR.r-90|0.4=root.r-70 root.y-3 armL.r120 armR.r-120|0.6=root.r-92 root.y3|0.8=root.r-92 root.y3|0.95=root.r-30 root.y1|1=');
K('silly-bounce-off-ground', 1300, '0=root.y-16|0.25=root.y0 body.sy.7 body.sx1.18|0.45=root.y-9 body.sy1.14|0.62=root.y0 body.sy.85|0.78=root.y-4|0.9=root.y0 body.sy.94|1=');
K('silly-stuck-upside-down', 3000, `0=|0.15=root.r180 root.y1|${rep(8, 0.25, 0.9, i => `root.r180 root.y1 legs.r${i % 2 ? -28 : 28} armL.r${i % 2 ? 110 : 50} armR.r${i % 2 ? -50 : -110}`)}|0.95=root.r90|1=`, { fx: ['sweat'], solid: true });
K('silly-walk-into-wall', 1600, `0=|${steps(3, 1, 2, 14, '')}|0.62=root.x2 body.sx.7 head.y.5|0.72=root.x-2.5 body.sx1.1 body.r-12|0.9=root.x-1 body.r-4|1=`, { fx: ['exclaim'] });
K('silly-hit-head', 1300, '0=|0.15=root.y-3 head.y-2|0.3=head.y3 head.sy.7 body.sy.9|0.5=head.y2 head.r10|0.8=armR.r-165 head.r8|1=', { fx: ['stars'] });
K('silly-dizzy', 2400, `0=|${rep(8, 0.1, 0.9, i => `root.x${i % 2 ? -2 : 2} body.r${i % 2 ? -10 : 10} head.r${i % 2 ? 14 : -14} eye.x${i % 2 ? -2 : 2}`)}|1=`, { fx: ['swirl'] });
K('silly-see-stars', 2000, '0=|0.15=head.y1.5 body.sy.94|0.3=head.y1.5 fx.r120|0.6=head.y1.5 fx.r240|0.85=head.y1 fx.r360|1=fx.r360', { fx: ['stars'] });
K('silly-shake-head', 1000, `0=|${rep(10, 0.05, 0.95, i => `head.r${i % 2 ? -26 : 26}`)}|1=`);
K('silly-front-flip', 1000, '0=|0.12=body.sy.84|0.4=root.y-12 root.r170|0.7=root.y-8 root.r300|0.88=root.y0 root.r360 body.sy.9|1=root.r360');
K('silly-backflip-fail', 1800, '0=|0.15=body.sy.78 root.r-6|0.4=root.y-11 root.r-150|0.6=root.y-3 root.r-250 armL.r120 armR.r-120|0.72=root.y2 root.r-300|0.85=root.y3 root.r-270 body.sy.8|1=root.r-360', { fx: ['stars'], solid: true });
K('silly-roll-across', 1600, '0=|0.2=root.r180 body.sy.8|0.6=root.r540|0.9=root.r700 body.sy.9|1=root.r720', { travel: 3.4 });
K('silly-fake-faint', 2200, '0=|0.15=armR.r-160 head.r-10|0.35=body.r-12 head.r-18 eye.sy.3|0.6=root.r-92 root.y3 eye.sy.1|0.8=root.r-92 root.y3 eye.sy.5 eye.x2|0.92=root.r-92 root.y3 eye.sy.1|1=root.r-92 root.y3', { solid: true });
K('silly-collapse', 2000, '0=|0.2=body.sy.8 armL.r-20 armR.r20|0.4=body.sy.62 body.y2 head.y3|0.65=root.r-90 root.y3|0.9=root.r-92 root.y3 armL.r40|1=root.r-92 root.y3', { solid: true });
K('silly-freeze-statue', 2600, `0=|0.15=armL.r80 armR.r-120 body.r-4 eye.sy1.3|0.9=armL.r80 armR.r-120 body.r-4 eye.sy1.3|1=`);
K('silly-funny-faces', 2200, `0=|0.15=eye.sx1.6 eye.sy.3 head.r-12|0.35=eye.sy1.6 eye.sx.7 head.r12 head.y1|0.55=eye.x3 eye.sy.5 head.r-6|0.75=eye.sx1.8 eye.sy1.8 head.y-1|1=`, { fx: ['laugh'] });
K('silly-dance-terribly', 2600, `0=|${rep(10, 0.04, 0.96, i => `root.x${[-2, 2, -1, 3, -3, 1, -2, 2, 0, 3][i]} root.y${[-1, -4, 0, -3, -1, -5, 0, -2, -3, 0][i]} body.r${[12, -9, 6, -14, 10, -4, 15, -11, 5, -8][i]} armL.r${[100, 20, 140, 40, 90, 160, 30, 120, 60, 110][i]} armR.r${[-30, -120, -60, -150, -20, -100, -140, -40, -90, -50][i]} legs.r${i % 2 ? -22 : 22}`)}|1=`, { fx: ['note'] });
K('silly-celebrate-early', 2800, seq([1, hop(12, ARMS_UP)], [.6, '0=armL.r150 armR.r-150|0.5=eye.sy1.4 head.r8 armL.r150 armR.r-150|1=eye.sy1.4'], [.9, '0=|0.3=armL.r40 armR.r-40 body.sy.9 eye.x-2 head.r-10|0.8=armL.r40 armR.r-40 body.sy.9 head.r-10|1='], [.4, '0=|1=']), { fx: ['blush'] });

/* ── 4 item interactions ───────────────────────────────────────────── */
K('item-carry-oversized', 2400, `0=prop.o1 prop.sx1.9 prop.sy1.9 prop.y-5|${steps(4, 1.2, 4, 12, 'body.sy.88 prop.o1 prop.sx1.9 prop.sy1.9 prop.y-5 armL.r-40 armR.r40')}|1=prop.o1 prop.sx1.9 prop.sy1.9 prop.y-5`, { travel: 2, prop: 'item', fx: ['sweat'] });
K('item-drag', 2200, `0=prop.o1 prop.x-10 prop.y2|${steps(4, .6, -6, 18, 'prop.o1 prop.x-10 prop.y2 body.r-12 body.sy.92 armR.r-50')}|1=prop.o1 prop.x-10 prop.y2`, { travel: 2.4, prop: 'item' });
K('item-toss-up', 1500, '0=prop.o1 prop.y-3|0.2=armR.r-40 prop.y-2|0.4=armR.r-100 prop.y-16 eye.y-3|0.62=prop.y-22 eye.y-3|0.8=prop.y-4 armR.r-60 eye.y1|1=prop.o0', { prop: 'item' });
K('item-drop-accident', 1400, '0=prop.o1 prop.y-4|0.25=armR.r-20 prop.y-3 head.r-6|0.45=prop.y3 prop.o1 eye.sy1.5 armL.r60 armR.r-60|0.65=prop.y3 prop.o0|1=', { prop: 'item', fx: ['exclaim'] });
K('item-kick', 1300, '0=prop.o1 prop.x7 prop.y2|0.25=legs.r-30 body.r-6|0.4=legs.r40 body.r8 prop.x9|0.6=prop.x22 prop.y-6 legs.r10|0.85=prop.o0|1=', { prop: 'item' });
K('item-push', 1800, `0=prop.o1 prop.x7 prop.y1|0.15=body.r10 armL.r-30 armR.r30|${rep(5, 0.25, 0.9, i => `body.r12 armL.r-30 armR.r30 legs.r${i % 2 ? -14 : 14} prop.o1 prop.x${8 + i * 1.5} prop.y1`)}|1=prop.o0`, { travel: 0.8, prop: 'item' });
K('item-pull', 1800, `0=prop.o1 prop.x8 prop.y1|0.15=body.r-12 armL.r40 armR.r-40|${rep(5, 0.25, 0.9, i => `body.r-14 armL.r40 armR.r-40 legs.r${i % 2 ? -14 : 14} prop.o1 prop.x${8 - i * 1.4} prop.y1`)}|1=prop.o0`, { travel: -0.6, prop: 'item' });
K('item-taste', 1800, '0=prop.o1 prop.y-4|0.25=armR.r-110 prop.x2 prop.y-12 head.y-1|0.45=head.y1.5 eye.sy.3|0.65=head.r-12 eye.sy1.3 body.sy.96|1=prop.o0', { prop: 'item', fx: ['question'] });
K('item-hit', 1400, '0=prop.o1 prop.x7 prop.y2|0.2=armR.r-165|0.35=armR.r-60 body.r10 prop.y3|0.55=armR.r-165|0.7=armR.r-60 body.r10|1=prop.o0', { prop: 'item' });
K('item-hug', 2000, '0=prop.o1 prop.y-4|0.3=prop.y0 prop.x0 armL.r60 armR.r-60 body.sx1.08 head.r8|0.8=prop.y0 armL.r70 armR.r-70 body.sx1.1 head.r8|1=prop.o0', { prop: 'item', fx: ['hearts'] });
K('item-sleep-on', 3000, '0=prop.o1 prop.y3|0.3=prop.y3 root.y-3 body.sy.8 head.y2|0.5=prop.y3 root.y-3 body.sy.78 head.y3 head.r10 eye.sy.08|0.9=prop.y3 root.y-3 body.sy.78 head.y3 head.r10 eye.sy.08|1=prop.o0', { prop: 'item', fx: ['zzz'] });
K('item-hide-behind-back', 1800, '0=prop.o1 prop.x4 prop.y-3|0.25=prop.x-6 prop.y-2 eye.x-3 eye.y-2 head.r-8|0.8=prop.x-6 prop.y-2 eye.sy.55 head.r-8|1=prop.o0', { prop: 'item' });
K('item-return-stolen', 2200, '0=prop.o1 prop.x-5 prop.y-2|0.3=eye.x-3 head.r-8 body.sy.94|0.6=prop.x6 prop.y-3 armR.r-60 head.r-8|0.8=prop.x8 prop.y2 armR.r-35|1=prop.o0', { prop: 'item', fx: ['blush'] });
K('item-present', 1800, '0=prop.o0|0.25=prop.o1 prop.x5 prop.y-4 armL.r-50 armR.r50 body.r4|0.55=prop.o1 prop.x7 prop.y-5 body.r12 head.y1|0.85=prop.o1 prop.x7 prop.y-5 body.r12|1=prop.o0', { prop: 'item', fx: ['sparkle'] });

/* ── 5 crafting and merging ────────────────────────────────────────── */
K('craft-point-two', 1800, '0=|0.2=armL.r92 eye.x-3 head.r-8|0.45=armL.r92 eye.x-3|0.55=armR.r-92 eye.x3 head.r8|0.8=armR.r-92 eye.x3|1=');
K('craft-pick-first', 1400, '0=|0.3=body.sy.7 body.y3 armL.r-20 prop.o1 prop.x-5 prop.y2|0.7=body.sy.98 prop.o1 prop.x-5 prop.y-3 armL.r-60|1=prop.o1 prop.x-5 prop.y-3', { prop: 'item', solid: true });
K('craft-pick-second', 1400, '0=prop.o1 prop.x-5 prop.y-3|0.3=body.sy.7 body.y3 armR.r20 prop.o1 prop.x-5 prop.y-3|0.7=body.sy.98 prop.o1 prop.x5 prop.y-3 armR.r-60|1=prop.o1 prop.x5 prop.y-3', { prop: 'item', solid: true });
K('craft-carry-both', 2400, `0=prop.o1 prop.y-4|${steps(4, 1.2, 3, 12, 'prop.o1 prop.y-4 prop.x0 armL.r-50 armR.r50 body.sy.96')}|1=prop.o1 prop.y-4`, { travel: 2, prop: 'item' });
K('craft-bring-together', 1800, `0=prop.o1 prop.x-9 prop.y-4|0.3=armL.r70 armR.r-70 prop.x-8|0.7=armL.r25 armR.r-25 prop.x-1 body.sx1.04|0.9=prop.x0 body.sx1.06|1=prop.o1 prop.x0`, { prop: 'proxy' });
K('craft-combine', 2000, '0=prop.o1 prop.x0 prop.y-4|0.25=armL.r-25 armR.r25 body.sy.94|0.45=prop.sx1.3 prop.sy1.3 body.sy.9|0.65=prop.sx.9 prop.sy.9 body.sy1.08 armL.r60 armR.r-60|1=prop.o0', { prop: 'proxy', fx: ['sparkle'] });
K('craft-push-together', 1800, `0=prop.o1 prop.x-8 prop.y1|${rep(4, 0.2, 0.85, i => `body.r12 armL.r-34 armR.r34 prop.o1 prop.x${-8 + i * 2.4} prop.y1 legs.r${i % 2 ? -12 : 12}`)}|1=prop.o0`, { travel: 0.6, prop: 'proxy' });
K('craft-struggle-heavy', 2600, `0=prop.o1 prop.y3|0.1=body.sy.82 armL.r-30 armR.r30|${rep(8, 0.15, 0.9, i => `body.sy.8 body.x${i % 2 ? .5 : -.5} armL.r-30 armR.r30 head.r${i % 2 ? 6 : -6} prop.o1 prop.y3 root.y${i % 2 ? 0 : -.6}`)}|1=prop.o0`, { prop: 'item', fx: ['sweat'] });
K('craft-merge-success', 2000, seq([1, '0=prop.o1 prop.y-4|0.5=armL.r-25 armR.r25 body.sy.9 prop.sx1.3 prop.sy1.3|1=prop.o0'], [1.1, hop(11, ARMS_UP)]), { prop: 'proxy', fx: ['sparkle'] });
K('craft-merge-fail', 1800, '0=prop.o1 prop.y-4|0.3=prop.y2 body.sy.9 head.y2 armL.r-5 armR.r5|0.7=body.sy.9 head.y2.5 head.r-8 eye.sy.55|1=prop.o0', { prop: 'proxy', fx: ['frown'] });
K('craft-fail-scratch', 2000, seq([1, '0=|0.4=body.sy.9 head.y2 eye.sy.55|1=body.sy.9 head.y2 eye.sy.55'], [1, `0=body.sy.9 head.y2|0.2=armR.r-165 head.r-8 body.sy1|${osc(4, 0.3, 0.85, up => `armR.r${up ? -158 : -172} head.r-8`)}|1=`]), { fx: ['question'] });
K('craft-select-random', 2200, `0=|${rep(6, 0.08, 0.9, i => `eye.x${[-3, 3, -2, 3, 0, 2][i]} eye.y${[1, 1, -1, 1, 2, -2][i]} head.r${[-8, 8, -6, 8, 0, 6][i]} armR.r${[-80, -95, -70, -100, -85, -105][i]}`)}|0.95=armR.r-110 eye.sy1.3|1=`, { fx: ['question'] });
K('craft-swap-secret', 2000, '0=prop.o1 prop.x-5 prop.y-3|0.2=eye.x-3 head.r-8 eye.y-2|0.4=armR.r-60 prop.x0|0.52=prop.x5 armR.r-20|0.6=eye.x3 head.r8|0.85=eye.sy.55 head.r-6|1=prop.o0', { prop: 'proxy' });
K('craft-put-back', 1600, '0=prop.o1 prop.y-4|0.35=body.sy.9 prop.y1 armR.r-30 head.y1.4|0.6=prop.y2.5 prop.x-4|0.85=body.sy.98 prop.o0|1=', { prop: 'item' });
K('craft-search-backpack', 2400, `0=|0.2=body.sy.82 body.r-8 armL.r-10 armR.r20|${rep(6, 0.3, 0.85, i => `body.sy.82 body.r-8 armL.r${i % 2 ? -25 : 0} armR.r${i % 2 ? 10 : 35} head.r${i % 2 ? -6 : -12} eye.x-2`)}|1=`, { fx: ['question'] });
K('craft-pretend-understand', 2400, '0=|0.2=body.sy1.04 armR.r-130 head.r-8|0.4=head.y1.5 armR.r-130|0.55=head.y-.5 eye.sy1.4 armR.r-165|0.8=head.y1 head.r-6 armR.r-60 body.sy1.06|1=', { fx: ['question'] });

/* ── 6 character-to-character (role 0 acts, the others respond, on one shared timeline) ── */
K('pal-wave-at', 1800, '0=|0.15=armR.r-130|0.3=armR.r-152|0.45=armR.r-120|0.6=armR.r-152|0.85=armR.r-60|1=', { roles: ['0=|0.45=eye.x-3 head.r-6|0.6=armL.r130|0.75=armL.r150|0.9=armL.r80|1='], fx: ['smile'] });
K('pal-greet', 1900, '0=|0.25=body.r14 head.r10|0.55=body.r14 head.r10|0.8=body.r2|1=', { roles: ['0=|0.35=body.r-6 head.r-10 eye.x-2|0.6=body.r12 head.r8|0.9=body.r2|1='], fx: ['smile'] });
K('pal-point-fingers', 2000, `0=|${rep(6, 0.1, 0.9, i => `armR.r${i % 2 ? -100 : -88} head.r${i % 2 ? 8 : 4} body.r${i % 2 ? 4 : 0} eye.sy.7`)}|1=`, { roles: [`0=|${rep(6, 0.1, 0.9, i => `armL.r${i % 2 ? 88 : 100} head.r${i % 2 ? -4 : -8} body.r${i % 2 ? 0 : -4} eye.sy.7`)}|1=`], fx: ['anger'] });
K('pal-push', 1800, '0=|0.25=body.r12 armL.r-30 armR.r30 root.x1|0.45=body.r16 root.x2.4|0.8=body.r4 root.x1.2|1=', { roles: ['0=|0.4=body.r-4|0.5=root.x-3 body.r-18 armL.r110 armR.r-110|0.85=root.x-2 body.r-6|1='] });
K('pal-play-punch', 1500, '0=|0.2=armR.r-150|0.38=armR.r-70 root.x1.6 body.r8|0.6=armR.r-40|1=', { roles: ['0=|0.35=eye.sy.6|0.45=body.sx.88 root.x-1.4 head.r12|0.7=body.sx1 head.r-4|1='], fx: ['laugh'] });
K('pal-chase', 2600, `0=|${steps(6, 2, 6, 26, 'armR.r-60')}|1=`, { travel: 3.4, roles: [`0=|${steps(6, 2.4, 8, 30, 'eye.x-3 head.r-10')}|1=`], fx: ['laugh'] });
K('pal-run-away', 1800, `0=|${steps(5, 2.2, 8, 30, 'eye.sy1.5 armL.r40 armR.r-40')}|1=`, { travel: 3.4, roles: [`0=|0.3=eye.sy.7 armR.r-100|${steps(4, 1.4, 4, 16, 'armR.r-100 head.r6')}|1=`], fx: ['exclaim'] });
K('pal-brawl', 3000, `0=|${rep(10, 0.05, 0.95, i => `root.x${i % 2 ? .5 : 1.5} body.r${i % 2 ? -12 : 12} armL.r${i % 2 ? 20 : 110} armR.r${i % 2 ? -110 : -20} legs.r${i % 2 ? 14 : -14}`)}|1=`, { roles: [`0=|${rep(10, 0.05, 0.95, i => `root.x${i % 2 ? -.5 : -1.5} body.r${i % 2 ? 12 : -12} armL.r${i % 2 ? 110 : 20} armR.r${i % 2 ? -20 : -110} legs.r${i % 2 ? -14 : 14}`)}|1=`], fx: ['dust'] });
K('pal-fall-after-hit', 1800, '0=|0.2=armR.r-150|0.35=armR.r-60 root.x1.4 body.r8|0.7=armR.r-30|1=', { roles: ['0=|0.35=body.r-6|0.45=root.x-4 root.r-60 root.y-3|0.7=root.x-5 root.r-92 root.y3|0.9=root.x-5 root.r-92 root.y3|1=root.x0'], fx: ['stars'], solid: true });
K('pal-steal', 1800, '0=|0.2=eye.x2 body.sy.9|0.45=armR.r-80 root.x2.2|0.6=armR.r-30 root.x0 prop.o1 prop.y-3|0.85=eye.sy.55 head.r-6|1=prop.o0', { prop: 'item', roles: ['0=prop.o1 prop.x5 prop.y-3|0.3=head.r6|0.5=eye.sy1.5 armR.r-50 prop.o0|0.75=armL.r40 head.r-8 eye.sy1.5|1='] });
K('pal-carry', 2600, '0=|0.25=body.sy.88 armL.r-30 armR.r30|0.5=body.sy.9 legs.r14|0.8=body.sy.9 legs.r-14|1=', { travel: 1.4, roles: ['0=root.y0|0.3=root.y-12 root.x.4 armL.r60 armR.r-60|0.8=root.y-12 root.x.4 head.r8|1=root.y0'], fx: ['laugh'] });
K('pal-throw', 2000, '0=|0.25=body.sy.88 armL.r-30 armR.r30|0.45=armL.r140 armR.r-140 root.x.4 body.r-8|0.7=armL.r40 armR.r-40|1=', { roles: ['0=|0.3=root.y-10 root.x.4|0.5=root.y-18 root.x5 root.r180|0.75=root.y-6 root.x9 root.r360|0.9=root.y1 root.x10 root.r380 body.sy.85|1=root.x0'], solid: true });
K('pal-laugh-at', 2200, `0=|0.1=head.r-12 head.y-1|${rep(8, 0.15, 0.9, i => `body.sy${i % 2 ? .94 : 1.05} head.r-12 head.y-1 eye.sy.35 armR.r-60`)}|1=`, { roles: ['0=|0.3=head.y2 eye.x-3 body.sy.94|0.8=head.y2 eye.x-3 body.sy.94 armL.r40 armR.r-40|1='], fx: ['laugh'] });
K('pal-sleep-beside', 3200, '0=|0.3=root.r-88 root.y3 eye.sy.1|0.9=root.r-88 root.y3 eye.sy.1|1=root.r-88 root.y3', { roles: ['0=|0.35=root.r88 root.y3 eye.sy.1|0.9=root.r88 root.y3 eye.sy.1|1=root.r88 root.y3'], fx: ['zzz'], solid: true });
K('pal-hide-behind', 2000, '0=|0.3=root.x-1.2 body.sy.7 head.y3 eye.sy1.3|0.6=head.y2 eye.x3 eye.sy1.5|0.9=body.sy.72 head.y3|1=', { roles: ['0=|0.4=body.sy1.05 head.r-8 eye.x-2|0.7=body.sx1.06 armL.r40 armR.r-40 eye.sy.7|1='], fx: ['question'] });
K('pal-sneak-around', 2600, '0=|0.15=body.sy.8 head.y1.5|0.4=root.x3 body.sy.8 head.y1.5|0.6=root.x2 root.y-2 body.sy.8|0.8=root.x-2 body.sy.8|1=', { roles: ['0=|0.5=eye.x2 head.r4|0.75=eye.x-2 head.r-4|1='], fx: ['dust'] });

/* ── 7 screen and player ──────────────────────────────────────────── */
K('screen-disappear', 1200, '0=|0.3=body.sy1.12 root.o1|0.55=body.sx.2 body.sy.2 root.o0|1=root.o0', { solid: true });
K('screen-teleport', 1600, '0=|0.2=body.sy1.3 body.sx.7 root.o1|0.4=body.sy.1 body.sx2 root.o0|0.6=body.sy.1 body.sx2 root.o0|0.8=body.sy1.2 body.sx.8 root.o1|1=', { fx: ['sparkle'], solid: true });
K('screen-enter-right', 1700, `0=root.x9 root.o0|0.1=root.o1|${steps(4, 1.2, 2, 14, '')}|1=`, { solid: true });
K('screen-leap-in', 1400, '0=root.x6 root.y-30 root.o0|0.15=root.o1|0.55=root.x2 root.y-8 root.r-180|0.8=root.x0 root.y0 root.r-360 body.sy.8|1=root.r-360', { solid: true });
K('screen-point-at-player', 1600, '0=|0.2=armR.r-18 armR.sy1.35 eye.sy1.3 head.y1 body.r4|0.8=armR.r-18 armR.sy1.35 eye.sy1.3 head.y1 body.r4|1=', { fx: ['exclaim'] });
K('screen-wave-player', 1800, `0=|0.2=armR.r-130 eye.sy1.2|${rep(6, 0.25, 0.8, i => `armR.r${i % 2 ? -156 : -118} eye.sy1.2 head.r${i % 2 ? 4 : -4}`)}|1=`, { fx: ['smile'] });
K('screen-click-react', 900, '0=|0.15=body.sy.88 eye.sy.3|0.4=root.y-3 body.sy1.08 eye.sy1.3|0.7=body.sy.97|1=', { fx: ['sparkle'] });
K('screen-repeat-clicks', 1600, `0=|${rep(6, 0.08, 0.9, i => `root.y${i % 2 ? 0 : -2} body.r${i % 2 ? -5 : 5} head.r${i % 2 ? 9 : -9} eye.sy${i % 2 ? .4 : 1.3}`)}|1=`, { fx: ['question'] });
K('screen-annoyed-clicks', 2000, `0=|0.15=body.sy.92 armL.r-30 armR.r30 eye.sy.5|${rep(4, 0.25, 0.85, i => `body.sy.92 armL.r-30 armR.r30 eye.sy.5 legs.y${i % 2 ? 0 : -1.8} head.r-6`)}|1=`, { fx: ['anger'] });
K('screen-follow-cursor', 1200, `0=|${steps(3, 1.4, 4, 16, 'eye.x3 head.r6 armR.r-30')}|1=`, { travel: 2.4 });
K('screen-flee-cursor', 800, `0=|0.1=eye.sy1.5 body.sy1.1|${steps(4, 2.2, 8, 30, 'eye.sy1.5 armL.r40 armR.r-40')}|1=`, { travel: 3.6, fx: ['exclaim'] });
K('screen-fall-off', 1200, '0=|0.2=root.y-2 armL.r120 armR.r-120 eye.sy1.5|0.6=root.y18 root.r40 root.o.8|1=root.y44 root.r90 root.o0', { solid: true, fx: ['exclaim'] });
K('screen-climb-back', 1800, `0=root.y44 root.o0|0.1=root.o1 root.y40|${rep(5, 0.15, 0.85, i => `root.y${36 - i * 8} armL.r${i % 2 ? 150 : 100} armR.r${i % 2 ? -100 : -150} legs.r${i % 2 ? 20 : -20}`)}|0.92=root.y-2 body.sy.9|1=`, { solid: true });
K('screen-leave-return', 3200, '0=|0.1=armR.r-135|0.2=armR.r-150|0.3=root.x-2 root.o.6|0.4=root.x-5 root.o0|0.7=root.x-5 root.o0|0.8=root.x-3 root.o1 body.sy1.1|0.92=root.x0 body.sy.94|1=', { solid: true, fx: ['sparkle'] });

/* ── 8 mode-specific ──────────────────────────────────────────────── */
K('act-read-clue', 2400, '0=prop.o0|0.2=prop.o1 prop.x4 prop.y-3 head.y1.5|0.4=prop.o1 prop.x4 eye.x-3 head.y1.5|0.6=eye.x3 prop.o1 prop.x4 head.y1.5|0.8=eye.sy1.3 prop.o1 prop.x4|1=prop.o0', { prop: 'slate', fx: ['question'] });
K('act-examine-evidence', 2200, '0=prop.o1 prop.x4 prop.y-4|0.25=head.y1.5 head.r-10 eye.sx1.4 eye.sy1.4 armR.r-60|0.55=head.r8 prop.x5|0.8=head.r-4 eye.sy1.2|1=prop.o0', { prop: 'marker' });
K('act-write', 2400, `0=prop.o0|0.15=prop.o1 prop.x4 prop.y-2 armL.r35 head.y1.5 head.r6|${rep(8, 0.25, 0.9, i => `prop.o1 prop.x4 prop.y-2 armR.r${i % 2 ? -34 : -52} head.y1.5 head.r6`)}|1=prop.o0`, { prop: 'slate' });
K('act-draw-diagram', 2600, `0=prop.o0|0.15=prop.o1 prop.x4 prop.y-2|${rep(7, 0.2, 0.9, i => `prop.o1 prop.x4 prop.y-2 armR.r${[-40, -80, -50, -90, -35, -75, -55][i]} body.r${i % 2 ? 3 : -3} eye.x${[1, 3, 1, 3, 1, 3, 2][i]}`)}|1=prop.o0`, { prop: 'slate' });
K('act-connect-evidence', 2400, '0=|0.15=armL.r88 eye.x-3|0.35=armL.r88 armR.r-88 eye.x3|0.55=armL.r60 armR.r-60 head.r-6|0.8=armL.r30 armR.r-30 body.sx1.06 eye.sy1.3|1=', { prop: 'marker', fx: ['sparkle'] });
K('act-lever', 2000, '0=|0.15=armR.r-120 body.r4|0.4=armR.r-60 body.r12|0.55=armR.r-30 body.r16 body.y1|0.8=armR.r-30 body.r8|1=');
K('act-open-door', 2400, '0=|0.2=armL.r-30 armR.r30 body.r8|0.5=armL.r-60 armR.r60 body.r12 body.sy.94 root.x1|0.8=armL.r90 armR.r-90 body.r0 root.x2 eye.sy1.3|1=', { fx: ['sparkle'] });
K('act-inspect-map', 2600, '0=prop.o0|0.2=prop.o1 prop.x4 prop.y-2 armL.r40 armR.r-40|0.4=prop.o1 prop.x4 eye.x-3 head.r-8|0.7=prop.o1 prop.x4 eye.x3 head.r8 armR.r-80|0.9=head.r0|1=prop.o0', { prop: 'map', fx: ['question'] });
K('act-dig', 2600, `0=|0.15=body.sy.88 body.r8 armL.r-30 armR.r30|${rep(6, 0.25, 0.9, i => `body.sy.88 body.r${i % 2 ? 14 : 4} armL.r${i % 2 ? -60 : -20} armR.r${i % 2 ? 60 : 20} legs.r${i % 2 ? -8 : 8}`)}|1=`, { fx: ['dust'] });
K('act-examine-artifact', 2400, '0=prop.o1 prop.x3 prop.y-4|0.25=prop.x4 prop.y-7 head.r-10 eye.sx1.4 eye.sy1.4 armL.r-50 armR.r50|0.5=prop.r40 prop.x4 prop.y-7 head.r8|0.75=prop.r-30 prop.y-7 eye.sy1.5 body.sy1.06|1=prop.o0', { prop: 'item', fx: ['sparkle'] });
K('act-carry-materials', 2400, `0=prop.o1 prop.sx1.5 prop.sy1.4 prop.y-6|${steps(4, 1.2, 3, 12, 'prop.o1 prop.sx1.5 prop.sy1.4 prop.y-6 armL.r-40 armR.r40 body.sy.94')}|1=prop.o1 prop.sx1.5 prop.sy1.4 prop.y-6`, { travel: 2, prop: 'item' });
K('act-defend', 2000, `0=|0.15=body.sx1.12 armL.r-40 armR.r40 eye.sy.7|${rep(4, 0.25, 0.85, i => `body.sx1.12 body.r${i % 2 ? -4 : 4} root.x${i % 2 ? -1 : -.2} armL.r-40 armR.r40 eye.sy.7`)}|1=`, { fx: ['exclaim'] });
K('act-flee-danger', 1400, `0=|0.1=eye.sy1.6 body.sy1.1|${steps(5, 2.2, 8, 30, 'eye.sy1.6 armL.r50 armR.r-50')}|1=`, { travel: 4, fx: ['exclaim', 'sweat'] });
K('act-hide', 2200, '0=|0.25=body.sy.5 body.y4 head.y3 eye.sy1.5|0.5=body.sy.5 body.y4 head.y2 eye.x3 eye.sy1.6|0.8=body.sy.5 body.y4 head.y3 eye.sy.5|1=');
K('act-discover', 2200, `0=|0.2=body.sy1.1 eye.sy1.5 head.y-1.5|0.45=root.y-7 ${ARMS_UP} eye.sy1.5|0.7=root.y0 body.sy.94 ${ARMS_OUT}|1=`, { fx: ['sparkle', 'exclaim'] });
K('act-reverse', 2000, `0=|0.2=body.r-12 armR.r-150|0.5=body.r10 armR.r-60 head.r-14|0.8=body.r-6 armR.r-120 head.r10|1=`, { fx: ['swirl'] });

/* ── 9 advanced ───────────────────────────────────────────────────── */
K('adv-squash-stretch', 1600, `0=|${rep(4, 0.1, 0.9, i => `root.y${i % 2 ? 0 : -10} body.sy${i % 2 ? .66 : 1.3} body.sx${i % 2 ? 1.34 : .78} legs.sy${i % 2 ? .6 : 1.4}`)}|1=`);
K('adv-anticipate-jump', 1400, '0=|0.15=body.sy.7 body.sx1.2 armL.r-30 armR.r30 body.y3|0.3=body.sy.62 body.sx1.26 body.y4|0.5=root.y-13 body.sy1.25 body.sx.84 armL.r140 armR.r-140|0.8=root.y0 body.sy.8 body.sx1.18|1=');
K('adv-overshoot-landing', 1400, '0=root.y-12|0.3=root.x3.6 root.y0 body.sy.7 body.sx1.22|0.5=root.x4.4 body.sy1.14 body.r10|0.7=root.x3.9 body.r-6|0.9=root.x4 body.r1|1=root.x4', { travel: 0.6 });
K('adv-recoil', 1000, '0=|0.1=root.x-3.2 body.r-14 body.sx.88 eye.sy1.5|0.3=root.x.8 body.r5|0.5=root.x-.6 body.r-3|0.8=root.x0 body.r0|1=', { fx: ['exclaim'] });
K('adv-smooth-turn', 1400, '0=|0.25=head.r-10 eye.x-3|0.5=head.r-14 body.sx.4 root.x-.5|0.7=body.sx.9 head.r-4|1=');
K('adv-stagger', 2000, `0=|${rep(6, 0.08, 0.9, i => `root.x${[1, 2.4, 1.6, 3.2, 2.6, 3.6][i]} body.r${[10, -14, 12, -10, 16, -6][i]} legs.r${i % 2 ? -22 : 22} armL.r${[60, 20, 90, 30, 80, 50][i]} armR.r${[-30, -80, -20, -90, -40, -70][i]}`)}|1=`, { travel: 1.2, fx: ['swirl'] });
K('adv-wobble', 1800, `0=|${rep(8, 0.05, 0.95, i => `body.r${(i % 2 ? -1 : 1) * Math.round(16 - i * 1.8)} head.r${(i % 2 ? 1 : -1) * Math.round(8 - i)}`)}|1=`);
K('adv-elastic-bounce', 2000, `0=root.y-14|${rep(6, 0.1, 0.95, i => `root.y${i % 2 === 0 ? 0 : -Math.round(12 - i * 2)} body.sy${i % 2 === 0 ? .8 : 1.12} body.sx${i % 2 === 0 ? 1.15 : .92}`)}|1=`);
K('adv-slowmo-celebrate', 4500, `0=|0.25=body.sy.9|0.5=root.y-8 ${ARMS_UP} body.sy1.1 head.y-1.5|0.7=root.y-9 ${ARMS_UP} body.sy1.12|0.9=root.y0 body.sy.94|1=`, { fx: ['sparkle'] });
K('adv-dramatic-entrance', 2600, '0=root.y-44 root.o0 root.r-20|0.2=root.o1 root.y-14 root.r0|0.45=root.y0 body.sy.7 body.sx1.2|0.6=body.sy1.1 body.sx.95|0.75=armL.r120 armR.r-120 head.y-1.5 body.sy1.06|0.92=armL.r120 armR.r-120 head.y-1.5|1=', { solid: true, fx: ['sparkle'] });
K('adv-dramatic-exit', 2600, '0=|0.2=armL.r120 armR.r-120 body.sy1.06|0.4=body.sx.3 root.x-.5|0.6=body.sx.1 body.r0|0.8=root.o.5 root.x-4|1=root.x-8 root.o0', { solid: true });
K('adv-fake-death', 3400, '0=|0.15=armR.r-20 armL.r20 body.sy.92 eye.sy1.4|0.35=body.r-16 root.x-1 head.r-20|0.55=root.r-90 root.y3 armL.r90 armR.r-110|0.75=root.r-90 root.y3 eye.sy.1|0.88=root.r-90 root.y3 eye.sy.7 eye.x2|0.95=root.r-90 root.y3 eye.sy.1|1=root.r-90 root.y3', { solid: true, fx: ['stars'] });
K('adv-revive', 2200, '0=root.r-90 root.y3 eye.sy.1|0.2=root.r-90 root.y3 body.sx1.1 body.sy.9|0.4=root.r-60 root.y2 armL.r60|0.65=root.r-10 root.y-4 body.sy1.1 eye.sy1.5|0.85=root.r0 root.y0 body.sy.9|1=', { solid: true, fx: ['sparkle'] });
K('adv-morph-expressions', 3000, '0=|0.15=eye.sy1.7 eye.sx1.2 head.y-1|0.3=eye.sy.15 head.r-8|0.45=eye.sx1.7 eye.sy.5 head.r8|0.6=eye.sy1.5 eye.sx.6|0.75=eye.sy.4 head.y1.5 head.r-10|0.9=eye.sy.9|1=', { fx: ['smile'] });
K('adv-shake-uncontrollably', 1800, `0=|${rep(16, 0.03, 0.97, i => `root.x${i % 2 ? -1.3 : 1.3} body.r${i % 2 ? -3 : 3} head.r${i % 2 ? 4 : -4}`)}|1=`, { fx: ['sweat'] });
K('adv-float-sleep', 3600, '0=|0.2=root.y-5 body.sy.92 eye.sy.1 head.y2.5|0.45=root.y-8 body.r3 eye.sy.1 head.y2.5|0.7=root.y-6 body.r-3 eye.sy.1 head.y2.5|0.9=root.y-1|1=', { fx: ['zzz'] });
K('adv-dream-bubbles', 3600, '0=|0.2=body.sy.92 eye.sy.1 head.y2.5 head.r8|0.5=body.sy.9 eye.sy.1 head.y2.8 head.r8|0.85=body.sy.92 eye.sy.1 head.y2.5 head.r8|1=', { fx: ['bubble', 'hearts'] });

/* ── trios ────────────────────────────────────────────────────────── */
K('trio-group-dance', 3600, `0=|${rep(8, 0.05, 0.95, i => `root.x${i % 2 ? -1.4 : 1.4} root.y${i % 2 ? 0 : -2.5} body.r${i % 2 ? -8 : 8} armL.r${i % 2 ? 110 : 30} armR.r${i % 2 ? -30 : -110}`)}|1=`, { roles: [`0=|0.06=|${rep(8, 0.11, 0.95, i => `root.x${i % 2 ? 1.4 : -1.4} root.y${i % 2 ? -2.5 : 0} body.r${i % 2 ? 8 : -8} armL.r${i % 2 ? 30 : 110} armR.r${i % 2 ? -110 : -30}`)}|1=`, `0=|0.12=|${rep(8, 0.17, 0.95, i => `root.y${i % 2 ? 0 : -3.5} body.sy${i % 2 ? .92 : 1.06} head.r${i % 2 ? 8 : -8} ${ARMS_UP}`)}|1=`], fx: ['note'] });
K('trio-sync-jump', 2000, '0=|0.2=body.sy.82|0.45=root.y-12 body.sy1.14 armL.r130 armR.r-130|0.72=root.y0 body.sy.86|1=', { roles: ['0=|0.2=body.sy.82|0.45=root.y-12 body.sy1.14 armL.r130 armR.r-130|0.74=root.y0 body.sy.9 body.r6|1=', '0=|0.2=body.sy.84|0.46=root.y-11 body.sy1.12 armL.r130 armR.r-130|0.8=root.y0 body.sy.8 root.x.6|1='] });
K('trio-all-fall', 2200, '0=|0.2=body.r10|0.4=root.r40 root.y-1|0.65=root.r-92 root.y3|0.9=root.r-92 root.y3|1=root.r-92 root.y3', { roles: ['0=|0.25=body.r-12|0.45=root.r-50|0.7=root.r88 root.y3|0.9=root.r88 root.y3|1=root.r88 root.y3', '0=|0.3=body.r6|0.5=root.r30 root.y-1|0.75=root.r-110 root.y3|0.92=root.r-110 root.y3|1=root.r-110 root.y3'], fx: ['stars'], solid: true });
