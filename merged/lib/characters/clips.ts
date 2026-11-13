/* The animation library, part 1: 240 named, data-driven clips. Each clip is a multi-joint keyframe timeline (root, body, head, eye,
   arms, legs, tail/feelers/ring, prop, fx) in the pose DSL; the animator retargets the same clip to each rig. Pair / trio clips carry extra
   `roles` played on ONE shared timeline. Part 2 (clips2.ts) adds the extended 215-item library. */
import { ARMS_CLAP_IN, ARMS_CLAP_OUT, ARMS_OUT, ARMS_UP, hold, hop, osc, rep, seq, steps } from './clipdsl';
import { BY_ID, CLIPS, K } from './clipcore';
import type { ClipDef } from './types';
import './clips2';
import './clips3';
import './clips4';

const wave = (n: number, base: string) => rep(n * 2, 0.25, 0.8, i => `${base} armR.r${i % 2 ? -150 : -118}`);

/* ── 01 idle / personality loops ───────────────────────────────────── */
K('idle-breathe', 3200, '0=|0.5=body.sy1.04 body.y-.6 head.y-.4|1=', { loop: true });
K('idle-blink-slow', 1100, '0=|0.35=eye.sy.08|0.55=eye.sy.08|1=');
K('idle-blink-double', 700, '0=|0.15=eye.sy.1|0.3=|0.5=eye.sy.1|0.7=|1=');
K('idle-blink-asymmetric', 900, '0=|0.2=eye.sy.15 eye.r-8|0.45=eye.sy.15 eye.r-8|0.6=eye.sy.7 eye.r6|0.85=|1=');
K('idle-look-left', 1800, '0=|0.25=eye.x-3 head.r-6|0.75=eye.x-3 head.r-6|1=');
K('idle-look-right', 1800, '0=|0.25=eye.x3 head.r6|0.75=eye.x3 head.r6|1=');
K('idle-look-up', 1700, '0=|0.3=eye.y-3 head.r-4 head.y-1|0.75=eye.y-3 head.r-4 head.y-1|1=');
K('idle-look-down', 1700, '0=|0.3=eye.y3 head.y1.5 head.r3|0.75=eye.y3 head.y1.5 head.r3|1=');
K('idle-head-tilt-left', 1500, '0=|0.3=head.r-14 head.x-1|0.75=head.r-14 head.x-1|1=');
K('idle-head-tilt-right', 1500, '0=|0.3=head.r14 head.x1|0.75=head.r14 head.x1|1=');
K('idle-curious-cock', 2000, '0=|0.2=head.r-18 eye.x-1.5|0.45=head.r-18 eye.x-1.5|0.55=head.r-12 eye.sy1.2|0.85=head.r-12 eye.sy1.2|1=');
K('idle-foot-tap', 1100, `0=|${rep(6, 0.1, 0.9, i => `legs.y${i % 2 ? 0 : -1.4} legs.r${i % 2 ? 0 : 6}`)}|1=`);
K('idle-rocking', 2400, '0=|0.25=body.r-3 root.x-.8|0.5=|0.75=body.r3 root.x.8|1=', { loop: true });
K('idle-tail-sway', 2600, `0=|${osc('tail', 'r', 14, 3)}|1=`, { loop: true });
K('idle-shell-adjust', 1400, '0=|0.2=body.sx1.03 body.sy.98|0.4=body.sx.98 body.sy1.02|0.6=body.sx1.02 head.y-.5|1=');
K('idle-listen', 2200, '0=|0.3=body.r-4 head.r-10 eye.x-2 eye.sy1.25|0.8=body.r-4 head.r-10 eye.x-2 eye.sy1.25|1=');
K('idle-sleepy-dip', 2600, '0=|0.3=head.y2.5 head.r10 eye.sy.3 body.sy.97|0.55=head.y3 head.r12 eye.sy.12 body.sy.96|0.75=head.y.5 eye.sy.7 head.r2|1=');
K('idle-startle-ready', 700, '0=|0.15=root.y-3 body.sy1.1 eye.sy1.35 armL.r40 armR.r-40|0.5=body.sy.96 eye.sy1.15 armL.r25 armR.r-25|1=');
K('idle-look-at-user', 1600, '0=|0.3=head.r8 eye.x2 eye.y1 body.r2|0.8=head.r8 eye.x2 eye.y1 body.r2|1=');
K('idle-random-fidget', 1500, `0=|${rep(4, 0.1, 0.85, i => (['armL.r18 tail.r10', 'head.r-7 legs.r5', 'armR.r-16 eye.x1', 'body.sx1.03 tail.r-12'][i]))}|1=`);

/* ── 02 walking / locomotion ───────────────────────────────────────── */
K('walk-short', 1000, `0=|${steps(2, 1.4, 2)}|1=`, { travel: 1.6 });
K('walk-bouncy', 1100, `0=|${steps(3, 3.2, 3, 18)}|1=`, { travel: 2.4 });
K('walk-heavy', 1500, `0=|${steps(2, .8, 1.5, 10, 'body.sy.97')}|1=`, { travel: 1.4 });
K('walk-sneak', 1500, `0=|0.1=body.sy.8 head.y1.5|${steps(3, .4, 1, 10, 'body.sy.82 head.y1.5')}|0.92=body.sy.8|1=`, { travel: 1.8 });
K('walk-sideways', 1100, `0=|${rep(4, 0.08, 0.92, i => `legs.x${i % 2 ? -1.5 : 1.5} legs.r${i % 2 ? -12 : 12} body.y${i % 2 ? 0 : -1}`)}|1=`, { travel: 2 });
K('walk-backwards', 1300, `0=|${steps(3, 1, 2, 12, 'head.r-8 eye.x-2')}|1=`, { travel: -1.7 });
K('walk-circle', 1800, '0=|0.2=root.x3 root.y-2 body.r6|0.45=root.x0 root.y-4 body.r0|0.7=root.x-3 root.y-2 body.r-6|1=', { travel: 0.4 });
K('walk-zigzag', 1000, `0=|${rep(4, 0.1, 0.9, i => `root.y${i % 2 ? 0 : -3.5} body.r${i % 2 ? -7 : 7} legs.r${i % 2 ? -20 : 20}`)}|1=`, { travel: 2.6 });
K('walk-tip-toe', 1600, `0=|${steps(4, 2.2, 1, 6, 'legs.sy1.18 body.y-1.8 head.y-1')}|1=`, { travel: 1.7 });
K('walk-march', 1500, `0=|${steps(4, 2, 0, 24, 'armL.r28 armR.r-28 head.y-.6')}|1=`, { travel: 2 });
K('walk-hurry', 700, `0=|${steps(4, 1.6, 6, 26, 'body.r4')}|1=`, { travel: 2.8 });
K('walk-waddle', 1500, `0=|${steps(4, 1, 10, 12, '')}|1=`, { travel: 1.6 });
K('walk-limp-comic', 1700, `0=|${rep(4, 0.08, 0.9, i => `body.r${i % 2 ? 3 : -12} body.y${i % 2 ? 0 : 1.8} legs.r${i % 2 ? 4 : -24}`)}|1=`, { travel: 1.1 });
K('walk-on-platform', 1800, '0=|0.15=body.r-6 armL.r75 armR.r-75|0.4=body.r5 armL.r85 armR.r-55|0.65=body.r-4 armL.r60 armR.r-85|0.9=body.r2 armL.r70 armR.r-70|1=', { travel: 1.8 });
K('walk-around-item', 1800, '0=|0.25=root.y-3 root.x2 body.r8 eye.x-2|0.5=root.y-5 body.r0 head.r-10|0.75=root.y-3 root.x-2 body.r-8 eye.x2|1=', { travel: 0.6 });
K('walk-follow-leader', 1400, `0=|${steps(3, 1.2, 2, 14, 'head.y.6 eye.x2')}|1=`, { travel: 2 });
K('walk-lead-group', 1500, `0=|0.08=body.sy1.03 head.y-1|${steps(3, 1.8, 0, 18, 'armR.r-35 head.y-1 body.sy1.03')}|0.92=armR.r-60 head.r-6|1=`, { travel: 2.4 });
K('walk-stop-skid', 800, '0=|0.2=body.r-10 legs.r-28 root.x1|0.5=body.r-14 legs.r-34 legs.sx1.1 root.x2.5|0.8=body.r3 root.x0|1=', { travel: 1.9 });
K('walk-turn-in-place', 900, '0=|0.3=body.sx.12 head.r-8|0.5=body.sx.05 body.r0|0.75=body.sx.9 head.r6|1=');
K('walk-retreat-peek', 1700, '0=|0.2=root.x-3 body.sy.88 eye.x-1|0.45=root.x-4 body.sy.86|0.7=root.x-2.5 head.r-14 eye.x2 eye.sy1.2|0.9=root.x-1 head.r-8|1=', { travel: 0.8 });

