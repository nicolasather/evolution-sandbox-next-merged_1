/* Mode-exclusive acting, part 1: Survival (sv-), Civilization (cv-), Archaeology (ar-), Escape Room (er-).
   Every clip is a gesture the mode actually asks of the player or shows on screen — gathering water, queueing a programme, brushing a find,
   turning a gear — and is only ever played inside that mode (see exclusive.ts). */
import { ARMS_UP, rep, seq } from './clipdsl';
import { K } from './clipcore';

const sw = (n: number, t0: number, t1: number, f: (a: boolean) => string) => rep(n, t0, t1, i => f(i % 2 === 0));
const CROUCH = 'body.sy.74 body.y3 head.y2';

/* ── SURVIVAL: scout, assess, assign (water, food, wood, fire, shelter, rest), advance the day, keep the group alive ── */
K('sv-scan-water', 2200, '0=|0.2=armL.r140 head.r-8 eye.x-3 eye.y-1|0.5=armL.r140 head.r-10 eye.x-3.5|0.8=armL.r140 head.r-6 eye.x-3|1=');
K('sv-fetch-water-carry', 2600, `0=prop.o1 prop.y-4|${sw(6, 0.05, 0.95, a => `body.r${a ? 8 : -8} legs.r${a ? 16 : -16} body.y${a ? -1 : 0} armL.r-34 armR.r34 body.sy.94 prop.o1 prop.y-4 prop.r${a ? 4 : -4}`)}|1=prop.o1 prop.y-4`, { travel: 2.2, prop: 'item' });
K('sv-drink-cupped', 2000, '0=|0.25=body.sy.84 armL.r-20 armR.r20|0.5=armL.r-45 armR.r45 head.y-1.5 head.r-10|0.7=head.y2 head.r10 eye.sy.3|0.9=body.sy1.04 eye.sy.9|1=', { fx: ['smile'] });
K('sv-gather-berries', 2200, `0=|${sw(5, 0.1, 0.9, a => `armR.r${a ? -150 : -60} body.r${a ? -5 : 4} head.r${a ? -8 : 4} eye.y${a ? -2 : 1}`)}|1=`, { prop: 'item' });
K('sv-forage-ground', 2400, `0=|0.12=${CROUCH}|${sw(6, 0.2, 0.92, a => `${CROUCH} body.r${a ? 8 : -6} armR.r${a ? -20 : 30} eye.x${a ? 3 : -3} eye.y2`)}|1=`, { fx: ['question'] });
K('sv-chop-wood', 2400, `0=prop.o1 prop.y-3|${sw(6, 0.1, 0.9, a => `armR.r${a ? -165 : -50} armL.r${a ? 30 : -10} body.r${a ? -10 : 12} body.sy${a ? 1.06 : .92} prop.o1 prop.y${a ? -16 : 2} prop.r${a ? -40 : 30}`)}|1=prop.o0`, { prop: 'item', fx: ['dust'] });
K('sv-stack-wood', 2200, '0=prop.o1 prop.y-4|0.25=body.sy.84 prop.y1 armL.r-30 armR.r30|0.45=prop.o0|0.6=body.sy.98 head.r6|0.8=body.sy.84|1=', { prop: 'item' });
K('sv-light-fire', 2800, `0=|0.12=${CROUCH}|${sw(6, 0.2, 0.7, a => `${CROUCH} armL.r${a ? -50 : -20} armR.r${a ? 20 : 50} legs.r${a ? 4 : -4}`)}|0.82=${CROUCH} eye.sy1.5 head.y1|0.92=body.sy1.06 ${ARMS_UP}|1=`, { fx: ['sparkle'] });
K('sv-tend-fire', 2400, `0=prop.o1 prop.x5 prop.y1|0.15=body.sy.88 body.r8 armR.r-35|${sw(4, 0.25, 0.9, a => `body.sy.88 body.r8 armR.r${a ? -35 : -60} prop.o1 prop.x${a ? 5 : 8} prop.y1`)}|1=prop.o0`, { prop: 'item' });
K('sv-warm-by-fire', 2800, `0=|0.2=body.sy.94 armL.r-30 armR.r30 head.y1|${sw(4, 0.3, 0.8, a => `body.sy.94 armL.r-30 armR.r30 head.y1 body.x${a ? .3 : -.3}`)}|0.92=body.sy1.05 eye.sy.4|1=`, { fx: ['smile'] });
K('sv-fire-out-panic', 1800, `0=|0.1=body.sy1.14 eye.sy1.6 ${ARMS_UP}|${sw(6, 0.15, 0.85, a => `${ARMS_UP} root.x${a ? -1.2 : 1.2} eye.sy1.6`)}|1=`, { fx: ['exclaim', 'sweat'] });
K('sv-build-windbreak', 2800, `0=prop.o1 prop.x5 prop.y-3|${sw(5, 0.1, 0.9, a => `body.sy${a ? .86 : 1.0} armL.r${a ? -40 : 30} armR.r${a ? 40 : -30} prop.o1 prop.x${a ? 6 : 8} prop.y${a ? 0 : -5}`)}|1=prop.o0`, { travel: 0.8, prop: 'item' });
K('sv-build-leanto', 3000, '0=prop.o1 prop.x-5 prop.y-4|0.2=armL.r90 armR.r-90 prop.x-5 prop.y-12|0.4=armL.r140 armR.r-140 prop.x-2 prop.y-18 body.sy1.08|0.6=armL.r150 armR.r-150 prop.x0 prop.y-20|0.8=armL.r120 armR.r-120 body.sy.94 prop.y-14|1=prop.o0', { prop: 'item' });
K('sv-test-shelter', 2200, `0=|0.2=armL.r-40 armR.r40 body.r6|${sw(3, 0.3, 0.75, a => `armL.r-40 armR.r40 body.r${a ? 10 : 4} root.x${a ? 1 : .4}`)}|0.9=head.y1 head.r4 eye.sy.5|1=`);
K('sv-rest-sleep', 3200, '0=|0.3=root.r-88 root.y3 eye.sy.1|0.9=root.r-88 root.y3 eye.sy.1|1=root.r-88 root.y3', { fx: ['zzz'], solid: true });
K('sv-shiver-cold', 2000, `0=|0.1=body.sy.9 armL.r-35 armR.r35|${sw(14, 0.12, 0.9, a => `body.sy.9 armL.r-35 armR.r35 root.x${a ? -.7 : .7} head.r${a ? 3 : -3}`)}|1=`, { fx: ['sweat'] });
K('sv-hungry-belly', 2200, '0=|0.2=armR.r-25 armL.r25 body.sy.92|0.4=body.sy.88 head.y1.5 head.r-8|0.6=body.sy.94 body.sx1.04|0.8=body.sy.88 head.y1.5|1=', { fx: ['frown'] });
K('sv-thirsty-pant', 2400, `0=|0.15=head.y2 head.r8 body.sy.9|${sw(6, 0.2, 0.9, a => `body.sy${a ? .88 : .94} head.y2 head.r8 eye.sy.5`)}|1=`, { fx: ['sweat'] });
K('sv-tend-injured', 2600, '0=|0.2=root.x1 body.sy.8 armR.r-30|0.45=body.sy.8 armR.r-60 head.y1.5|0.7=body.sy.82 armR.r-40|0.9=body.sy.96|1=', { roles: ['0=root.r-88 root.y3|0.4=root.r-88 root.y3 eye.sy.4|0.7=root.r-80 root.y2 eye.sy.7|1=root.r-88 root.y3'], fx: ['hearts'] });
K('sv-cover-from-rain', 2200, `0=|0.15=armL.r150 armR.r-150 body.sy.88|${sw(6, 0.2, 0.9, a => `armL.r150 armR.r-150 body.sy.88 head.y2 root.x${a ? -.4 : .4}`)}|1=`, { fx: ['sweat'] });
K('sv-night-watch', 3000, '0=prop.o1 prop.x7 prop.y-4|0.15=body.sy1.06 head.y-1 eye.sy1.3 armR.r-40|0.4=eye.x-3 head.r-8 armR.r-40 prop.o1 prop.x7|0.7=eye.x3 head.r8 armR.r-40 prop.o1 prop.x7|0.9=eye.x0|1=prop.o0', { prop: 'item', fx: ['exclaim'] });
K('sv-dawn-stretch', 2600, `0=|0.25=${ARMS_UP} body.sy1.1 eye.sy.2 head.y-1|0.5=${ARMS_UP} body.sy1.12 head.r-8 eye.sy.15|0.75=armL.r40 armR.r-40 body.sy.96 eye.sy.7|1=`, { fx: ['smile'] });
K('sv-sunset-gaze', 2800, '0=|0.3=eye.y-2.5 head.y-1 head.r-6 armL.r20 armR.r-20|0.9=eye.y-2.5 head.y-1 head.r-6 armL.r20 armR.r-20|1=', { fx: ['smile'] });
K('sv-camp-cheer', 2600, seq([1, `0=|0.4=${ARMS_UP} body.sy1.08|1=${ARMS_UP} body.sy1.08`], [1.2, `0=${ARMS_UP}|0.3=root.x-1.4 root.y-2 ${ARMS_UP}|0.6=root.x1.4 root.y-2 ${ARMS_UP}|1=`]), { fx: ['sparkle'] });

