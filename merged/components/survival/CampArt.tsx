'use client';

import { Plate3D } from '@/components/Plate3D';
import { personSvg, poseFor, skyFor, skySvg, type Pose } from '@/lib/survival/plateArt';
import type { Period, TaskKind } from '@/lib/survival/types';

/* The camp's drawings, rendered by the same Plate3D used for discoveries (floating wireframe,
   spark colour and theme tokens included). Each drawing has a stable key so its model is cached. */

/** The sky for the current part of the day: a floating plate with a one-line reading under it. */
export function CampSky({ period }: { period: Period }) {
  const sky = skyFor(period);
  return (
    <figure className="sv-sky" data-primer="sky" data-period={period}>
      <div className="sv-plate">
        <Plate3D node={{ id: `sv-sky-${sky.art}`, vis: 'sv', cat: 'sv' }} svg={skySvg(sky.art)} variant="card" label={`${sky.label}: ${sky.line}`} />
      </div>
      <figcaption>
        <span className="mono sv-sky-name">{sky.label}</span>
        <span className="sv-sky-line">{sky.line}</span>
      </figcaption>
    </figure>
  );
}

const POSE_NAME: Record<Pose, string> = { stand: 'standing', carry: 'carrying water', work: 'working', raise: 'chopping or building', rest: 'resting' };

/** One person as a floating figure, posed for what they are doing right now. */
export function CampPerson({ name, task, injured }: { name: string; task?: TaskKind; injured?: boolean }) {
  const pose = poseFor(task, injured);
  return (
    <div className="sv-person">
      <div className="sv-plate sv-plate-person">
        <Plate3D node={{ id: `sv-person-${pose}`, vis: 'sv', cat: 'sv' }} svg={personSvg(pose)} variant="card" label={`${name}, ${POSE_NAME[pose]}`} />
      </div>
    </div>
  );
}