/* ── 03 jumps / aerial / recovery ──────────────────────────────────── */
K('jump-small', 650, hop(5));
K('jump-big', 950, hop(15, ARMS_UP + ' head.y-1'));
K('jump-long', 900, '0=|0.12=body.sy.84 legs.sy.8 body.r-4|0.45=root.y-9 root.x4 body.r-12 body.sy1.1|0.85=root.y0 root.x7 body.r4 body.sy.9|1=', { travel: 2.2 });
K('jump-double', 1200, seq([1, hop(6)], [1, hop(8)]));
K('jump-triple', 1500, seq([1, hop(5)], [1, hop(7)], [1, hop(10, ARMS_UP)]));
K('jump-tuck', 850, '0=|0.12=body.sy.86|0.45=root.y-11 body.sy.8 body.sx.9 legs.sy.55 armL.r-40 armR.r40|0.85=root.y0 body.sy.9|1=');
K('jump-spin', 900, '0=|0.12=body.sy.86|0.45=root.y-11 root.r180 body.sy1.1|0.7=root.y-6 root.r330|0.88=root.y0 root.r360 body.sy.9|1=root.r360');
K('jump-sideflip', 1000, '0=|0.12=body.sy.86 root.r4|0.4=root.y-12 root.x2 root.r-170|0.7=root.y-8 root.x4 root.r-300|0.88=root.y0 root.x5 root.r-355 body.sy.9|1=', { travel: 1.2 });
K('jump-backflip-comic', 1150, '0=|0.12=body.sy.8 root.r-6|0.4=root.y-12 root.r-190 armL.r120 armR.r-120|0.7=root.y-7 root.r-320|0.86=root.y0 root.r-365 body.sy.82 body.sx1.12|1=root.r-360');
K('jump-wall-bounce', 1000, '0=|0.2=root.x4 root.y-8 body.r10|0.38=root.x6 root.y-8 body.sx.8 body.r30|0.62=root.x2 root.y-10 body.r-12|0.85=root.x0 root.y0 body.sy.88|1=');
K('jump-pogo', 1300, `0=|${rep(5, 0.06, 0.94, i => `root.y${i % 2 ? 0 : -6 - i} body.sy${i % 2 ? .78 : 1.14} legs.sy${i % 2 ? .6 : 1.3}`)}|1=`);
K('jump-hover', 1300, '0=|0.15=body.sy.86|0.35=root.y-10 body.sy1.1|0.7=root.y-10.6 body.sy1.12 legs.sy.7 tail.r12|0.9=root.y0 body.sy.9|1=');
K('jump-land-soft', 600, '0=root.y-4|0.4=root.y0 body.sy.92 legs.sy.88|0.7=body.sy1.03|1=');
K('jump-land-heavy', 800, '0=root.y-5|0.3=root.y0 body.sy.74 body.sx1.2 legs.sy.65|0.55=body.sy1.08 body.sx.95|0.8=body.sy.97|1=');
K('fall-forward-safe', 1200, `0=|0.2=body.r12 root.y-1|0.5=root.r48 root.y2 root.x2 armL.r120 armR.r-120|0.7=root.r12 root.y1 body.sy.85|1=`);
K('fall-backward-safe', 1200, `0=|0.2=body.r-12|0.5=root.r-48 root.y2 root.x-2 armL.r120 armR.r-120|0.7=root.r-10 body.sy.85|1=`);
K('fall-upside-down', 1900, '0=|0.2=root.y-3 root.r90|0.4=root.y1 root.r180 armL.r110 armR.r-110|0.75=root.y1 root.r180 armL.r90 armR.r-90 tail.r20|0.9=root.r90 root.y-2|1=', { solid: true });
K('fall-legs-over-head', 1500, '0=|0.25=root.r-120 root.y-4|0.5=root.r-250 root.y1 legs.r40|0.75=root.r-340 root.y0 body.sy.85|1=root.r-360');
K('recover-roll', 1100, '0=|0.3=root.r140 root.x2|0.65=root.r290 root.x4 body.sy.8|0.9=root.r360 root.x4.6 body.sy.9|1=root.r360', { travel: 0.8 });
K('recover-pop-up', 900, '0=body.sy.7 body.sx1.18|0.3=root.y-7 body.sy1.2|0.55=root.y0 body.sy.88 body.r6|0.78=body.r-4|1=');

/* ── 04 emotional acting ───────────────────────────────────────────── */
K('emotion-delighted', 1500, `0=|0.2=root.y-4 body.sy1.08 eye.sy1.3 ${ARMS_OUT}|0.4=root.y0 body.sy.94|0.6=root.y-3 eye.sy1.3 ${ARMS_OUT}|1=`);
K('emotion-awe', 2200, '0=|0.3=body.sy1.05 eye.sy1.5 eye.sx1.2 head.y-1 head.r-4 armL.r20 armR.r-20|0.85=body.sy1.05 eye.sy1.5 eye.sx1.2 head.y-1 head.r-4 armL.r20 armR.r-20|1=');
K('emotion-confused', 1500, '0=|0.2=head.r-14 eye.sy.3|0.35=head.r-14 eye.sy1.1|0.5=head.r12 eye.sy.3|0.7=head.r12 eye.sy1.1 armR.r-30|1=');
K('emotion-deep-confused', 2200, '0=|0.2=head.r-20|0.4=head.r20 head.y-.6|0.6=head.r-20 eye.sy1.4|0.8=head.r360 eye.sy1.4 armR.r-45|1=head.r360', { prop: 'marker' });
K('emotion-worried', 1900, '0=|0.25=head.r-9 eye.x-2 eye.sy1.2 body.sy.96 armL.r-20 armR.r20|0.7=head.r-9 eye.x2 eye.sy1.2 body.sy.96 armL.r-25 armR.r25|1=');
K('emotion-relieved', 1700, '0=|0.2=body.sy1.06 head.y-1.5|0.45=body.sy.92 head.y1 eye.sy.4 armL.r10 armR.r-10|0.8=body.sy.98 eye.sy.8|1=');
K('emotion-proud', 1900, '0=|0.25=body.sy1.06 head.y-1.5 head.r-6 armL.r35 armR.r-35|0.8=body.sy1.06 head.y-1.5 head.r-6 armL.r35 armR.r-35|1=');
K('emotion-shy', 1800, '0=|0.3=body.sx1.06 head.y2 head.r10 eye.x2 eye.sy.7 root.x-1|0.75=body.sx1.06 head.y2 head.r10 eye.x2 eye.sy.7 root.x-1|1=');
K('emotion-embarrassed', 1700, '0=|0.2=head.r16 eye.x-3 body.sy.97|0.45=legs.r8 armL.r30 head.r16 eye.x-3|0.7=legs.r-8 armR.r-30 head.r16 eye.x-3|1=');
K('emotion-suspicious', 1800, '0=|0.2=eye.sy.45 eye.x2 head.r6|0.8=eye.sy.45 eye.x2 head.r6 body.r2|1=');
K('emotion-scheming', 2000, '0=|0.2=body.sy.92 head.r-6 eye.sy.55 armL.r-20 armR.r20|0.45=armL.r-35 armR.r35 eye.sy.55|0.6=armL.r-20 armR.r20|0.85=head.r-6 eye.sy.55|1=');
K('emotion-guilty', 1700, '0=|0.25=eye.x-3 head.r-8 body.sy.95|0.55=eye.x-3 eye.y1 head.r-8|0.8=eye.x3 eye.y1 head.r-8|1=');
K('emotion-bored', 2200, '0=|0.25=body.sy.93 head.y2 eye.sy.55|0.45=head.y2 armR.r-45|0.7=armR.r-60 eye.x2 eye.y-1|1=');
K('emotion-impatient', 1300, `0=|${rep(6, 0.08, 0.92, i => `legs.y${i % 2 ? 0 : -1.5} legs.r${i % 2 ? 0 : 8} armR.r-20 eye.sy.7`)}|1=`);
K('emotion-curious', 1800, '0=|0.3=root.x1.2 body.r5 head.r-12 eye.sx1.2 eye.sy1.3|0.8=root.x1.2 body.r5 head.r-12 eye.sx1.2 eye.sy1.3|1=');
K('emotion-frustrated', 1200, '0=|0.2=body.sy.92 armL.r30 armR.r-30|0.35=legs.y-2 legs.r12|0.45=legs.y0 legs.r0|0.6=legs.y-2 legs.r-12|0.75=legs.y0|1=');
K('emotion-triumphant', 1600, `0=|0.25=${ARMS_UP} body.sy1.08 head.y-1.5 root.y-2|0.75=${ARMS_UP} body.sy1.08 head.y-1.5 root.y-2|1=`);
K('emotion-disappointed', 1900, '0=|0.35=body.sy.9 head.y2.5 head.r-8 eye.sy.55 armL.r-5 armR.r5|0.8=body.sy.9 head.y2.5 head.r-8 eye.sy.55|1=');
K('emotion-apologetic', 1500, '0=|0.35=body.r22 body.y2 head.r20 eye.sy.7 armL.r40 armR.r-40|0.7=body.r22 body.y2 head.r20 eye.sy.7|1=');
K('emotion-curious-delight', 2000, seq([1, '0=|0.5=body.r5 head.r-12 eye.sx1.2 eye.sy1.3|1=body.r5 head.r-12 eye.sx1.2 eye.sy1.3'], [1, `0=|0.35=root.y-5 body.sy1.1 eye.sy1.35 ${ARMS_OUT}|0.7=root.y0 body.sy.94|1=`]));