/* ── CIVILIZATION: districts, programmes, services routed by links, seasons, crises, decisions ── */
K('cv-survey-district', 2400, '0=|0.2=armL.r140 head.y-1 eye.sy1.2|0.45=armL.r140 eye.x-3|0.7=armL.r140 eye.x3|0.9=eye.x0|1=');
K('cv-queue-programme', 2400, `0=prop.o0|0.15=prop.o1 prop.x4 prop.y-2 armL.r35 head.y1.5|${sw(5, 0.25, 0.8, a => `prop.o1 prop.x4 prop.y-2 armR.r${a ? -34 : -52} head.y1.5`)}|0.92=armR.r-110 eye.sy1.3|1=prop.o0`, { prop: 'slate' });
K('cv-lay-foundation', 2400, `0=prop.o1 prop.x3 prop.y2|0.15=${CROUCH}|${sw(4, 0.25, 0.85, a => `${CROUCH} armL.r${a ? -40 : -20} armR.r${a ? 20 : 40} prop.o1 prop.x${a ? 3 : 5} prop.y3`)}|1=prop.o0`, { prop: 'item' });
K('cv-raise-wall', 2800, `0=prop.o1 prop.y-3|${sw(5, 0.1, 0.9, a => `body.sy${a ? .84 : 1.05} armL.r${a ? -30 : 110} armR.r${a ? 30 : -110} prop.o1 prop.y${a ? 2 : -12 - 1}`)}|1=prop.o0`, { prop: 'item' });
K('cv-hammer-build', 2200, `0=prop.o1 prop.x7 prop.y-5|${sw(8, 0.08, 0.92, a => `armR.r${a ? -150 : -50} body.r${a ? -6 : 10} prop.o1 prop.x7 prop.y${a ? -16 : 0} prop.r${a ? -50 : 20}`)}|1=prop.o0`, { prop: 'item', fx: ['dust'] });
K('cv-carry-bricks', 2400, `0=prop.o1 prop.sx1.4 prop.sy1.2 prop.y-5|${sw(6, 0.05, 0.95, a => `body.r${a ? 4 : -4} legs.r${a ? 14 : -14} body.sy.92 armL.r-40 armR.r40 prop.o1 prop.sx1.4 prop.sy1.2 prop.y-5 body.y${a ? -1 : 0}`)}|1=prop.o0`, { travel: 2, prop: 'item' });
K('cv-route-service', 2600, '0=|0.15=armR.r-90 eye.x-3|0.35=armR.r-90 eye.x-1.5|0.55=armR.r-95 eye.x1.5|0.75=armR.r-100 eye.x3|0.9=armR.r-60 eye.sy1.3|1=', { fx: ['sparkle'] });
K('cv-repair-link', 2600, `0=prop.o1 prop.x6 prop.y-2|0.12=${CROUCH}|${sw(5, 0.2, 0.85, a => `${CROUCH} armR.r${a ? -30 : -60} prop.o1 prop.x${a ? 6 : 8} prop.y-2 prop.r${a ? -20 : 20}`)}|0.92=body.sy1.04|1=prop.o0`, { prop: 'item', fx: ['sparkle'] });
K('cv-build-link', 2800, '0=|0.15=armL.r60 armR.r-60|0.35=armL.r40 armR.r-40 root.x-1|0.55=armL.r90 armR.r-90 root.x1.4|0.8=armL.r60 armR.r-60 body.sx1.06 eye.sy1.2|1=', { travel: 1.2 });
K('cv-set-policy', 2200, '0=prop.o1 prop.x5 prop.y-8|0.3=armR.r-120 prop.y-12|0.45=armR.r-50 prop.y1 body.sy.92|0.6=armR.r-120 prop.y-12 body.sy1|0.75=armR.r-50 prop.y1 body.sy.92|1=prop.o0', { prop: 'marker' });
K('cv-weigh-resources', 2600, `0=|0.2=armL.r60 armR.r-60 head.r-6|${sw(4, 0.3, 0.9, a => `armL.r${a ? 80 : 50} armR.r${a ? -50 : -80} head.r${a ? -8 : 8} body.r${a ? 3 : -3}`)}|1=`, { fx: ['question'] });
K('cv-read-forecast', 2600, '0=prop.o0|0.2=prop.o1 prop.x4 prop.y-3 head.y1|0.45=prop.o1 prop.x4 eye.y-2.5 head.y-1|0.7=prop.o1 prop.x4 eye.y1 head.y1 eye.sy.7|0.9=eye.sy1.2|1=prop.o0', { prop: 'slate', fx: ['exclaim'] });
K('cv-crisis-alarm', 2000, `0=|0.1=body.sy1.14 eye.sy1.6 armR.r-150|${sw(6, 0.15, 0.85, a => `armR.r${a ? -170 : -130} body.r${a ? -4 : 4} eye.sy1.6 head.y-1`)}|1=`, { fx: ['exclaim'] });
K('cv-decide-choice', 2800, '0=|0.15=armL.r60 armR.r-60 head.r-6|0.35=armL.r90 armR.r-40 head.r-10 eye.x-2|0.55=armL.r40 armR.r-90 head.r10 eye.x2|0.75=armR.r-110 head.r4 body.sy1.04|1=', { fx: ['question'] });
K('cv-hand-out-food', 2400, `0=prop.o1 prop.x6 prop.y-3|0.25=armR.r-60 armL.r40 prop.x8|0.5=armR.r-70 prop.x10 prop.y-4 body.r8|0.7=prop.o0 armR.r-40|1=`, { prop: 'item', fx: ['hearts'] });
K('cv-grind-grain', 2600, `0=|0.15=${CROUCH}|${sw(8, 0.2, 0.9, a => `${CROUCH} armR.r${a ? -10 : 30} armL.r${a ? -30 : 10} body.r${a ? 4 : -4}`)}|1=`, { fx: ['dust'] });
K('cv-plant-seed', 2400, `0=|0.12=${CROUCH}|0.35=${CROUCH} armR.r-10 eye.y2|0.5=${CROUCH} armR.r-30|0.7=body.sy.86 head.y1.5|0.9=body.sy1.04|1=`, { prop: 'item' });
K('cv-harvest-sweep', 2600, `0=prop.o1 prop.x7 prop.y-2|${sw(6, 0.1, 0.9, a => `body.r${a ? -14 : 14} armR.r${a ? -120 : -30} legs.r${a ? 6 : -6} prop.o1 prop.x${a ? 4 : 10} prop.y-2 prop.r${a ? -50 : 40}`)}|1=prop.o0`, { travel: 1.2, prop: 'item' });
K('cv-study-scroll', 2800, '0=prop.o0|0.2=prop.o1 prop.x4 prop.y-3 armL.r35 head.y1.5|0.45=prop.o1 prop.x4 eye.x-3|0.7=prop.o1 prop.x4 eye.x3 eye.sy1.3|0.9=head.y-.5 eye.sy1.4|1=prop.o0', { prop: 'slate', fx: ['sparkle'] });
K('cv-turn-season', 2400, '0=|0.2=eye.y-2.5 head.y-1 armR.r-30|0.45=armR.r-60 prop.o1 prop.x4 prop.y-3|0.7=armR.r-30 prop.r30|0.9=head.r4|1=prop.o0', { prop: 'slate' });
K('cv-unfurl-chapter', 2600, '0=prop.o0|0.2=prop.o1 prop.x4 prop.y-4 prop.sx.15 armL.r40 armR.r-40|0.5=prop.o1 prop.sx1 armL.r60 armR.r-60 head.r-4|0.8=prop.o1 prop.sx1 head.r4 eye.sy1.3|1=prop.o0', { prop: 'blueprint', fx: ['sparkle'] });
K('cv-trade-handshake', 2200, '0=|0.3=armR.r-70 root.x1 body.r5|0.5=armR.r-85 root.x1.2|0.7=armR.r-70|1=', { roles: ['0=prop.o1 prop.x-6|0.3=armL.r70 root.x-1 body.r-5 prop.o1|0.5=armL.r85 root.x-1.2|0.8=armL.r70|1=prop.o0'], prop: 'item', fx: ['smile'] });
K('cv-settlement-cheer', 2800, seq([1, `0=|0.5=${ARMS_UP} body.sy1.08|1=${ARMS_UP} body.sy1.08`], [1.4, `0=${ARMS_UP}|0.25=root.y-5 ${ARMS_UP}|0.5=root.y0 ${ARMS_UP} body.sy.94|0.75=root.y-5 ${ARMS_UP}|1=`]), { fx: ['sparkle'] });

