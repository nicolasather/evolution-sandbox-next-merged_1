const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.resolve(__dirname, 'merged');

function getAllFiles(dir, extList, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, extList, fileList);
    } else if (extList.some(ext => file.endsWith(ext))) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const cssFiles = getAllFiles(MERGED_DIR, ['.css']);
const tsxFiles = getAllFiles(MERGED_DIR, ['.tsx', '.jsx', '.ts', '.js']);

console.log(`Found ${cssFiles.length} CSS files and ${tsxFiles.length} JS/TSX files.`);

let findings = [];

// 1. CSS Syntax & @import & url() & font checks
cssFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(MERGED_DIR, file);

  // Check @import references
  const importRegex = /@import\s+(?:url\(['"]?([^'"]+)['"]?\)|['"]([^'"]+)['"]);?/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importTarget = match[1] || match[2];
    if (importTarget.startsWith('http') || importTarget.startsWith('tailwindcss')) continue;
    const resolvedPath = path.resolve(path.dirname(file), importTarget);
    if (!fs.existsSync(resolvedPath)) {
      findings.push({
        file: relPath,
        line: content.substring(0, match.index).split('\n').length,
        snippet: match[0],
        issue: `Broken @import reference: "${importTarget}" does not exist.`,
        fix: `Ensure the imported file exists at the correct path or fix the import target.`
      });
    }
  }

  // Check balanced braces
  let braceCount = 0;
  let lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // simple brace count ignoring comments/strings roughly
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
  }
  if (braceCount !== 0) {
    findings.push({
      file: relPath,
      line: 1,
      snippet: `Unbalanced braces (net balance: ${braceCount})`,
      issue: `CSS file has unbalanced curly braces ({ vs }).`,
      fix: `Ensure all open braces have matching closing braces.`
    });
  }

  // Check unclosed comments
  const openComments = (content.match(/\/\*/g) || []).length;
  const closeComments = (content.match(/\*\//g) || []).length;
  if (openComments !== closeComments) {
    findings.push({
      file: relPath,
      line: 1,
      snippet: `Unclosed comments (/* count: ${openComments}, */ count: ${closeComments})`,
      issue: `CSS file has unclosed block comments.`,
      fix: `Close all block comments with */.`
    });
  }

  // Check missing semicolons on property declarations (basic heuristic)
  // e.g. property: value property2: value2 without semicolon before newline/next prop
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    // if line looks like a CSS declaration (has colon, not a selector line, not a rule start/end, not @import/@media/@keyframes etc.)
    if (trimmed.includes(':') && !trimmed.endsWith(';') && !trimmed.endsWith('{') && !trimmed.endsWith('}') && !trimmed.startsWith('@') && !trimmed.startsWith('/*') && !trimmed.endsWith(',')) {
      // Check if next line starts a new property or if it's missing semicolon
      findings.push({
        file: relPath,
        line: idx + 1,
        snippet: trimmed,
        issue: `Missing semicolon at end of declaration.`,
        fix: `Add a semicolon (;) at the end of the property declaration.`
      });
    }
  });

  // Check url() references
  const urlRegex = /url\(['"]?([^'"#?)]+)['"]?\)/g;
  while ((match = urlRegex.exec(content)) !== null) {
    const urlPath = match[1];
    if (urlPath.startsWith('data:') || urlPath.startsWith('http')) continue;
    // resolve relative to file or public
    let resolved = path.resolve(path.dirname(file), urlPath);
    let publicResolved = path.resolve(MERGED_DIR, 'public', urlPath.replace(/^\//, ''));
    if (!fs.existsSync(resolved) && !fs.existsSync(publicResolved)) {
      findings.push({
        file: relPath,
        line: content.substring(0, match.index).split('\n').length,
        snippet: match[0],
        issue: `Broken url() asset reference: "${urlPath}" does not exist.`,
        fix: `Verify asset path or place the asset in public/ or relative folder.`
      });
    }
  }

  // Contrast traps: color and background set to same value in same rule block
  // Simple check per rule block
  const rules = content.split('}');
  rules.forEach(rule => {
    const colorMatch = rule.match(/(?:^|[\s;])color\s*:\s*([^;]+);/);
    const bgMatch = rule.match(/(?:^|[\s;])(?:background|background-color)\s*:\s*([^;]+);/);
    if (colorMatch && bgMatch) {
      const colVal = colorMatch[1].trim();
      const bgVal = bgMatch[1].trim();
      if (colVal === bgVal && !colVal.includes('transparent') && !colVal.includes('currentColor')) {
        findings.push({
          file: relPath,
          line: 1, // approx
          snippet: `color: ${colVal}; background: ${bgVal};`,
          issue: `Contrast trap: text color and background are set to the exact same value (${colVal}), making text invisible.`,
          fix: `Give text a distinct contrasting color from the background.`
        });
      }
    }
  });
});

console.log(`CSS static analysis completed. Total findings so far: ${findings.length}`);

// Output summary
fs.writeFileSync(path.resolve(__dirname, 'audit_report.json'), JSON.stringify(findings, null, 2));