/* ── 05 cheers / milestones ───────────────────────────────────────── */
K('cheer-one-arm', 1000, '0=|0.25=armR.r-150 body.r-4 root.y-2|0.45=armR.r-165|0.65=armR.r-150|1=');
K('cheer-two-arm', 1100, `0=|0.2=${ARMS_UP} body.sy1.06|0.45=${ARMS_UP} root.y-3 body.sy1.1|0.7=${ARMS_UP} root.y0|1=`);
K('cheer-running-circle', 2200, `0=|${rep(8, 0.04, 0.96, i => `root.x${[3, 5, 3, 0, -3, -5, -3, 0][i]} root.y${i % 2 ? -1 : -3} legs.r${i % 2 ? -22 : 22} ${ARMS_UP}`)}|1=`);
K('cheer-applause', 1500, `0=|${rep(8, 0.08, 0.92, i => (i % 2 ? ARMS_CLAP_OUT : ARMS_CLAP_IN) + ' body.sy1.03')}|1=`);
K('cheer-silent-clap', 1800, `0=|${rep(6, 0.1, 0.85, i => (i % 2 ? 'armL.r55 armR.r-55' : 'armL.r-35 armR.r35') + ' head.r4 body.sy1.02')}|0.95=body.sy1.05|1=`);
K('cheer-hop-clap', 1500, `0=|${rep(4, 0.06, 0.94, i => `root.y${i % 2 ? 0 : -5} ${i % 2 ? ARMS_CLAP_OUT : ARMS_CLAP_IN} body.sy${i % 2 ? .92 : 1.08}`)}|1=`);
K('cheer-confetti-dodge', 2000, `0=|0.2=root.x2 root.y-2 head.r-10 prop.o1 prop.y-12|0.4=root.x-2 body.r8 prop.y-4|0.6=root.x1 body.r-8 ${ARMS_OUT} prop.y2|0.85=prop.o0 prop.y8|1=`, { prop: 'confetti' });
K('cheer-victory-pose', 2400, '0=|0.2=body.sy1.08 head.y-1.5 armL.r140 armR.r-60 body.r-5|0.85=body.sy1.08 head.y-1.5 armL.r140 armR.r-60 body.r-5|1=');
K('cheer-podium', 2400, `0=prop.o0|0.15=prop.o1 prop.y3|0.3=root.y-3.5 body.sy1.05 armL.r40 armR.r-40 prop.o1 prop.y3|0.85=root.y-3.5 ${ARMS_UP} prop.o1 prop.y3|1=`, { prop: 'item' });
K('cheer-group-sync', 1600, `0=|0.2=body.sy.88|0.45=root.y-9 ${ARMS_UP} body.sy1.12|0.7=root.y0 body.sy.9|1=`, { roles: [`0=|0.2=body.sy.88|0.45=root.y-9 ${ARMS_UP} body.sy1.12|0.7=root.y0 body.sy.9|1=`, `0=|0.2=body.sy.9|0.45=root.y-8 ${ARMS_UP}|0.7=root.y0|1=`] });
K('cheer-relay', 2200, `0=|0.15=${ARMS_UP} root.y-4|0.35=${ARMS_UP} root.y0 armR.r-60|1=`, { roles: [`0=|0.35=head.r-12 eye.x-2|0.5=${ARMS_UP} root.y-4|0.7=root.y0 armR.r-60|1=`, `0=|0.6=head.r-10 eye.x-2|0.78=${ARMS_UP} root.y-4|0.92=root.y0|1=`] });
K('cheer-hug', 2000, '0=|0.25=root.x1.5 body.sx1.08 armL.r60 armR.r-60|0.8=root.x1.5 body.sx1.08 armL.r70 armR.r-70 head.r6|1=', { roles: ['0=|0.25=root.x-1.5 body.sx1.08 armL.r60 armR.r-60|0.8=root.x-1.5 body.sx1.08 armL.r70 armR.r-70 head.r-6|1='] });
K('cheer-high-five', 1200, '0=|0.3=armR.r-120 root.x1|0.45=armR.r-130 root.x1.6 body.r-4|0.7=armR.r-60|1=', { roles: ['0=|0.3=armL.r120 root.x-1|0.45=armL.r130 root.x-1.6 body.r4|0.7=armL.r60|1='] });
K('cheer-spin-burst', 1100, `0=|0.15=body.sy.88|0.5=root.y-6 root.r360 ${ARMS_UP}|0.75=root.r720 root.y0 body.sy.92|1=root.r720`);
K('cheer-parade', 2400, `0=|${steps(6, 2, 2, 20, 'armR.r-120 armL.r30')}|1=`, { travel: 3 });
K('cheer-major-unlock', 3600, seq([2, '0=|0.5=body.sy.84 head.y1.5|1=body.sy.84'], [1.5, hop(14, ARMS_UP)], [1.5, `0=|0.25=root.r360 ${ARMS_UP} root.y-3|0.6=root.r720 root.y0|1=root.r720`], [1.5, `0=|0.4=${ARMS_UP} body.sy1.1 head.y-1.5|1=${ARMS_UP} body.sy1.1 head.y-1.5`], [1, `0=${ARMS_UP}|1=`]), { solid: true });
K('cheer-rare-find', 2800, seq([1, '0=|0.5=head.y-1.5 eye.sy1.4 body.sy1.05|1=head.y-1.5 eye.sy1.4 body.sy1.05'], [1, hold('armR.r-140 body.r-5 body.sy1.06', .25, .7)], [1, '0=|0.4=body.r5 head.r-6|1=']));
K('cheer-hidden-find', 2800, seq([1, '0=|0.3=eye.x-3 head.r-10|0.7=eye.x3 head.r10|1='], [1, '0=|0.5=eye.sy1.5 body.sy1.1|1='], [1.4, hop(12, ARMS_UP)]));
K('cheer-new-era', 3000, seq([1.2, '0=|0.5=head.y-2 head.r-6 eye.y-3 body.sy1.05 armR.r-100|1=head.y-2 head.r-6 eye.y-3 body.sy1.05 armR.r-100'], [1.4, hop(12, ARMS_UP)], [.8, `0=${ARMS_UP}|1=`]));
K('cheer-quiet-pride', 1800, '0=|0.3=head.y1 head.r4 body.sy1.03|0.5=head.y2.2 head.r6|0.8=head.y.5|1=');