/* ── ARCHAEOLOGY: stake a grid, survey squares, excavate, brush and lift finds, record context, analyse, hypothesise, report ── */
K('ar-survey-square', 2400, `0=|0.15=body.sy.9 head.y1.5 eye.y2|${sw(4, 0.25, 0.85, a => `body.sy.9 head.y1.5 eye.x${a ? -3 : 3} eye.y2 armR.r${a ? -60 : -90}`)}|1=`);
K('ar-stake-grid', 2600, `0=prop.o1 prop.x6 prop.y-4|${sw(6, 0.1, 0.9, a => `armR.r${a ? -150 : -60} body.sy${a ? 1.04 : .92} prop.o1 prop.x6 prop.y${a ? -14 : 2}`)}|0.95=armL.r90 armR.r-90|1=prop.o0`, { prop: 'marker', fx: ['dust'] });
K('ar-trowel-scrape', 2600, `0=prop.o1 prop.x5 prop.y1|0.12=${CROUCH}|${sw(8, 0.2, 0.92, a => `${CROUCH} armR.r${a ? -20 : -45} prop.o1 prop.x${a ? 4 : 8} prop.y2 body.r${a ? 3 : -2}`)}|1=prop.o0`, { prop: 'brush', fx: ['dust'] });
K('ar-excavate-layer', 3000, `0=|0.12=${CROUCH}|${sw(6, 0.2, 0.9, a => `${CROUCH} armL.r${a ? -50 : -10} armR.r${a ? 10 : 50} body.r${a ? 6 : -6}`)}|1=`, { fx: ['dust'] });
K('ar-sieve-soil', 2600, `0=prop.o1 prop.x4 prop.y-3|${sw(8, 0.1, 0.9, a => `armL.r${a ? -45 : -30} armR.r${a ? 30 : 45} prop.o1 prop.x${a ? 3 : 5} prop.y-3 body.sy.94 head.y1`)}|1=prop.o0`, { prop: 'item', fx: ['dust'] });
K('ar-spot-find', 1800, `0=|0.12=body.sy1.1 eye.sy1.6 armR.r-90 eye.x2 eye.y2|0.4=armR.r-95 root.x1|0.7=armR.r-90|1=`, { fx: ['exclaim'] });
K('ar-lift-find-gently', 2600, '0=|0.15=body.sy.76 body.y3 armL.r-20 armR.r20|0.45=body.sy.76 armL.r-30 armR.r30 prop.o1 prop.y1|0.8=body.sy.98 armL.r-50 armR.r50 prop.o1 prop.y-4|1=prop.o1 prop.y-4', { prop: 'item', solid: true });
K('ar-brush-clean-find', 2600, `0=prop.o1 prop.x4 prop.y-2|0.12=body.sy.84 head.y1.5|${sw(8, 0.2, 0.92, a => `body.sy.84 head.y1.5 armR.r${a ? -60 : -35} prop.o1 prop.x${a ? 7 : 3} prop.y-2`)}|1=prop.o0`, { prop: 'brush', fx: ['dust'] });
K('ar-measure-context', 2600, '0=prop.o1 prop.x4 prop.y-3|0.2=armL.r60 armR.r-60 prop.x4|0.45=armL.r60 armR.r-60 prop.x-2 prop.sx1.5|0.7=armL.r50 armR.r-50 head.r-6 eye.sy1.3|1=prop.o0', { prop: 'marker' });
K('ar-photograph-find', 2200, '0=prop.o1 prop.x3 prop.y-8|0.2=armL.r-60 armR.r60 head.y1 eye.sy.5|0.45=armL.r-60 armR.r60 eye.sy.2|0.5=armL.r-60 armR.r60 eye.sy.1|0.65=armL.r-60 armR.r60 eye.sy.5|0.9=head.y0|1=prop.o0', { prop: 'marker', fx: ['sparkle'] });
K('ar-label-bag', 2400, `0=prop.o1 prop.x4 prop.y-2|${sw(6, 0.15, 0.85, a => `prop.o1 prop.x4 prop.y-2 armR.r${a ? -34 : -50} head.y1.5 head.r6`)}|0.95=armR.r-100|1=prop.o0`, { prop: 'slate' });
K('ar-record-stratigraphy', 2800, `0=prop.o0|0.15=prop.o1 prop.x4 prop.y-2|${sw(6, 0.2, 0.9, a => `prop.o1 prop.x4 prop.y${a ? -2 : 0} armR.r${[-34, -50][a ? 0 : 1]} eye.y${a ? 1 : 2} head.y1.5`)}|1=prop.o0`, { prop: 'slate' });
K('ar-analyze-lens', 2600, '0=prop.o1 prop.x4 prop.y-6|0.2=head.y1.5 head.r-10 eye.sx1.5 eye.sy1.5 armR.r-70|0.5=head.r6 prop.x5 eye.sx1.7|0.8=head.r-4 eye.sy1.5 body.sy1.04|1=prop.o0', { prop: 'marker', fx: ['sparkle'] });
K('ar-compare-parallels', 2600, '0=|0.2=armL.r60 armR.r-60 eye.x-3 head.r-6|0.4=armL.r60 armR.r-60 eye.x3 head.r6|0.6=armL.r60 armR.r-60 eye.x-3 head.r-6|0.8=armL.r70 armR.r-50 eye.sy1.3|1=', { prop: 'item', fx: ['question'] });
K('ar-sketch-artifact', 2800, `0=prop.o0|0.15=prop.o1 prop.x4 prop.y-2|${sw(7, 0.2, 0.9, a => `prop.o1 prop.x4 prop.y-2 armR.r${a ? -30 : -70} eye.x${a ? 1 : 3} head.y1.5`)}|1=prop.o0`, { prop: 'slate' });
K('ar-hypothesize-function', 2800, '0=|0.2=armR.r-130 head.r-10 eye.y-2 eye.x2|0.5=armR.r-130 head.r-10 head.y1 eye.sy.6|0.75=armR.r-165 eye.sy1.4 head.y-1|0.9=armR.r-165|1=', { fx: ['question', 'exclaim'] });
K('ar-date-phase', 2600, `0=|${sw(5, 0.1, 0.9, a => `armR.r${-50 - (a ? 0 : 1) * 14} head.y${a ? .6 : 0} eye.y${a ? 2 : -1}`)}|0.95=armR.r-120 eye.sy1.3|1=`, { fx: ['question'] });
K('ar-link-evidence', 2600, '0=|0.15=armL.r88 eye.x-3|0.35=armL.r88 armR.r-88 eye.x3|0.6=armL.r60 armR.r-60 body.sx1.06|0.8=armL.r30 armR.r-30 eye.sy1.3|1=', { prop: 'marker', fx: ['sparkle'] });
K('ar-write-report', 3000, `0=prop.o0|0.12=prop.o1 prop.x4 prop.y-2 armL.r35 head.y1.5 head.r6|${sw(10, 0.2, 0.9, a => `prop.o1 prop.x4 prop.y-2 armR.r${a ? -34 : -52} head.y1.5 head.r6`)}|1=prop.o0`, { prop: 'slate' });
K('ar-submit-report', 2200, '0=prop.o1 prop.x5 prop.y-4|0.3=armR.r-60 armL.r-30 prop.x7 body.r6|0.55=armR.r-70 prop.x10 body.r12|0.8=prop.o0 armR.r-30 body.r4|1=', { prop: 'slate', fx: ['exclaim'] });
K('ar-budget-worry', 2400, `0=|0.15=armR.r-60|${sw(5, 0.2, 0.8, a => `armR.r${-60 - (a ? 0 : 20)} eye.x${a ? -2 : 2} head.r${a ? -6 : 6}`)}|0.92=body.sy.94 head.y1.5 eye.sy.6|1=`, { fx: ['sweat', 'question'] });
K('ar-carry-finds-tray', 2600, `0=prop.o1 prop.sx1.6 prop.y-5|${sw(6, 0.05, 0.95, a => `body.r${a ? 3 : -3} legs.r${a ? 10 : -10} body.sy.96 armL.r-45 armR.r45 prop.o1 prop.sx1.6 prop.y-5`)}|1=prop.o0`, { travel: 1.6, prop: 'item' });
K('ar-pass-find', 2400, '0=prop.o1 prop.y-3|0.3=armR.r-70 prop.x6|0.55=prop.x10 prop.o1|0.6=prop.o0|1=', { roles: ['0=prop.o0|0.55=armL.r70 prop.o1 prop.x-10 prop.y-3|0.8=prop.o1 prop.x-3 prop.y-4 head.y1.5 eye.sx1.3|1=prop.o0'], prop: 'item' });
K('ar-dust-off-hat', 1800, `0=|0.2=armR.r-150 head.y1|${sw(4, 0.25, 0.8, a => `armR.r${a ? -150 : -120} head.y1 head.r${a ? 4 : -4}`)}|1=`, { fx: ['dust'] });

