import { clamp, E, ellipse, lerp, line, poly, rng, smooth, type Elem, type Pt } from '../geom';
import { bool, defineComponent, int, num, nums, oneOf, pts, req, type ComponentDef } from '../params';

/* Solids of revolution, tubes, blades, knapped stone and crystals — the families that
   make a pot, a telescope, a spearhead and a pebble read as different objects. */

export const lathe = defineComponent<{
  profile: Pt[]; sharp: boolean; rim: string; tilt: number; bands: number[]; inner: boolean;
}>({
  id: 'lathe', group: 'solid',
  doc: 'surface of revolution from a side profile [[radius, y], ...] listed top→bottom (y grows downward). Pots, cups, amphorae, bottles, bells, lamps, hourglass halves, flasks',
  params: {
    profile: pts(3, 14, 80, 'each point is [radius, y]; radius is the half-width at that height'),
    sharp: bool(false, 'true = straight segments between points (cups, bricks); false = smooth curve'),
    rim: oneOf(['open', 'flat', 'none'], 'open'),
    tilt: num(0.05, 0.5, 0.22, { doc: 'how far the rim/base ellipses are opened (perspective)' }),
    bands: nums(0, 6, -80, 80, [], 'y values where a decorative ring/rib is drawn'),
    inner: bool(false, 'draw the inner wall at the rim (thin-walled vessels)'),
  },
  draw: p => {
    const prof: Pt[] = [...p.profile].map(([r, y]): Pt => [Math.abs(r), y]).sort((a, b) => a[1] - b[1]);
    const side = (s: number) => {
      const q = prof.map(([r, y]): Pt => [r * s, y]);
      return p.sharp ? poly(q) : smooth(q);
    };
    const out: Elem[] = [E(side(1)), E(side(-1))];
    const [rt, yt] = prof[0];
    const [rb, yb] = prof[prof.length - 1];
    if (p.rim === 'open' && rt > 0.6) {
      out.push(E(ellipse(0, yt, rt, rt * p.tilt)));
      if (p.inner) out.push(E(ellipse(0, yt, rt * 0.86, rt * 0.86 * p.tilt), 'fine', 0.7));
    } else if (p.rim === 'flat' && rt > 0.6) out.push(E(line(-rt, yt, rt, yt)));
    if (rb > 0.6) out.push(E(ellipse(0, yb, rb, rb * p.tilt, 0, 180)));
    const rAt = (y: number): number => {
      if (y <= prof[0][1]) return prof[0][0];
      for (let i = 1; i < prof.length; i++) {
        if (y <= prof[i][1]) {
          const span = prof[i][1] - prof[i - 1][1] || 1;
          return lerp(prof[i - 1][0], prof[i][0], (y - prof[i - 1][1]) / span);
        }
      }
      return prof[prof.length - 1][0];
    };
    for (const y of p.bands) {
      if (y > yt && y < yb) { const r = rAt(y); if (r > 0.6) out.push(E(ellipse(0, y, r, r * p.tilt, 0, 180), 'fine', 0.8)); }
    }
    return out;
  },
});

export const tube = defineComponent<{
  len: number; r0: number; r1?: number; flare: number; cap0: string; cap1: string; rings: number; tilt: number;
}>({
  id: 'tube', group: 'solid',
  doc: 'cylinder / cone / horn lying along the local x axis (rotate it with rot). Barrels, pipes, shafts, rods, chimneys (rot 90), horns (flare>1), pestles, spindles',
  params: {
    len: req(4, 140), r0: req(0.5, 45, 'radius at the left end'), r1: num(0.5, 45, undefined, { doc: 'radius at the right end (default = r0)' }),
    flare: num(0.3, 5, 1, { doc: '1 = straight cone, >1 = trumpet/horn flare, <1 = bulge' }),
    cap0: oneOf(['flat', 'open', 'dome', 'none'], 'flat'), cap1: oneOf(['flat', 'open', 'dome', 'none'], 'flat'),
    rings: int(0, 10, 0, { doc: 'evenly spaced bands/ferrules/joints' }), tilt: num(0.1, 0.6, 0.28),
  },
  draw: p => {
    const r1 = p.r1 ?? p.r0, L = p.len;
    const rAt = (t: number) => p.r0 + (r1 - p.r0) * Math.pow(t, p.flare);
    const top: Pt[] = [], bot: Pt[] = [];
    for (let i = 0; i <= 18; i++) { const t = i / 18, x = -L / 2 + t * L, r = rAt(t); top.push([x, -r]); bot.push([x, r]); }
    const out: Elem[] = [E(smooth(top)), E(smooth(bot))];
    const cap = (x: number, r: number, side: 1 | -1, kind: string) => {
      if (kind === 'none') return;
      if (kind === 'open' || (kind === 'flat' && side === 1)) out.push(E(ellipse(x, 0, r * p.tilt, r)));
      else if (kind === 'flat') out.push(E(ellipse(x, 0, r * p.tilt, r, 90, 270)));
      else out.push(E(side === 1 ? ellipse(x, 0, r * 0.8, r, -90, 90) : ellipse(x, 0, r * 0.8, r, 90, 270)));
    };
    cap(-L / 2, p.r0, -1, p.cap0);
    cap(L / 2, r1, 1, p.cap1);
    for (let k = 1; k <= p.rings; k++) {
      const t = k / (p.rings + 1), r = rAt(t);
      out.push(E(ellipse(-L / 2 + t * L, 0, r * p.tilt, r, 90, 270), 'fine', 0.85));
    }
    return out;
  },
});