/* ── 06 pointing / teaching / guidance ─────────────────────────────── */
K('guide-point-left', 1500, '0=|0.25=armL.r92 head.r-8 eye.x-3|0.8=armL.r92 head.r-8 eye.x-3|1=');
K('guide-point-right', 1500, '0=|0.25=armR.r-92 head.r8 eye.x3|0.8=armR.r-92 head.r8 eye.x3|1=');
K('guide-point-up', 1500, '0=|0.25=armR.r-172 eye.y-3 head.y-1|0.8=armR.r-172 eye.y-3 head.y-1|1=');
K('guide-point-down', 1500, '0=|0.25=armR.r-18 eye.y3 head.r6 body.sy.97|0.8=armR.r-18 eye.y3 head.r6|1=');
K('guide-point-item', 1800, '0=|0.2=armR.r-80 eye.x2 eye.y2 head.r6 body.r3|0.5=armR.r-86|0.65=armR.r-80|0.9=armR.r-80|1=');
K('guide-point-button', 1800, '0=|0.2=armR.r-95 body.r4 root.x1|0.4=armR.r-105 root.x1.6|0.55=armR.r-95|0.85=armR.r-95|1=');
K('guide-point-path', 2200, '0=|0.2=armR.r-60 eye.x1|0.45=armR.r-90 eye.x2.5|0.7=armR.r-70 eye.x3.5 eye.y-1|0.9=armR.r-100 eye.x4|1=');
K('guide-look-back-user', 2000, seq([1, '0=|0.4=armR.r-90 head.r8|1=armR.r-90 head.r8'], [1, '0=armR.r-90 head.r8|0.5=armR.r-90 head.r-12 eye.x-3 eye.sy1.2|1=armR.r-90 head.r-12 eye.x-3 eye.sy1.2'], [.5, '0=armR.r-90|1=']));
K('guide-wave-over', 1700, `0=|0.2=armR.r-130|${wave(3, '')}|1=`);
K('guide-demonstrate-tap', 1400, '0=|0.25=armR.r-60 root.x1|0.4=armR.r-75 body.r3|0.5=armR.r-55|0.65=armR.r-75|0.9=armR.r-55|1=');
K('guide-demonstrate-drag', 1800, '0=|0.2=armR.r-60|0.3=armR.r-75 prop.o1 prop.x4|0.6=armR.r-80 prop.o1 prop.x14 root.x2|0.85=armR.r-60 prop.o0|1=', { prop: 'proxy' });
K('guide-demonstrate-combine', 2200, `0=|0.2=${ARMS_OUT} prop.o1 prop.x-5|0.5=armL.r30 armR.r-30 prop.o1 prop.x0 body.sx1.04|0.65=armL.r20 armR.r-20 body.sy.94 prop.o1|0.85=prop.o0|1=`, { prop: 'proxy' });
K('guide-count-on-fingers', 2000, '0=|0.2=armR.r-40|0.4=armR.r-60|0.6=armR.r-80|0.8=armR.r-100|0.92=armR.r-100|1=');
K('guide-think-pose', 2400, '0=|0.3=armR.r-130 head.r-10 eye.y-2 eye.x2|0.85=armR.r-130 head.r-10 eye.y-2 eye.x2|1=');
K('guide-aha', 1100, '0=|0.15=root.y-3 body.sy1.1 armR.r-170 eye.sy1.4|0.4=armR.r-165 root.y0|0.8=armR.r-165|1=');
K('guide-shrug-maybe', 1500, '0=|0.2=armL.r50 armR.r-50 body.sy.96 head.y-.5|0.45=armL.r50 armR.r-50 head.r8|0.75=armL.r50 armR.r-50 head.r-8|1=');
K('guide-offer-hint', 1900, '0=prop.o0|0.25=prop.o1 prop.x5 armR.r-70 head.r5|0.8=prop.o1 prop.x5 armR.r-70 head.r5|1=prop.o0', { prop: 'marker' });
K('guide-step-aside', 900, '0=|0.4=root.x-3.5 body.r-6 legs.r14|0.9=root.x-3.6|1=root.x-3.6', { travel: -1.4 });
K('guide-nod-correct', 900, '0=|0.2=head.y1.5 head.r5|0.4=head.y-.5|0.6=head.y1.5 head.r5|0.9=|1=');
K('guide-gently-correct', 1600, '0=|0.25=armR.r-45 head.r-10 eye.sy.85|0.5=armR.r-45 head.r10|0.75=armR.r-45 head.r-6|1=');

/* ── 07 picking up / crafting / object work ───────────────────────── */
K('object-spot', 1100, '0=|0.15=body.sy1.08 eye.sy1.4 head.y-1.5|0.5=eye.x2.5 eye.y2 armR.r-55 head.r8|0.9=eye.x2.5 eye.y2|1=', { prop: 'item' });
K('object-approach', 1400, `0=|${steps(3, 1, 4, 14, 'eye.x2 eye.y1.5 head.r6')}|1=`, { travel: 2.2 });
K('object-squat-pickup', 1600, '0=|0.3=body.sy.7 body.y3 head.y2 armL.r-20 armR.r20|0.5=body.sy.66 armL.r-30 armR.r30 prop.o1 prop.y2|0.8=body.sy.98 prop.o1 prop.y-3 armR.r-50|1=prop.o1 prop.y-3', { prop: 'item', solid: true });
K('object-two-hand-lift', 1900, '0=prop.o1 prop.y4|0.3=body.sy.8 body.y2 prop.y3 armL.r-35 armR.r35|0.7=body.sy1.02 prop.y-6 armL.r-70 armR.r70|1=prop.o1 prop.y-6', { prop: 'item' });
K('object-one-hand-lift', 1300, '0=prop.o1 prop.y3|0.4=armR.r-80 prop.y-5|0.8=armR.r-65 prop.y-4.5|1=prop.o1 prop.y-4', { prop: 'item' });
K('object-overhead-lift', 2000, `0=prop.o1 prop.y3|0.3=body.sy.84 prop.y2|0.65=${ARMS_UP} body.sy1.1 prop.y-14|0.9=${ARMS_UP} prop.y-14.5|1=prop.y-14`, { prop: 'item' });
K('object-carry-walk', 2400, `0=prop.o1 prop.y-4|${steps(5, 1.2, 3, 14, 'prop.o1 prop.y-4 armR.r-55 armL.r-35')}|1=prop.o1 prop.y-4`, { travel: 3, prop: 'item' });
K('object-inspect-close', 2200, '0=prop.o1 prop.y-4 prop.x3|0.3=prop.x4 prop.y-6 head.r8 eye.sx1.3 eye.sy1.3 armR.r-60|0.6=prop.x4 prop.y-6 head.r-8 prop.r25|0.85=prop.x4 prop.y-6 head.r4|1=prop.o1 prop.x3 prop.y-4', { prop: 'item' });
K('object-turn-over', 1900, '0=prop.o1 prop.y-5|0.3=prop.y-6 prop.r90 armR.r-70|0.6=prop.r200 prop.y-6|0.85=prop.r360 head.r6|1=prop.o1 prop.y-5 prop.r360', { prop: 'item' });
K('object-shake-test', 1500, `0=prop.o1 prop.y-4|${rep(8, .15, .85, i => `prop.o1 prop.x${i % 2 ? -1.6 : 1.6} prop.y-5 armR.r-65 head.r-6`)}|1=prop.o1 prop.y-4`, { prop: 'item' });
K('object-sniff-test', 1800, '0=prop.o1 prop.y-4|0.25=prop.y-5 prop.x3 head.y1 eye.sy.4 body.r6|0.45=head.y1.8 prop.x3.2|0.65=head.y1 prop.x3|0.9=eye.sy1.3 head.r-8 body.r-3|1=prop.o1 prop.y-4', { prop: 'item' });
K('object-tap-test', 1500, `0=prop.o1 prop.y-3|${rep(4, 0.15, 0.8, i => `armR.r${i % 2 ? -60 : -78} prop.o1 prop.y-3 head.r${i % 2 ? 4 : 8}`)}|1=prop.o1 prop.y-3`, { prop: 'item' });
K('object-polish', 1900, `0=prop.o1 prop.y-4|${rep(6, 0.1, 0.85, i => `armR.r${i % 2 ? -55 : -75} prop.o1 prop.y-4 prop.r${i % 2 ? -4 : 4}`)}|1=prop.o1 prop.y-4`, { prop: 'item' });
K('object-brush', 2100, `0=prop.o1 prop.y-3|${rep(6, 0.1, 0.9, i => `armR.r${i % 2 ? -70 : -50} prop.o1 prop.x${i % 2 ? 6 : 2} body.r${i % 2 ? 2 : -2}`)}|1=prop.o0`, { prop: 'brush' });
K('object-measure', 2000, '0=prop.o1 prop.y-3|0.3=armL.r70 armR.r-40 prop.x3 head.r-8|0.55=armL.r55 armR.r-40 head.r-8 eye.x-2|0.8=armL.r70 head.r6|1=prop.o1 prop.y-3', { prop: 'item' });
K('object-place-carefully', 1700, '0=prop.o1 prop.y-4|0.35=body.sy.9 prop.y1 armR.r-30 head.y1.4|0.55=prop.y2.5 body.sy.88|0.8=prop.o1 prop.y2.5 body.sy.98|1=prop.o0', { prop: 'item' });
K('object-drop-soft', 1000, '0=prop.o1 prop.y-4|0.3=prop.y0|0.55=prop.y3 prop.o1|0.75=prop.y3 prop.o0 head.y1|1=', { prop: 'item' });
K('object-roll-to-peer', 1700, '0=prop.o1 prop.y3|0.3=armR.r-30 body.sy.9 prop.y3|0.7=prop.x14 prop.r360 prop.y3 armR.r-45|0.9=prop.o0|1=', { prop: 'item', roles: ['0=|0.55=eye.x-2 head.r-8|0.8=body.sy.9 armL.r-25 armR.r25|1='] });
K('object-throw-arc', 1500, '0=prop.o1 prop.y-4|0.25=armR.r-150 prop.y-12|0.45=armR.r-60 prop.x8 prop.y-16|0.75=prop.x18 prop.y-6 prop.r540|0.9=prop.o0 prop.x20 prop.y4|1=', { prop: 'item', roles: ['0=|0.5=eye.x-2 head.r-8|0.75=armL.r120 armR.r-120 root.y-2|0.9=armL.r30 armR.r-30 body.sy.94|1='] });
K('object-catch', 1000, `0=prop.o0 prop.x8 prop.y-14|0.3=${ARMS_OUT} eye.y-2 eye.x2 root.x1|0.55=armL.r-25 armR.r25 prop.o1 prop.x0 prop.y-4 body.sy.94|1=prop.o1 prop.y-4`, { prop: 'item' });