/* ── ESCAPE ROOM: read the room, work the stations (ratio, sequence, match, code), take hints, open the final door ── */
K('er-look-around-room', 3000, '0=|0.15=eye.x-3 head.r-8|0.35=eye.x-3 eye.y-2 head.y-1|0.6=eye.x3 eye.y-2 head.r8|0.85=eye.x3 eye.y1|1=', { fx: ['question'] });
K('er-read-inscription', 2600, '0=|0.2=head.y-1 eye.y-2 armR.r-70|0.4=eye.x-3|0.65=eye.x3|0.85=eye.sy1.4 armR.r-90|1=', { fx: ['sparkle'] });
K('er-inspect-gears', 2600, `0=|0.15=body.sy.9 head.y1.5 head.r-10 eye.sx1.3|${sw(5, 0.25, 0.85, a => `body.sy.9 head.y1.5 armR.r${a ? -60 : -80} eye.x${a ? -2 : 2}`)}|1=`);
K('er-turn-gear', 2400, `0=|0.15=armR.r-70|${sw(6, 0.2, 0.9, a => `armR.r${[-100, -60, -40, -60, -100, -130][a ? 0 : 3]} body.r${a ? -4 : 4}`)}|0.95=armR.r-120 eye.sy1.3|1=`, { fx: ['sparkle'] });
K('er-measure-ratio', 2600, '0=prop.o1 prop.x4 prop.y-3|0.2=armL.r70 armR.r-40 prop.x3|0.45=armL.r55 armR.r-40 eye.x-2 head.r-8|0.7=armL.r70 head.r6 eye.sy1.2|1=prop.o0', { prop: 'marker', fx: ['question'] });
K('er-enter-number', 2200, `0=|0.2=armR.r-40|${sw(5, 0.25, 0.8, a => `armR.r${a ? -34 : -52} head.y1 eye.y2`)}|0.92=armR.r-100 eye.sy1.3|1=`);
K('er-reorder-steps', 2800, `0=prop.o0|0.1=armL.r60 armR.r-60|${sw(6, 0.15, 0.9, a => `armL.r${a ? 80 : 40} armR.r${a ? -40 : -80} head.r${a ? -6 : 6} eye.y${a ? -1 : 1}`)}|1=`, { fx: ['question'] });
K('er-match-item-target', 2800, '0=prop.o1 prop.x-5 prop.y-3|0.25=armL.r50 prop.x-5 eye.x-3|0.5=armR.r-60 prop.x4 prop.y-6 eye.x3|0.75=armR.r-40 prop.x6 prop.y-1 head.y1|0.9=prop.o0 body.sy1.05|1=', { prop: 'item', fx: ['sparkle'] });
K('er-peek-hint', 2400, '0=prop.o0|0.2=prop.o1 prop.x4 prop.y-3 head.y1.5 eye.sy.6|0.5=prop.o1 prop.x4 eye.sy1.3 eye.x2|0.8=prop.o0 head.y0 eye.sy1.5|1=', { prop: 'slate', fx: ['exclaim'] });
K('er-keypad-code', 2600, `0=|0.12=armR.r-70 head.y1|${sw(7, 0.2, 0.85, a => `armR.r${a ? -60 : -80} armR.x${a ? 0 : 1} eye.x${a ? -1 : 1}`)}|0.94=armR.r-110 eye.sy1.4|1=`);
K('er-rattle-door', 2200, `0=|0.15=armR.r-60 body.r8|${sw(6, 0.2, 0.85, a => `armR.r-60 body.r${a ? 8 : 4} root.x${a ? .8 : 0}`)}|0.92=body.sy.94 head.y1.5 head.r-8|1=`, { fx: ['frown'] });
K('er-door-opens', 2800, '0=|0.15=armL.r-30 armR.r30|0.4=armL.r-60 armR.r60 body.r10 body.sy.94 root.x1|0.65=armL.r90 armR.r-90 root.x2 eye.sy1.5 body.r0|0.9=armL.r60 armR.r-60 root.x2|1=', { travel: 0.8, fx: ['sparkle'] });
K('er-pull-lever', 2200, '0=|0.15=armR.r-120 body.r4|0.4=armR.r-60 body.r12 body.sy.94|0.55=armR.r-30 body.r16|0.8=armR.r-30 body.r8|1=', { fx: ['dust'] });
K('er-listen-wall', 2600, '0=|0.3=root.x1.5 body.r6 head.r12 eye.sy.4|0.6=root.x1.5 body.r6 head.r14 eye.sy.2|0.85=eye.sy1.5 head.r0 body.r0|1=', { fx: ['question'] });
K('er-buzzer-flinch', 1400, '0=|0.1=root.x-2 body.r-10 eye.sy1.6 armL.r50 armR.r-50|0.3=body.r4|0.6=head.r-14 eye.sy.6|0.8=head.r14|1=', { fx: ['exclaim'] });
K('er-click-solved', 1800, `0=|0.2=armR.r-90 eye.sy1.4|0.3=armR.r-60 root.y-3 body.sy1.08|0.6=armR.r-40|1=`, { fx: ['sparkle', 'smile'] });
K('er-stamp-station-solved', 2000, '0=prop.o1 prop.x6 prop.y-12|0.3=armR.r-130 prop.y-14|0.45=armR.r-60 prop.y2 body.sy.92|0.7=armR.r-60 prop.y2|0.85=armR.r-130 prop.y-12|1=prop.o0', { prop: 'marker', fx: ['sparkle'] });
K('er-light-torch', 2600, '0=prop.o1 prop.x7 prop.y-4|0.25=armR.r-110 prop.x7 prop.y-12 eye.sy1.2|0.5=armR.r-110 prop.y-12 prop.r10|0.75=armR.r-110 prop.y-12 prop.r-10|1=prop.o0', { prop: 'marker', fx: ['sparkle'] });
K('er-trace-mechanism', 2800, `0=|0.15=armR.r-80 eye.x-3|${sw(5, 0.25, 0.9, a => `armR.r${a ? -95 : -70} eye.x${a ? 1 : 3} eye.y${a ? -1 : 1} head.r${a ? 4 : 8}`)}|1=`);
K('er-pace-and-think', 3000, `0=|${sw(4, 0.08, 0.9, a => `root.x${a ? -2 : 2} legs.r${a ? -16 : 16} armR.r-130 head.r-8 body.sy1`)}|1=`, { travel: 0.4, fx: ['question'] });
K('er-escape-run-out', 2000, `0=|0.1=eye.sy1.5 armL.r40 armR.r-40|${sw(5, 0.15, 0.85, a => `body.r6 legs.r${a ? 28 : -28} body.y${a ? -2 : 0} armL.r${a ? 60 : 10} armR.r${a ? -10 : -60}`)}|1=`, { travel: 3.6, fx: ['sparkle'] });
K('er-collect-key', 2200, '0=prop.o0|0.2=armR.r-80 eye.x2 eye.sy1.4|0.45=prop.o1 prop.x7 prop.y-4 armR.r-70|0.7=prop.o1 prop.x5 prop.y-6 head.y1 eye.sy1.3|1=prop.o0', { prop: 'item', fx: ['sparkle'] });
K('er-lift-together', 2600, '0=|0.25=body.sy.8 armL.r-30 armR.r30|0.55=body.sy1.02 armL.r-60 armR.r60 prop.o1 prop.y-8|0.85=armL.r-60 armR.r60 prop.o1 prop.y-8|1=prop.o0', { roles: ['0=|0.25=body.sy.8 armL.r-30 armR.r30|0.55=body.sy1.02 armL.r-60 armR.r60|0.85=armL.r-60 armR.r60|1='], prop: 'item', fx: ['sweat'] });