export const blade = defineComponent<{
  len: number; w: number; curve: number; tip: string; base: string; midrib: boolean; bevel: boolean; teeth: number; belly: number;
}>({
  id: 'blade', group: 'solid',
  doc: 'leaf-shaped edge pointing right: spearhead, knife, dagger, arrowhead, sickle (curve), saw (teeth), leaf. base = tang|socket|flat|round',
  params: {
    len: req(10, 130), w: req(3, 60), curve: num(-1, 1, 0), tip: oneOf(['point', 'round', 'chisel'], 'point'),
    base: oneOf(['tang', 'socket', 'flat', 'round'], 'tang'), midrib: bool(true), bevel: bool(false),
    teeth: int(0, 24, 0), belly: num(0.15, 0.85, 0.4, { doc: 'where the blade is widest, 0 = base, 1 = tip' }),
  },
  draw: p => {
    const L = p.len, hw = p.w / 2;
    const a = Math.log(0.5) / Math.log(clamp(p.belly, 0.15, 0.85));
    const floor = p.base === 'round' ? 0 : p.base === 'socket' ? 0.5 : 0.32;
    const f = (t: number) => {
      let v = Math.sin(Math.PI * Math.pow(t, a));
      if (p.tip === 'round') v = Math.pow(Math.max(v, 0), 0.6);
      return hw * Math.max(v, floor * Math.max(0, 1 - t / 0.35));
    };
    const spine = (t: number) => p.curve * hw * 1.4 * Math.sin(Math.PI * t);
    const tEnd = p.tip === 'chisel' ? 0.94 : 1;
    const X = (t: number) => -L / 2 + t * L;
    const edge = (s: number, k = 1, t0 = 0, t1 = tEnd): Pt[] =>
      Array.from({ length: 21 }, (_, i): Pt => { const t = lerp(t0, t1, i / 20); return [X(t), spine(t) + s * f(t) * k]; });
    const top = edge(-1), bot = edge(1);
    const out: Elem[] = [E(smooth(top)), E(smooth(bot))];
    if (p.tip === 'chisel') out.push(E(line(top[20][0], top[20][1], bot[20][0], bot[20][1])));
    const x0 = X(0);
    if (p.base === 'flat' || p.base === 'tang') out.push(E(line(top[0][0], top[0][1], bot[0][0], bot[0][1])));
    if (p.base === 'tang') {
      const tw = Math.max(1, hw * 0.16), tl = L * 0.2;
      out.push(E(poly([[x0, -tw], [x0 - tl, -tw], [x0 - tl, tw], [x0, tw]])));
    } else if (p.base === 'socket') {
      const bw = Math.max(1.5, f(0)), sl = L * 0.22;
      out.push(E(line(x0, -bw, x0 - sl, -bw * 0.92)), E(line(x0, bw, x0 - sl, bw * 0.92)), E(ellipse(x0 - sl, 0, bw * 0.3, bw * 0.92)));
      out.push(E(ellipse(x0, 0, bw * 0.3, bw), 'fine', 0.7));
    }
    if (p.midrib) out.push(E(smooth(Array.from({ length: 12 }, (_, i): Pt => { const t = lerp(0.06, 0.9, i / 11); return [X(t), spine(t)]; })), 'fine', 0.75));
    if (p.bevel) { out.push(E(smooth(edge(-1, 0.55, 0.1, 0.88)), 'fine', 0.6), E(smooth(edge(1, 0.55, 0.1, 0.88)), 'fine', 0.6)); }
    if (p.teeth > 0) {
      const pts: Pt[] = [];
      for (let k = 0; k <= p.teeth; k++) {
        const t = lerp(0.18, 0.95, k / p.teeth), t2 = lerp(0.18, 0.95, (k + 0.5) / p.teeth);
        pts.push([X(t), spine(t) + f(t)]);
        if (k < p.teeth) pts.push([X(t2), spine(t2) + f(t2) + Math.max(1.2, hw * 0.18)]);
      }
      out.push(E(poly(pts), 'fine'));
    }
    return out;
  },
});