/* ── 08 mischief / pranks / disappearances ───────────────────────── */
K('prank-pocket-item', 1600, '0=prop.o1 prop.y-4|0.3=eye.x-3 head.r-8|0.55=prop.y2 prop.x-1 armR.r-20 body.sx1.05|0.75=prop.o0 eye.sy.6 head.r-6|1=', { prop: 'proxy' });
K('prank-return-to-backpack', 2200, seq([1, '0=|0.4=eye.x2 eye.y1.5 armR.r-70 eye.sy.55|1=eye.x2 eye.y1.5 armR.r-70 eye.sy.55'], [1, '0=armR.r-70|0.3=armR.r-150 body.r-8|0.55=armR.r-60 body.r8 root.x1.5 prop.o1 prop.y-12|1=armR.r-60 body.r8 prop.o0 prop.x-14'], [1, '0=|0.4=eye.x-3 head.r-8 eye.sy.55|1=']), { prop: 'proxy' });
K('prank-swap-places', 1700, '0=|0.3=root.x-3 root.y-3 body.r-8|0.6=root.x3 root.y-3 body.r8|0.9=root.x0 root.y0|1=', { roles: ['0=|0.3=root.x3 root.y-2 body.r8|0.6=root.x-3 root.y-2 body.r-8|0.9=|1='] });
K('prank-fake-out', 1800, seq([1, '0=prop.o1 prop.y-4|0.5=armR.r-150 prop.y-12|1=armR.r-150 prop.y-12'], [.6, '0=armR.r-150 prop.y-12|0.5=armR.r-150 prop.y-12 eye.sy.5|1=armR.r-40 prop.y-4'], [.8, '0=prop.y-4|0.5=head.r-10 eye.sy.55 body.sx1.04|1=']), { prop: 'item' });
K('prank-wrong-point', 2000, '0=|0.2=armR.r-95 head.r8 eye.x3 eye.sy.55|0.5=armR.r-100 body.sx1.04|0.7=armR.r-95 eye.x-1 eye.sy1.2|1=');
K('prank-decoy-answer', 2300, '0=prop.o0|0.2=prop.o1 prop.y-6 prop.x5 armR.r-70|0.5=prop.o1 prop.y-6 prop.x5 armR.r-70 eye.sy.5|0.8=prop.o1 prop.y-6 prop.x5 head.r-6|1=prop.o0', { prop: 'marker' });
K('prank-steal-spotlight', 1900, `0=|0.2=root.x2 root.y-2 body.sx1.12 body.sy1.12|0.5=root.x2 body.sx1.12 body.sy1.12 ${ARMS_OUT}|0.7=eye.sy.6 eye.x-2|0.9=root.x0 body.sx1|1=`);
K('prank-hide-behind-item', 1900, '0=|0.3=root.x-1.5 body.sy.7 head.y3 eye.sy1.2|0.55=head.y2.4 eye.x2 eye.sy1.4|0.8=body.sy.74 head.y3 eye.sy.6|1=');
K('prank-hide-inventory', 1600, '0=|0.4=root.x-5 root.o1 body.sy.8|0.7=root.x-9 root.o.3|0.9=root.x-10 root.o0|1=root.o0', { solid: true });
K('prank-pop-from-inventory', 1300, '0=root.x-10 root.o0|0.3=root.x-8 root.o1 head.y2|0.55=root.x-2 root.y-3 root.o1 body.sy1.1|0.8=root.x0 root.y0 body.sy.92|1=');
K('prank-vanish-pop', 1500, '0=|0.2=body.sy1.15 root.o1|0.35=root.o0 body.sx.1 body.sy.1|0.65=root.o0 body.sx.1 body.sy.1|0.8=root.o1 body.sx1.2 body.sy1.2 root.y-2|0.92=body.sx1 body.sy.95|1=', { solid: true });
K('prank-portal-dive', 2000, '0=prop.o0|0.2=prop.o1 prop.y3 prop.sx1 prop.sy.4|0.45=root.y2 body.sy.5 body.sx.7|0.65=root.y4 body.sy.1 root.o.1|0.8=prop.o.6 root.o0|1=prop.o0', { prop: 'portal', solid: true });
K('prank-return-with-sticker', 2400, '0=root.o0 prop.o0|0.25=root.o1 prop.o1 prop.y-4 prop.x4 armR.r-60|0.55=root.o1 prop.o1 prop.y-5 head.r-6 eye.sy1.3|0.85=prop.o1 armR.r-60|1=prop.o0', { prop: 'sticker' });
K('prank-return-with-owned-item', 2600, seq([1, '0=root.o0 prop.o0|0.5=root.o1 prop.o1 prop.y-4 armR.r-55|1=prop.o1 prop.y-4 armR.r-55'], [1, '0=prop.o1 prop.y-4|0.4=head.r-8 eye.sy1.3|1=prop.o1 prop.y-4 head.r-8'], [.7, '0=prop.o1 prop.y-4|0.6=prop.y2 body.sy.9|1=prop.o0']), { prop: 'proxy' });
K('prank-trip-on-own-feet', 1500, '0=|0.25=legs.r30 body.r14 root.x1|0.5=root.r60 root.y2 armL.r120 armR.r-120|0.7=root.r85 root.y3|0.9=root.r20 root.y1|1=');
K('prank-fall-upside-down', 2200, '0=|0.2=root.r90 root.y-2|0.4=root.r180 root.y1|0.55=root.r180 armR.r-110|0.7=root.r180 armR.r-130|0.85=root.r90|1=', { solid: true });
K('prank-tiny-victory-dance', 2200, `0=|${rep(8, 0.05, 0.95, i => `root.x${i % 2 ? -1.2 : 1.2} root.y${i % 2 ? 0 : -2.5} body.r${i % 2 ? -8 : 8} ${i % 2 ? 'armL.r100 armR.r-30' : 'armL.r30 armR.r-100'}`)}|1=`);
K('prank-fake-serious', 2100, seq([1, '0=|0.4=body.sy1.04 head.y-1 eye.sy.7 armL.r8 armR.r-8|1=body.sy1.04 head.y-1 eye.sy.7 armL.r8 armR.r-8'], [.6, `0=body.sy1.04 eye.sy.7|0.5=body.sy1.08 eye.sy1.2 head.r6 ${ARMS_OUT}|1=`]));
K('prank-innocent-whistle', 2200, `0=|0.2=eye.x-3 eye.y-3 head.r-8 head.y-1|${rep(4, .3, .85, i => `eye.x-3 eye.y-3 head.r-8 tail.r${i % 2 ? -10 : 10} body.sy${i % 2 ? 1 : 1.03}`)}|1=`);
K('prank-apology-bow', 1800, '0=|0.35=body.r28 body.y3 head.r24 eye.sy.7 armL.r25 armR.r-25|0.65=body.r28 body.y3 head.r24|0.85=body.r4|1=');

