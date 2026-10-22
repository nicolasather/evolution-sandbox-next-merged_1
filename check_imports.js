const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'merged');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', '.next', '.git'].includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else {
      if (/\.(ts|tsx|js|jsx)$/.test(file)) {
        results.push(filePath);
      }
    }
  });
  return results;
}

const files = walk(root);
let errors = [];

files.forEach(filepath => {
  const content = fs.readFileSync(filepath, 'utf8');
  const patterns = [
    /import\s+(?:[\w\s{},*]+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]?\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]?\s*\)/g
  ];

  patterns.forEach(pat => {
    let match;
    while ((match = pat.exec(content)) !== null) {
      const imp = match[1];
      let resolved = null;
      if (imp.startsWith('@/')) {
        resolved = path.join(root, imp.slice(2));
      } else if (imp.startsWith('.')) {
        resolved = path.resolve(path.dirname(filepath), imp);
      } else {
        continue;
      }

      const candidates = [
        resolved,
        resolved + '.ts',
        resolved + '.tsx',
        resolved + '.js',
        resolved + '.jsx',
        path.join(resolved, 'index.ts'),
        path.join(resolved, 'index.tsx'),
        path.join(resolved, 'index.js')
      ];

      let foundPath = null;
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          foundPath = cand;
          break;
        }
      }

      if (!foundPath) {
        errors.push({ file: filepath, import: imp, issue: 'Missing file' });
      } else {
        // Check case sensitivity
        // For each part of resolved path relative to root, check exact case on disk
        const rel = path.relative(root, foundPath);
        const parts = rel.split(path.sep);
        let curr = root;
        let caseMismatch = false;
        for (const p of parts) {
          const items = fs.readdirSync(curr);
          const actual = items.find(i => i.toLowerCase() === p.toLowerCase());
          if (!actual || actual !== p) {
            caseMismatch = true;
            break;
          }
          curr = path.join(curr, actual);
        }
        if (caseMismatch) {
          errors.push({ file: filepath, import: imp, issue: 'Case mismatch', found: foundPath });
        }
      }
    }
  });
});

console.log(`Scanned ${files.length} files.`);
console.log(`Found ${errors.length} issues:`);
errors.forEach(e => {
  console.log(`File: ${e.file}\n  Import: ${e.import}\n  Issue: ${e.issue}\n`);
});