export const facets = defineComponent<{
  rx: number; ry?: number; verts: number; jag: number; seed: number; smooth: boolean; pear: number;
  scars: number; ripples: number; bifacial: boolean;
}>({
  id: 'facets', group: 'solid',
  doc: 'knapped / natural stone outline with flake scars. pebble = smooth:true; flake = few verts + ripples; handaxe = pear + bifacial; nodule = jag high; clay lump, resin, gourd body',
  params: {
    rx: req(3, 60), ry: num(3, 60), verts: int(5, 14, 8), jag: num(0, 1, 0.4), seed: int(0, 9999, 1), smooth: bool(false),
    pear: num(-0.8, 0.8, 0, { doc: '>0 narrows the top (teardrop / handaxe)' }), scars: int(0, 10, 3), ripples: int(0, 8, 0), bifacial: bool(false),
  },
  draw: p => {
    const rnd = rng(p.seed), n = p.verts, ry = p.ry ?? p.rx;
    const outline: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 + (rnd() - 0.5) * 0.5 * p.jag * ((Math.PI * 2) / n);
      const k = 1 + (rnd() - 0.5) * p.jag * 0.8;
      const y = Math.sin(a) * ry * k, sx = 1 - p.pear * (-y / ry) * 0.5;
      outline.push([Math.cos(a) * p.rx * k * sx, y]);
    }
    const body = p.smooth ? smooth(outline, true) : poly(outline, true);
    const out: Elem[] = [E(body, 'main')];
    for (let s = 0; s < p.scars; s++) {
      const c: Pt = [(rnd() - 0.5) * p.rx * 0.5, (rnd() - 0.5) * ry * 0.5];
      const v = outline[(s * 3 + 1) % n];
      const mid: Pt = [(c[0] + v[0]) / 2 + (rnd() - 0.5) * 3, (c[1] + v[1]) / 2 + (rnd() - 0.5) * 3];
      out.push(E(smooth([c, mid, v]), 'fine', 0.75));
    }
    if (p.ripples > 0) {
      const b0 = Math.floor(rnd() * n);
      for (let j = 1; j <= p.ripples; j++) {
        const f = 1 - 0.13 * j;
        const arc = [-1, 0, 1].map((d): Pt => { const v = outline[(b0 + d + n) % n]; return [v[0] * f, v[1] * f]; });
        out.push(E(smooth(arc), 'fine', 0.65));
      }
    }
    if (p.bifacial) {
      const inner = outline.map(([x, y]): Pt => [x * 0.68, y * 0.68]);
      out.push(E(poly(inner, true), 'fine', 0.7));
      outline.forEach((v, i) => out.push(E(line(v[0], v[1], inner[i][0], inner[i][1]), 'hair', 0.8)));
      out.push(E(line(0, -ry * 0.75, 0, ry * 0.75), 'hair', 0.7));
    }
    return out;
  },
});

export const crystal = defineComponent<{ w: number; h: number; tip: number; faces: number; seed: number }>({
  id: 'crystal', group: 'solid',
  doc: 'prismatic crystal: faceted column with a pointed termination and a rough broken base (quartz, salt, gem)',
  params: { w: req(6, 60), h: req(10, 120), tip: num(0.15, 0.6, 0.3), faces: int(3, 4, 3), seed: int(0, 9999, 3) },
  draw: p => {
    const rnd = rng(p.seed), hw = p.w / 2, top = -p.h / 2, sh = top + p.h * p.tip, bot = p.h / 2;
    const xs = p.faces === 3 ? [-hw, -hw * 0.42, hw * 0.42, hw] : [-hw, -hw / 2, 0, hw / 2, hw];
    const out: Elem[] = [];
    xs.forEach((x, i) => {
      const edge = i === 0 || i === xs.length - 1;
      out.push(E(line(x, sh, x, bot - rnd() * 2), edge ? 'main' : 'fine', edge ? 1 : 0.75));
      out.push(E(line(hw * 0.1, top, x, sh), edge ? 'main' : 'fine', edge ? 1 : 0.8));
    });
    out.push(E(poly(xs.map((x): Pt => [x, sh]))));
    const base: Pt[] = xs.map((x, i): Pt => [x, bot - (i === 0 || i === xs.length - 1 ? 0 : rnd() * 3)]);
    out.push(E(poly(base)));
    out.push(E(line(-hw * 0.2, sh + p.h * 0.18, hw * 0.12, sh + p.h * 0.5), 'hair', 0.55));
    return out;
  },
});

export const SOLIDS: ComponentDef[] = [lathe, tube, blade, facets, crystal];