/* ── 09 mode-specific acting ─────────────────────────────────────── */
K('mode-survival-scan-horizon', 2600, '0=|0.2=armR.r-125 eye.y-2 head.y-.8|0.45=armR.r-125 eye.x-3 head.r-8|0.75=armR.r-125 eye.x3 head.r8|1=');
K('mode-survival-gather', 2200, seq([1, '0=|0.4=body.sy.78 body.y3 armR.r20|1=body.sy.78 body.y3 armR.r20'], [1, '0=body.sy.78 body.y3|0.4=body.sy.98 prop.o1 prop.y-3 armR.r-45|1=prop.o0']), { prop: 'item' });
K('mode-survival-build-shelter', 2800, `0=|${rep(5, .1, .9, i => `armL.r${i % 2 ? 60 : 130} armR.r${i % 2 ? -130 : -60} body.sy${i % 2 ? .96 : 1.02}`)}|1=`, { prop: 'item' });
K('mode-survival-warm-hands', 2600, `0=|0.25=armL.r-18 armR.r18 body.sy.96 head.y1 eye.sy.7|${rep(3, .35, .85, i => `armL.r-18 armR.r18 body.sy${i % 2 ? .96 : .98} eye.sy.7`)}|1=`);
K('mode-civilization-blueprint', 2800, '0=prop.o0|0.2=prop.o1 prop.y-3 prop.sx.2|0.5=prop.o1 prop.y-3 prop.sx1 armL.r60 armR.r-60 head.r-4|0.85=prop.o1 prop.sx1 head.r4 eye.x-2|1=prop.o0', { prop: 'blueprint' });
K('mode-civilization-assign-task', 2000, '0=|0.2=armR.r-80 head.r6|0.45=armR.r-100 eye.x3|0.7=armR.r-80 head.r-4 eye.x-2|1=');
K('mode-archaeology-brush-dust', 2600, `0=prop.o0|0.15=prop.o1 prop.x4|${rep(6, .2, .9, i => `prop.o1 prop.x${i % 2 ? 8 : 3} armR.r${i % 2 ? -60 : -85} head.y1 body.r${i % 2 ? 3 : -2}`)}|1=prop.o0`, { prop: 'brush' });
K('mode-archaeology-record-note', 2600, `0=prop.o0|0.2=prop.o1 prop.y-3 armL.r35 head.y1 head.r6|${rep(5, .3, .9, i => `prop.o1 armR.r${i % 2 ? -30 : -45} head.y1 head.r6`)}|1=prop.o0`, { prop: 'slate' });
K('mode-escape-listen-wall', 2400, '0=|0.3=root.x1.5 body.r6 head.r12 eye.sy.5|0.85=root.x1.5 body.r6 head.r12 eye.sy.5 tail.r8|1=');
K('mode-escape-turn-crank', 2400, `0=|0.15=armR.r-70|${rep(6, .2, .9, i => `armR.r${[-100, -60, -40, -60, -100, -130][i]} body.r${i % 2 ? 2 : -2} head.r-4`)}|1=`);
K('mode-decipher-trace-glyph', 2400, `0=|0.2=armR.r-90 eye.x2|${rep(5, .3, .9, i => `armR.r${[-100, -85, -110, -80, -95][i]} eye.x${[2, 3, 2, 3, 2][i]} eye.y${[-1, 0, 1, 0, -1][i]}`)}|1=`);
K('mode-decipher-compare-glyphs', 2600, '0=|0.2=armL.r75 armR.r-75 eye.x-3|0.4=armL.r75 armR.r-75 eye.x3|0.6=armL.r75 armR.r-75 eye.x-3 head.r-6|0.8=head.r6 eye.sy1.2 armL.r75 armR.r-75|1=');
K('mode-alien-scan-specimen', 2800, `0=|0.2=head.r-10 eye.sx1.3 armR.r-60|${rep(4, .3, .9, i => `head.r${i % 2 ? -10 : 10} eye.x${i % 2 ? -2 : 2} eye.sx1.3 armR.r-60`)}|1=`);
K('mode-alien-circle-evidence', 2400, `0=|0.2=armR.r-80|${rep(4, .3, .85, i => `armR.r${[-100, -70, -100, -75][i]} eye.x${[2, 3, 2, 1][i]}`)}|1=`);
K('mode-reverse-unpack', 2800, seq([1, '0=prop.o1 prop.sx1 prop.sy1|0.5=prop.o1 armL.r40 armR.r-40|1=prop.o0'], [1, '0=prop.o1 prop.sx.6 prop.sy.6|0.5=prop.o1 prop.sx.6 prop.sy.6 armL.r40|1=prop.o0'], [1, '0=|0.5=prop.o1 prop.sx.3 prop.sy.3 eye.sy1.3|1=prop.o0']), { prop: 'item' });
K('mode-reverse-trace-dependency', 2600, '0=|0.2=armR.r-80 eye.x3|0.45=armR.r-60 eye.x1 eye.y1|0.7=armR.r-40 eye.x-2 eye.y2|0.9=armR.r-40 eye.x-3|1=');
K('mode-path-map-route', 2400, `0=|0.2=armR.r-70|${rep(5, .3, .9, i => `armR.r${[-90, -105, -80, -110, -95][i]} eye.x${[1, 2, 3, 3.5, 4][i]}`)}|1=`);
K('mode-path-count-steps', 2200, `0=|${rep(5, .12, .85, i => `armR.r${-40 - i * 14} head.y${i % 2 ? .6 : 0} eye.x${i - 2}`)}|1=`);
K('mode-puzzle-hold-breath', 2200, '0=|0.35=body.sx1.1 body.sy1.1 eye.sy1.4|0.8=body.sx1.12 body.sy1.12 eye.sy1.4|0.92=body.sx.94 body.sy.94|1=');
K('mode-record-discovery', 2400, '0=prop.o0|0.2=prop.o1 prop.y-4 armR.r-60|0.5=prop.o1 prop.y2 armR.r-30 body.sy.92|0.75=prop.o1 prop.y3 body.sy.98|1=prop.o0', { prop: 'marker' });

/* ── 10 slapstick fights / rivalry ───────────────────────────────── */
const FO = '0=|0.3=body.r-6 root.x1.5 eye.sy.6 armL.r30 armR.r-30|0.8=body.r-6 root.x1.5 eye.sy.6 armL.r30 armR.r-30|1=';
K('fight-face-off', 1900, FO, { roles: ['0=|0.3=body.r6 root.x-1.5 eye.sy.6 armL.r30 armR.r-30|0.8=body.r6 root.x-1.5 eye.sy.6 armL.r30 armR.r-30|1='] });
K('fight-circle-opponent', 2000, '0=|0.25=root.x2 root.y-1 body.r8|0.5=root.x0 root.y-3 body.r0|0.75=root.x-2 root.y-1 body.r-8|1=', { roles: ['0=|0.25=root.x-2 root.y-1 body.r-8|0.5=root.x0 root.y-3|0.75=root.x2 root.y-1 body.r8|1='] });
K('fight-feint-left', 900, '0=|0.25=root.x-2 body.r-12|0.5=root.x1 body.r6 armR.r-60|0.8=root.x.5|1=');
K('fight-feint-right', 900, '0=|0.25=root.x2 body.r12|0.5=root.x-1 body.r-6 armL.r60|0.8=root.x-.5|1=');
K('fight-dodge-back', 800, '0=|0.2=root.x-3 body.r-14 eye.sy1.3|0.6=root.x-3 body.r-8|1=');
K('fight-dodge-side', 800, '0=|0.25=root.x2.5 root.y-2 body.r14 eye.sy1.3|0.7=root.x2 body.r6|1=');
K('fight-parry-stick', 1200, '0=prop.o1 prop.y-2|0.25=armR.r-110 prop.o1 prop.x4|0.4=armR.r-70 prop.o1 prop.x2 body.r-6|0.7=armR.r-95 prop.o1|1=prop.o0', { prop: 'pillow', roles: ['0=|0.3=armL.r100|0.4=armL.r60 body.r8|0.7=body.r2|1='] });
K('fight-pillow-swat', 1400, '0=prop.o1 prop.y-3|0.25=armR.r-160 prop.y-10|0.45=armR.r-40 prop.x6 body.r-8|0.7=armR.r-60 prop.x3|1=prop.o0', { prop: 'pillow', roles: ['0=|0.4=root.x-.5|0.5=body.r14 root.x-1.5 head.r16|0.8=body.r4|1='] });
K('fight-tug-of-war', 2400, `0=prop.o1|${rep(6, 0.1, 0.9, i => `root.x${i % 2 ? .8 : 2} body.r${i % 2 ? -8 : -14} armL.r60 armR.r-60 prop.o1 prop.x${i % 2 ? 5 : 7}`)}|1=prop.o0`, { prop: 'item', roles: [`0=prop.o1|${rep(6, 0.1, 0.9, i => `root.x${i % 2 ? -.8 : -2} body.r${i % 2 ? 8 : 14} armL.r60 armR.r-60`)}|1=`, '0=|0.4=eye.x-2 head.r-8|0.8=armR.r-60 eye.sy1.3|1='] });
K('fight-spin-out', 1300, '0=|0.2=body.r-12|0.4=root.x2 root.r360 root.y-1|0.7=root.x4 root.r720 body.r-14|0.9=root.r740 root.x3|1=root.r720', { travel: 1.2 });
K('fight-bonk-shell', 1200, '0=|0.25=root.x-2 body.sx.9|0.45=root.x1.2 body.sx1.15 head.r-10|0.7=root.x0 head.r5|1=', { roles: ['0=|0.25=root.x2 body.sx.9|0.45=root.x-1.2 body.sx1.15 head.r10|0.7=root.x0 head.r-5|1='] });
K('fight-stumble-stack', 2200, '0=|0.25=body.r14 root.x1.5|0.45=root.y-1 root.r60|0.7=root.y-4 root.r10 body.sy.8|1=', { roles: ['0=|0.3=body.r-12 root.x-1.5|0.5=root.r-40|0.75=root.y-1 root.r-10|1='], solid: true });
K('fight-fake-knockout', 2400, '0=|0.2=body.r-14 root.x-1 armL.r90 armR.r-90|0.35=root.r-90 root.y2.5 eye.sy.1|0.5=root.r-92 root.y3 eye.sy.1|0.85=root.r-92 root.y3 eye.sy.1 armL.r30|1=root.r-92 root.y3', { solid: true });
K('fight-play-dead-peek', 2600, '0=|0.2=root.r-90 root.y3 eye.sy.1|0.5=root.r-90 root.y3 eye.sy.1|0.6=root.r-90 root.y3 eye.sy.7 eye.x2|0.75=root.r-90 root.y3 eye.sy.1|0.92=root.r-40 root.y1|1=', { solid: true });
K('fight-victory-flex', 1700, '0=|0.25=body.sx1.12 body.sy1.1 armL.r100 armR.r-100|0.5=armL.r120 armR.r-120 body.sx1.16|0.8=armL.r100 armR.r-100 eye.sy.6|1=');
K('fight-loser-sulk', 2000, '0=|0.3=body.sy.88 body.r-12 head.y2 eye.sy.5 root.x-1|0.8=body.sy.88 body.r-12 head.y2.5 eye.sy.5 root.x-1.5|1=');
K('fight-peacemaker-separate', 2300, `0=|0.2=${ARMS_OUT} root.x1.5|0.5=armL.r110 armR.r-110 body.sx1.1 root.x1.2|0.85=${ARMS_OUT}|1=`, { roles: ['0=|0.4=body.r8 root.x-1|0.6=root.x-2.4 body.r-4|1=root.x-1.8', '0=|0.4=body.r-8 root.x1|0.6=root.x2.4 body.r4|1=root.x1.8'] });
K('fight-apology-handshake', 1800, '0=|0.3=armR.r-70 root.x1 body.r5|0.5=armR.r-85 root.x1.2|0.7=armR.r-70|1=', { roles: ['0=|0.3=armL.r70 root.x-1 body.r-5|0.5=armL.r85 root.x-1.2|0.7=armL.r70|1='] });
K('fight-truce-highfive', 1500, '0=|0.35=armR.r-130 root.x1|0.5=armR.r-135 root.x1.5 root.y-2|0.8=armR.r-50|1=', { roles: ['0=|0.35=armL.r130 root.x-1|0.5=armL.r135 root.x-1.5 root.y-2|0.8=armL.r50|1='] });
K('fight-immediate-round-two', 2800, seq([1, FO], [.8, '0=|0.4=body.r-10 armR.r-100|1='], [.9, '0=|0.4=eye.x3 eye.y-2 head.r10|0.8=eye.x3 eye.y-2 head.r10 body.sy1.04|1=']), { roles: ['0=|0.3=body.r6 root.x-1.5 eye.sy.6|0.6=body.r10 armL.r100|1='] });

