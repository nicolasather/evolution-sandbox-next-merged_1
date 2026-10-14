import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* Phase 2 ticket 097/100: the curated Humanity Museum is never touched by generated content.
   (1) static: no museum source can import the creative sidecar, mode packets, or any generated-content file;
   (2) golden digest: any edit to data/museum (an "AI-published exhibit", a moved gate) changes the digest and fails here,
       so a curated-exhibit change is always a deliberate, reviewed edit that also updates this file. */
const walk = (d: string, ext: (f: string) => boolean): string[] =>
  readdirSync(d).sort().flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (f === '__tests__' ? [] : walk(p, ext)) : ext(p) ? [p] : []; });
const root = join(__dirname, '..', '..', '..');

describe('museum isolation (Phase 2)', () => {
  it('no lib/museum or museum component imports lib/server/creative, lib/modes/packets, mode_packets, alt_routes or visuals_assets', () => {
    const files = [...walk(join(root, 'lib', 'museum'), f => f.endsWith('.ts') || f.endsWith('.tsx')),
      ...readdirSync(join(root, 'components')).filter(f => /museum/i.test(f)).map(f => join(root, 'components', f)).filter(f => statSync(f).isFile())];
    expect(files.length).toBeGreaterThan(3);
    for (const f of files) expect(readFileSync(f, 'utf8')).not.toMatch(/server\/creative|modes\/packets|mode_packets|alt_routes|visuals_assets|lib\/creative|releaseManifest/);
  });
  it('the AI sidecar and admin routes never import the museum', () => {
    for (const f of walk(join(root, 'lib', 'server', 'creative'), f => f.endsWith('.ts') && !f.includes('__tests__'))) expect(readFileSync(f, 'utf8')).not.toMatch(/lib\/museum|data\/museum/);
  });
  it('data/museum content digest is the reviewed baseline', () => {
    const h = createHash('sha256');
    for (const f of walk(join(root, 'data', 'museum'), () => true)) h.update(f.slice(root.length).replace(/\\/g, '/')).update(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
    expect(h.digest('hex')).toBe('95c8828429667c2e1835eb003393629c7bb75a7f85bc691cbd61c2aa018fb553');
  });
});
