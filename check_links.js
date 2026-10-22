const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'merged');

// 1. enumerate routes
const appDir = path.join(root, 'app');
function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith('_') || e.name === '__tests__' || e.name === 'node_modules') continue;
      walk(p, out);
    } else out.push(p);
  }
  return out;
}
const appFiles = walk(appDir, []);
const routes = new Set(); // literal routes
const dynamic = []; // patterns
for (const f of appFiles) {
  const rel = path.relative(appDir, f).split(path.sep).join('/');
  const isPage = /(^|\/)page\.(tsx|ts|jsx|js)$/.test(rel);
  const isRoute = /(^|\/)route\.(tsx|ts|jsx|js)$/.test(rel);
  if (!isPage && !isRoute) continue;
  let r = rel.replace(/(^|\/)(page|route)\.(tsx|ts|jsx|js)$/, '');
  r = r.replace(/\/$/, '');
  if (r === '') r = '/';
  routes.add(r);
}
// also non-page special files that are routable
console.log('=== ROUTES ===');
[...routes].sort().forEach(r => console.log(r));

// build matcher
function routeMatches(target) {
  const clean = target.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  if (routes.has(clean)) return true;
  if (routes.has(clean.replace(/^\//, ''))) return true;
  for (const r of routes) {
    if (!r.includes('[')) continue;
    const re = new RegExp('^' + r.split('/').map(seg => seg.startsWith('[') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '$');
    if (re.test(clean)) return true;
  }
  return false;
}

// 2. scan for navigation targets
const scanRoots = ['app', 'components', 'lib'];
const navRe = /(?:href|to|src|push|replace|assign|redirect)\s*[:=(]\s*[`'"]([^`'"$]*)\/?[`'"]/g;
const results = [];
for (const sr of scanRoots) {
  const dir = path.join(root, sr);
  for (const f of walk(dir, [])) {
    if (!/\.(tsx|ts|jsx|js)$/.test(f)) continue;
    if (f.includes('__tests__') || f.includes('node_modules')) continue;
    const content = fs.readFileSync(f, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      let m;
      const re = /['"`]((?:https?:\/\/[^'"`]*)|(\/(?:api|quiz|sandbox|method|faq|privacy|terms|admin)[^'"`\s]*))['"`]/g;
      while ((m = re.exec(line)) !== null) {
        const t = m[1];
        if (/^https?:/.test(t)) continue;
        if (!t.startsWith('/')) continue;
        results.push({ file: path.relative(root, f), line: i + 1, target: t, text: line.trim() });
      }
    });
  }
}
console.log('\n=== BROKEN TARGETS (not matching any route) ===');
const seen = new Set();
for (const r of results) {
  const key = r.file + r.line + r.target;
  if (seen.has(key)) continue;
  seen.add(key);
  if (!routeMatches(r.target)) {
    console.log(`${r.file}:${r.line}  ${r.target}\n    ${r.text.slice(0, 200)}`);
  }
}