/* ── 11 duets / trios / social skits ─────────────────────────────── */
K('duet-follow-the-leader', 2600, `0=|${steps(4, 1.4, 2, 16, 'armR.r-40')}|1=`, { travel: 2.6, roles: [`0=|${steps(4, 1.4, 2, 16, '')}|1=`] });
K('duet-mirror-moves', 2400, `0=|${rep(4, .1, .9, i => `armL.r${[60, 130, 40, 100][i]} armR.r${[-20, -60, -120, -30][i]} head.r${[8, -6, 6, -8][i]}`)}|1=`, { roles: [`0=|${rep(4, .1, .9, i => `armR.r${[-60, -130, -40, -100][i]} armL.r${[20, 60, 120, 30][i]} head.r${[-8, 6, -6, 8][i]}`)}|1=`] });
K('duet-copycat', 2400, '0=|0.2=armR.r-130 head.r8|0.5=armR.r-130 head.r8|1=', { roles: ['0=|0.45=eye.x-2|0.65=armL.r130 head.r-8|0.95=armL.r130 head.r-8|1='] });
K('duet-interrupt-bow', 2200, '0=|0.3=body.r24 body.y2 head.r20|0.65=body.r24 body.y2 head.r20|1=', { roles: [`0=|0.4=root.x-1.5|0.55=root.x-1.5 body.sx1.12 body.sy1.12 ${ARMS_OUT}|0.85=root.x-1.5 eye.sy.6|1=`] });
K('duet-pass-item', 2400, '0=prop.o1 prop.y-3|0.3=armR.r-70 prop.x6|0.55=prop.x10 prop.o1|0.6=prop.o0|1=', { prop: 'item', roles: ['0=prop.o0|0.55=armL.r70 prop.o1 prop.x-10 prop.y-3|0.75=prop.o1 prop.x-3 prop.y-4|1=prop.o0'] });
K('duet-both-grab-item', 2000, '0=|0.3=armR.r-70 root.x1.5 eye.sy1.2|0.5=armR.r-80 root.x1.7|0.75=armR.r-70 head.r-8|1=', { prop: 'item', roles: ['0=|0.3=armL.r70 root.x-1.5 eye.sy1.2|0.5=armL.r80 root.x-1.7|0.75=armL.r70 head.r8|1='] });
K('duet-argue-over-map', 2800, `0=prop.o1|${rep(5, .1, .9, i => `armR.r${i % 2 ? -100 : -60} head.r${i % 2 ? 8 : -6} prop.o1 body.r${i % 2 ? 3 : -3}`)}|1=prop.o0`, { prop: 'map', roles: [`0=|${rep(5, .1, .9, i => `armL.r${i % 2 ? 60 : 100} head.r${i % 2 ? -8 : 6} body.r${i % 2 ? -3 : 3}`)}|1=`] });
K('duet-whisper-secret', 2400, '0=|0.2=body.r-8 head.r-12 root.x-.5|0.7=body.r-8 head.r-12 root.x-.5 armR.r-45|1=', { roles: ['0=|0.3=head.r6|0.55=head.r6 eye.sy1.5 body.sy1.1 root.y-2|0.8=body.sy1.05 eye.sy1.3|1='] });
K('duet-shared-confusion', 1800, '0=|0.25=head.r-16 eye.sy.4|0.5=head.r-16 eye.sy1.2|0.75=head.r12|1=', { roles: ['0=|0.25=head.r16 eye.sy.4|0.5=head.r16 eye.sy1.2|0.75=head.r-12|1='] });
K('duet-accidental-sync', 1700, '0=|0.3=root.y-4 body.sy1.08|0.6=root.y0 body.sy.92 eye.sy1.2|0.85=eye.x2 head.r8|1=', { roles: ['0=|0.3=root.y-4 body.sy1.08|0.6=root.y0 body.sy.92 eye.sy1.2|0.85=eye.x-2 head.r-8|1='] });
K('duet-highfive-miss', 2000, '0=|0.3=armR.r-130 root.x1|0.4=armR.r-140 root.x1.6|0.55=armR.r-60 body.r10 root.x2|0.8=body.r-4 root.x.6 eye.sy.6|1=', { roles: ['0=|0.3=armL.r115 root.x-1|0.4=armL.r120|0.6=armL.r50 eye.sy1.2|1='] });
K('duet-highfive-perfect', 1300, '0=|0.3=armR.r-125 root.x1|0.5=armR.r-130 root.x1.5 root.y-2.5 eye.sy1.2|0.8=armR.r-50|1=', { roles: ['0=|0.3=armL.r125 root.x-1|0.5=armL.r130 root.x-1.5 root.y-2.5 eye.sy1.2|0.8=armL.r50|1='] });
K('duet-help-up', 2400, '0=root.r-88 root.y3|0.35=root.r-88 root.y3 armR.r-140|0.65=root.r-30 root.y1|0.85=root.r-6|1=', { roles: ['0=|0.3=root.x2.2 legs.r14 armR.r-70|0.5=armR.r-80 body.r8 root.x2|0.8=armR.r-30 root.x1.8|1='], solid: true });
K('duet-tug-and-release', 2000, `0=|${rep(4, .1, .7, i => `root.x${i % 2 ? .6 : 1.6} body.r-12 armL.r60 armR.r-60`)}|0.82=root.x-2 body.r-24 root.y-1|1=`, { prop: 'item', roles: [`0=|${rep(4, .1, .7, i => `root.x${i % 2 ? -.6 : -1.6} body.r12 armL.r60 armR.r-60`)}|0.82=root.x2 body.r24|1=`] });
K('duet-spin-partner', 2200, '0=|0.2=armR.r-90 root.x1|0.5=armR.r-95 root.r360 root.x1|0.8=armR.r-60|1=root.r360', { roles: ['0=|0.2=armL.r90 root.x-1|0.5=armL.r95 root.r-360 root.x-1|0.8=armL.r60|1=root.r-360'] });
K('duet-group-stack', 2800, '0=|0.3=body.sy.84|0.6=body.sy.92 armL.r90 armR.r-90|0.85=body.sy.92 armL.r90 armR.r-90|1=', { roles: [`0=|0.4=root.y-2|0.65=root.y-12 root.x.5 body.sy1.05|0.88=root.y-12 root.x.5 ${ARMS_OUT}|1=`, `0=|0.55=root.y-2|0.8=root.y-22 root.x-.5 body.sy1.1|0.92=root.y-22 root.x-.5 ${ARMS_UP}|1=`], solid: true });
K('trio-see-saw', 3000, `0=|${rep(4, .1, .9, i => `body.r${i % 2 ? 12 : -12} root.y${i % 2 ? -1 : 2}`)}|1=`, { roles: [`0=|${rep(4, .1, .9, i => `body.r${i % 2 ? -12 : 12} root.y${i % 2 ? 2 : -1}`)}|1=`, `0=|0.2=root.y-5 root.x2|${rep(3, .3, .85, i => `root.y-5 root.x2 ${ARMS_OUT} body.r${i % 2 ? 4 : -4}`)}|1=`], solid: true });
K('trio-pass-the-blame', 2800, `0=|0.2=armR.r-90 eye.x3 eye.sy.7|0.4=armR.r-90 eye.x3|0.6=${ARMS_OUT} head.r6|1=`, { roles: ['0=|0.4=armL.r90 armR.r-30 eye.sy1.3|0.6=armR.r-100 eye.x3 eye.sy.7|1=', '0=|0.55=armL.r-30 eye.x-2 head.r-6|0.8=armL.r90 eye.sy1.3 head.r6|1='] });
K('trio-group-photo', 2600, '0=|0.2=body.sy1.06 head.r-4|0.8=body.sy1.06 head.r-4 armR.r-30|0.88=eye.sy.1|1=', { roles: ['0=|0.3=body.sy1.04 armL.r140 armR.r-140|0.8=armL.r140 armR.r-140|0.88=eye.sy.1|1=', '0=|0.3=body.sy1.05 head.r5|0.8=body.sy1.05 head.r5|0.88=eye.sy.1|1='] });
K('trio-group-bow', 2400, '0=|0.35=body.r22 body.y2 head.r18|0.65=body.r22 body.y2 head.r18|1=', { roles: ['0=|0.33=body.r26 body.y2 head.r20|0.63=body.r26 body.y2 head.r20|1=', '0=|0.4=body.r18 body.y2 head.r14|0.7=body.r18 body.y2|1='] });

