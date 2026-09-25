import majorsJson from '@/data/majors.json';
import type { Db, EraId } from '../types';
import type { GeoId, Major, MajorDef, MajorsFile, EraProgress, RegionProgress, WorldSummary } from './types';

/* ============================================================================
   REGISTRY — the catalogue of major inventions, joined to the database.

   Built once per engine. An entry whose node is not in the database is
   dropped (so small test databases and old data never leave an era locked
   behind something that cannot be made), and an era with nothing required
   never blocks the next one.
   ========================================================================== */

export const majorsFile = majorsJson as unknown as MajorsFile;

const defaultMarker = (d: MajorDef): 'pin' | 'ring' | 'halo' =>
  d.marker ?? (d.precision === 'site' ? 'pin' : d.precision === 'area' ? 'ring' : 'halo');

export class WorldModel {
  /** Every major, in catalogue order. */
  readonly majors: Major[];
  readonly byId = new Map<string, Major>();
  readonly eras: { id: EraId; name: string }[];
  readonly eraIndex = new Map<EraId, number>();
  readonly regions: { id: GeoId; name: string }[];
  /** era → required major ids */
  readonly required = new Map<EraId, string[]>();
  /** era → every major id (required, optional and hidden) */
  readonly inEra = new Map<EraId, string[]>();

  constructor(db: Pick<Db, 'nodes' | 'eras'>, file: MajorsFile = majorsFile) {
    const nodes = new Map(db.nodes.map(n => [n.id, n]));
    this.eras = db.eras.map(e => ({ id: e.id, name: e.name }));
    this.eras.forEach((e, i) => { this.eraIndex.set(e.id, i); this.required.set(e.id, []); this.inEra.set(e.id, []); });
    this.regions = file.regions;
    this.majors = [];
    for (const d of file.majors) {
      const n = nodes.get(d.id);
      if (!n || n.state || this.byId.has(d.id)) continue;
      const m: Major = {
        ...d,
        name: d.displayName ?? n.n,
        era: n.era,
        hidden: !!n.hidden,
        date: n.date,
        ds: n.ds,
        marker: defaultMarker(d),
        // a hidden node can never be what an era waits on
        required: d.required && !n.hidden,
      };
      this.majors.push(m);
      this.byId.set(m.id, m);
      this.inEra.get(m.era)?.push(m.id);
      if (m.required) this.required.get(m.era)?.push(m.id);
    }
  }

  isMajor(id: string): boolean { return this.byId.has(id); }
  get(id: string): Major | undefined { return this.byId.get(id); }
  get size(): number { return this.majors.length; }
  get requiredTotal(): number { return this.majors.filter(m => m.required).length; }

  /** The era after `era`, or null at the end. */
  nextEra(era: EraId): EraId | null {
    const i = this.eraIndex.get(era);
    return i === undefined ? null : this.eras[i + 1]?.id ?? null;
  }

  eraName(era: EraId): string { return this.eras[this.eraIndex.get(era) ?? 0]?.name ?? era; }

  /** Whether every required major of `era` is in `found`. An era with none required is complete. */
  eraComplete(era: EraId, found: ReadonlySet<string>): boolean {
    for (const id of this.required.get(era) ?? []) if (!found.has(id)) return false;
    return true;
  }

  /**
   * Whether new discoveries of era `index` can be made: the first era always;
   * an era below the save's floor (ground an older save already stands on);
   * otherwise the era before it must be open and complete.
   */
  isOpen(index: number, found: ReadonlySet<string>, floor = 0): boolean {
    for (let i = 1; i <= index; i++) {
      if (i <= floor) continue;
      if (!this.eraComplete(this.eras[i - 1].id, found)) return false;
    }
    return true;
  }

  /** The first era, before `index`, that still has to be finished — what a locked recipe is waiting on. */
  blocker(index: number, found: ReadonlySet<string>, floor = 0): EraId | null {
    for (let i = 1; i <= index; i++) {
      if (i <= floor) continue;
      const prev = this.eras[i - 1].id;
      if (!this.eraComplete(prev, found)) return prev;
    }
    return null;
  }

  eraProgress(era: EraId, found: ReadonlySet<string>, floor = 0): EraProgress {
    const index = this.eraIndex.get(era) ?? 0;
    let required = 0, requiredDone = 0, optional = 0, optionalDone = 0, hidden = 0, hiddenDone = 0;
    for (const id of this.inEra.get(era) ?? []) {
      const m = this.byId.get(id)!;
      const done = found.has(id);
      if (m.required) { required++; if (done) requiredDone++; }
      else if (m.hidden) { hidden++; if (done) hiddenDone++; }
      else { optional++; if (done) optionalDone++; }
    }
    return {
      era, index, name: this.eraName(era),
      required, requiredDone, optional, optionalDone, hidden, hiddenDone,
      percent: required ? Math.round((requiredDone / required) * 100) : 100,
      complete: requiredDone >= required,
      open: this.isOpen(index, found, floor),
    };
  }

  summary(found: ReadonlySet<string>): WorldSummary {
    let f = 0, req = 0, reqDone = 0, hiddenLeft = 0;
    const perGeo = new Map<GeoId, { found: number; total: number }>();
    for (const m of this.majors) {
      const done = found.has(m.id);
      if (done) f++;
      if (m.required) { req++; if (done) reqDone++; }
      if (m.hidden && !done) hiddenLeft++;
      if (m.geo === 'global') continue;
      const g = perGeo.get(m.geo) ?? { found: 0, total: 0 };
      g.total++; if (done) g.found++;
      perGeo.set(m.geo, g);
    }
    const regions: RegionProgress[] = this.regions
      .filter(r => r.id !== 'global')
      .map(r => ({ id: r.id, name: r.name, found: perGeo.get(r.id)?.found ?? 0, total: perGeo.get(r.id)?.total ?? 0 }));
    return {
      found: f, total: this.majors.length, requiredFound: reqDone, requiredTotal: req, hiddenLeft,
      regions, regionsRepresented: regions.filter(r => r.found > 0).length, regionsTotal: regions.filter(r => r.total > 0).length,
    };
  }

  /** The major found immediately before `id` in the order things were found, or null. */
  previousOf(id: string, order: readonly string[]): Major | null {
    const at = order.indexOf(id);
    for (let i = (at < 0 ? order.length : at) - 1; i >= 0; i--) {
      const m = this.byId.get(order[i]);
      if (m) return m;
    }
    return null;
  }

  /** Majors in the order they were found. */
  foundInOrder(order: readonly string[]): Major[] {
    const out: Major[] = [];
    for (const id of order) { const m = this.byId.get(id); if (m) out.push(m); }
    return out;
  }
}

/** The world model for the database the game plays. */
export function buildWorldModel(db: Pick<Db, 'nodes' | 'eras'>, file: MajorsFile = majorsFile): WorldModel {
  return new WorldModel(db, file);
}
