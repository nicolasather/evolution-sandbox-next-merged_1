const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'merged');

// Gather all migration files content
const migDirs = [
  path.join(root, 'supabase', 'migrations'),
  path.join(root, 'db', 'migrations')
];

let allMigrations = '';
migDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(f => {
      if (f.endsWith('.sql')) {
        allMigrations += '\n' + fs.readFileSync(path.join(dir, f), 'utf8');
      }
    });
  }
});

// Extract tables created: CREATE TABLE (IF NOT EXISTS)? ([schema\.]?table)
const tableMatches = [...allMigrations.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_"\.]+)/gi)];
const tables = new Set();
tableMatches.forEach(m => {
  let t = m[1].replace(/"/g, '').toLowerCase();
  if (t.includes('.')) t = t.split('.')[1];
  tables.add(t);
});

// Extract functions created: CREATE (OR REPLACE)? FUNCTION ([schema\.]?func)
const funcMatches = [...allMigrations.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_"\.]+)/gi)];
const functions = new Set();
funcMatches.forEach(m => {
  let f = m[1].replace(/"/g, '').toLowerCase();
  if (f.includes('.')) f = f.split('.')[1];
  functions.add(f);
});

console.log('Tables found in migrations:', [...tables].sort());
console.log('Functions found in migrations:', [...functions].sort());

// Scan API routes and server libs for .from('table') and .rpc('func')
function walk(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p, out);
    } else if (/\.(ts|tsx|js)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const scanFiles = walk(path.join(root, 'app', 'api'), []).concat(walk(path.join(root, 'lib'), []));

const referencedTables = new Set();
const referencedFuncs = new Set();

scanFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');

  // .from('table') or .from("table")
  const fromMatches = [...content.matchAll(/\.from\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g)];
  fromMatches.forEach(m => {
    referencedTables.add({ table: m[1], file: path.relative(root, file) });
  });

  // rpc('func') or rpc("func")
  const rpcMatches = [...content.matchAll(/\.rpc\s*\(\s*['"]([a-zA-Z0-9_]+)['"]\s*/g)];
  rpcMatches.forEach(m => {
    referencedFuncs.add({ func: m[1], file: path.relative(root, file) });
  });
});

console.log('\n--- TABLE REFERENCES CHECK ---');
referencedTables.forEach(item => {
  const t = item.table.toLowerCase();
  const exists = tables.has(t);
  if (!exists) {
    console.log(`Missing table referenced: "${item.table}" in ${item.file}`);
  }
});

console.log('\n--- FUNCTION (RPC) REFERENCES CHECK ---');
referencedFuncs.forEach(item => {
  const f = item.func.toLowerCase();
  const exists = functions.has(f);
  if (!exists) {
    console.log(`Missing function referenced: "${item.func}" in ${item.file}`);
  }
});