/* ── 12 entrances / exits / transformations ──────────────────────── */
K('entrance-peek-edge', 1800, '0=root.x-10 root.o0|0.3=root.x-6 root.o1 head.r-14|0.55=root.x-5.5 head.r-14 eye.sy1.3|0.8=root.x0 root.o1|1=', { solid: true });
K('entrance-small-hop', 1300, '0=root.x-8 root.o0|0.15=root.o1|0.45=root.x-3 root.y-6|0.7=root.x-1 root.y0 body.sy.9|1=', { solid: true });
K('entrance-drop-in', 1500, '0=root.y-40 root.o0|0.1=root.o1|0.5=root.y0 body.sy.76 body.sx1.18|0.75=body.sy1.08|1=', { solid: true });
K('entrance-walk-on', 1700, `0=root.x-9 root.o0|0.1=root.o1|${steps(4, 1.2, 2, 14, '')}|1=`, { solid: true });
K('entrance-slide-in', 1100, '0=root.x-12 root.o0|0.15=root.o1|0.7=root.x1 body.r-8|0.9=root.x0 body.r2|1=', { solid: true });
K('entrance-crawl-in', 2000, `0=root.x-9 root.o0 body.sy.6|0.12=root.o1|${rep(4, .2, .9, i => `root.x${-7 + i * 2} body.sy.62 legs.r${i % 2 ? -18 : 18}`)}|1=`, { solid: true });
K('entrance-arrive-with-prop', 2000, `0=root.x-10 root.o0 prop.o1 prop.y-4|0.12=root.o1|${steps(4, 1.2, 2, 14, 'prop.o1 prop.y-4 armR.r-55')}|1=prop.o1 prop.y-4`, { prop: 'item', solid: true });
K('entrance-intro-spin', 1500, `0=root.o0 root.y-6|0.15=root.o1|0.55=root.r360 root.y-4|0.8=root.r360 root.y0 body.sy.92|0.9=${ARMS_OUT}|1=root.r360`, { solid: true });
K('exit-wave', 1700, `0=|0.2=armR.r-135|${wave(3, '')}|0.85=root.x-2|1=root.x-8 root.o0`, { solid: true });
K('exit-backwards-walk', 1700, `0=|${steps(4, 1, 2, 12, 'head.r-8 eye.x2')}|0.96=root.o.4|1=root.o0`, { solid: true });
K('exit-hide-behind-edge', 1500, '0=|0.3=root.x-3 body.sy.9|0.6=root.x-7 head.r-12 eye.sy1.2|0.85=root.x-9 root.o.3|1=root.x-10 root.o0', { solid: true });
K('exit-tiny-portal', 1900, '0=prop.o0|0.2=prop.o1 prop.y3|0.5=root.y2 body.sy.4 body.sx.5 prop.o1|0.75=root.y4 root.o0 prop.o.7|1=prop.o0 root.o0', { prop: 'portal', solid: true });
K('exit-follow-peer', 1800, `0=|0.2=eye.x-3 head.r-8|${steps(3, 1, 2, 14, '')}|0.95=root.o.3|1=root.x-9 root.o0`, { solid: true, roles: [`0=|${steps(3, 1.2, 2, 16, '')}|0.9=root.o.3|1=root.x-10 root.o0`] });
K('exit-group-parade', 2400, `0=|${steps(5, 1.6, 2, 18, 'armR.r-110')}|0.92=root.o.4|1=root.x-10 root.o0`, { solid: true, roles: [`0=|${steps(5, 1.6, 2, 18, 'armL.r110')}|0.92=root.o.4|1=root.x-10 root.o0`, `0=|${steps(5, 1.3, 1, 12, '')}|0.92=root.o.4|1=root.x-10 root.o0`] });
K('transform-alert-mode', 1100, '0=|0.2=body.sy1.08 eye.sy1.4 head.y-1 legs.sy1.1|0.8=body.sy1.06 eye.sy1.3 head.y-.8 legs.sy1.1|1=');
K('transform-focus-mode', 1400, '0=|0.3=eye.sy.55 eye.sx1.15 head.r-5 body.sy.97 root.x.6|0.9=eye.sy.55 eye.sx1.15 head.r-5 body.sy.97|1=');
K('transform-celebration-mode', 1600, `0=|0.25=${ARMS_OUT} body.sy1.06 eye.sy1.3 tail.r18|0.6=${ARMS_UP} root.y-3 tail.r-18|0.9=${ARMS_OUT} root.y0|1=`);
K('transform-sleep-mode', 2600, '0=|0.4=body.sy.78 body.sx1.12 head.y3 head.r14 eye.sy.08 legs.sy.6|1=body.sy.78 body.sx1.12 head.y3 head.r14 eye.sy.08 legs.sy.6', { solid: true });
K('transform-costume-reveal', 2200, `0=prop.o0|0.2=body.sy.9 prop.o1 prop.y-5 armR.r-70|0.5=body.sy1.05 prop.o1 prop.y-3 root.r360|0.75=prop.o1 ${ARMS_OUT}|1=prop.o0`, { prop: 'cosmetic' });
K('transform-unlock-evolution', 4000, seq([1.2, '0=|0.5=body.sy.8 body.sx1.1 eye.sy.2|1=body.sy.78 body.sx1.12 eye.sy.2'], [1.4, '0=body.sy.78 body.sx1.12 eye.sy.2|0.5=body.sx1.5 body.sy1.5 root.o.5 root.y-4|1=body.sx.2 body.sy.2 root.o0'], [1.1, `0=body.sx.2 body.sy.2 root.o0|0.5=root.o1 body.sx1.3 body.sy1.3 root.y-6 ${ARMS_UP}|1=root.y-3 ${ARMS_UP}`], [1, `0=${ARMS_UP} root.y-3|0.5=root.r360 root.y0 body.sy.9|1=root.r360`]), { solid: true });

/* clips that end hidden or off-stage keep their last pose until the creature's next clip begins (otherwise it would pop back into view) */
for (const id of ['prank-hide-inventory', 'prank-portal-dive', 'exit-tiny-portal', 'exit-hide-behind-edge', 'exit-wave', 'exit-backwards-walk', 'exit-follow-peer', 'exit-group-parade', 'screen-disappear', 'screen-fall-off', 'adv-dramatic-exit']) {
  const c = BY_ID.get(id);
  if (c) c.holdEnd = true;
}

export { CLIPS };
export const CLIP_IDS: readonly string[] = CLIPS.map(c => c.id);
export const getClip = (id: string): ClipDef | undefined => BY_ID.get(id);
export const clipRegistry: ReadonlyMap<string, ClipDef> = BY_ID;
