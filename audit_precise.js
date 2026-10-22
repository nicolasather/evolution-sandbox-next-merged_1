const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.resolve(__dirname, 'merged');

function getAllFiles(dir, extList, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.next' || file === '.git' || file === 'public') continue;
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

let findings = [];

// 1. Gather all defined CSS classes and custom properties / fonts
const definedClasses = new Set();
const definedKeyframes = new Set();
const definedCustomProps = new Set();

cssFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(MERGED_DIR, file);

  // Match class selectors
  const classRegex = /\.([a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    definedClasses.add(match[1]);
  }

  // Match keyframes
  const kfRegex = /@keyframes\s+([a-zA-Z0-9_-]+)/g;
  while ((match = kfRegex.exec(content)) !== null) {
    definedKeyframes.add(match[1]);
  }

  // Match custom props
  const propRegex = /(--[a-zA-Z0-9_-]+)\s*:/g;
  while ((match = propRegex.exec(content)) !== null) {
    definedCustomProps.add(match[1]);
  }

  // Task 1 & 2: Check @import
  const importRegex = /@import\s+(?:url\(['"]?([^'"]+)['"]?\)|['"]([^'"]+)['"]);?/g;
  while ((match = importRegex.exec(content)) !== null) {
    const importTarget = match[1] || match[2];
    if (importTarget.startsWith('http') || importTarget.startsWith('tailwindcss')) continue;
    const resolvedPath = path.resolve(path.dirname(file), importTarget);
    if (!fs.existsSync(resolvedPath)) {
      findings.push({
        type: 'Broken Reference (@import)',
        file: relPath,
        line: content.substring(0, match.index).split('\n').length,
        snippet: match[0],
        issue: `Imported file "${importTarget}" does not exist.`,
        fix: `Create the missing file or correct the import path.`
      });
    }
  }

  // Task 1: Balanced braces
  let braceCount = 0;
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }
  });
  if (braceCount !== 0) {
    findings.push({
      type: 'CSS Syntax Error (Unbalanced Braces)',
      file: relPath,
      line: 1,
      snippet: `Net brace balance: ${braceCount}`,
      issue: `File has unbalanced curly braces ({ vs }).`,
      fix: `Ensure all blocks are properly closed.`
    });
  }

  // Task 2: url() assets
  const urlRegex = /url\(['"]?([^'"#?)]+)['"]?\)/g;
  while ((match = urlRegex.exec(content)) !== null) {
    const urlPath = match[1];
    if (urlPath.startsWith('data:') || urlPath.startsWith('http')) continue;
    let resolved = path.resolve(path.dirname(file), urlPath);
    let publicResolved = path.resolve(MERGED_DIR, 'public', urlPath.replace(/^\//, ''));
    if (!fs.existsSync(resolved) && !fs.existsSync(publicResolved)) {
      findings.push({
        type: 'Broken Reference (url())',
        file: relPath,
        line: content.substring(0, match.index).split('\n').length,
        snippet: match[0],
        issue: `Asset referenced in url("${urlPath}") does not exist.`,
        fix: `Check asset path or ensure file exists in public/ or relative folder.`
      });
    }
  }

  // Task 5: Contrast / visibility traps in CSS
  const rules = content.split('}');
  rules.forEach(rule => {
    const colorMatch = rule.match(/(?:^|[\s;])color\s*:\s*([^;]+);/);
    const bgMatch = rule.match(/(?:^|[\s;])(?:background|background-color)\s*:\s*([^;]+);/);
    if (colorMatch && bgMatch) {
      const colVal = colorMatch[1].trim();
      const bgVal = bgMatch[1].trim();
      if (colVal === bgVal && !colVal.includes('transparent') && !colVal.includes('currentColor') && !colVal.includes('var(--')) {
        findings.push({
          type: 'Contrast/Visibility Trap',
          file: relPath,
          line: 1,
          snippet: `color: ${colVal}; background: ${bgVal};`,
          issue: `Text color and background are identical (${colVal}), making text invisible.`,
          fix: `Provide contrasting foreground color.`
        });
      }
    }
  });
});

// Known Tailwind prefixes & utilities
const tailwindPrefixes = [
  'flex', 'grid', 'block', 'inline', 'hidden', 'absolute', 'relative', 'fixed', 'sticky',
  'p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-',
  'm-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-',
  'w-', 'h-', 'min-w-', 'min-h-', 'max-w-', 'max-h-',
  'text-', 'bg-', 'border-', 'rounded-', 'shadow-', 'opacity-',
  'font-', 'leading-', 'tracking-', 'align-', 'justify-', 'items-', 'self-',
  'space-', 'gap-', 'overflow-', 'cursor-', 'transition-', 'duration-', 'transform-',
  'scale-', 'rotate-', 'translate-', 'hover:', 'focus:', 'active:', 'disabled:',
  'dark:', 'group', 'peer', 'z-', 'inset-', 'top-', 'bottom-', 'left-', 'right-',
  'pointer-events-', 'select-', 'object-', 'aspect-', 'col-', 'row-', 'divide-',
  'ring-', 'outline-', 'backdrop-', 'filter', 'blur', 'brightness-', 'contrast-',
  'grayscale', 'hue-rotate-', 'invert', 'saturate-', 'sepia', 'drop-shadow-',
  'animate-', 'ease-', 'delay-', 'origin-', 'perspective-', 'backface-'
];

function isTailwindOrKnown(cls) {
  if (!cls) return true;
  if (definedClasses.has(cls)) return true;
  if (cls.startsWith('[') && cls.endsWith(']')) return true; // Tailwind arbitrary values
  for (const prefix of tailwindPrefixes) {
    if (cls === prefix || cls.startsWith(prefix)) return true;
  }
  return false;
}

// 3. Analyze TSX files for Accessibility (Task 4) and literal className typos (Task 3)
tsxFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(MERGED_DIR, file);
  const lines = content.split('\n');

  // Task 3: Check literal className="..." strings for typos / dead classes
  const literalClassNameRegex = /className="([^"]+)"/g;
  let match;
  while ((match = literalClassNameRegex.exec(content)) !== null) {
    const classStr = match[1];
    const classes = classStr.split(/\s+/);
    classes.forEach(cls => {
      if (!cls) return;
      if (!isTailwindOrKnown(cls)) {
        // Check if it's a near miss of any defined class
        const lineNum = content.substring(0, match.index).split('\n').length;
        // Only report if it looks like a custom class typo (not a complex utility)
        if (cls.length > 3 && !cls.includes('-') && !cls.includes(':')) {
          findings.push({
            type: 'CSS Class Mismatch / Typo',
            file: relPath,
            line: lineNum,
            snippet: cls,
            issue: `Class "${cls}" used in literal className has no matching CSS rule and is not recognized.`,
            fix: `Verify spelling or define ".${cls}" in CSS.`
          });
        }
      }
    });
  }

  // Task 4: Accessibility checks line by line
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // 1. <img> without alt
    if (trimmed.includes('<img') && !trimmed.includes('alt=')) {
      let hasAlt = false;
      for (let j = idx; j < Math.min(idx + 4, lines.length); j++) {
        if (lines[j].includes('alt=')) hasAlt = true;
      }
      if (!hasAlt) {
        findings.push({
          type: 'Accessibility (Image missing alt)',
          file: relPath,
          line: lineNum,
          snippet: trimmed,
          issue: `<img> element without 'alt' attribute.`,
          fix: `Add descriptive alt attribute or alt="" for decorative images.`
        });
      }
    }

    // 2. iframe without title
    if (trimmed.includes('<iframe') && !trimmed.includes('title=')) {
      findings.push({
        type: 'Accessibility (Iframe missing title)',
        file: relPath,
        line: lineNum,
        snippet: trimmed,
        issue: `<iframe> element without 'title' attribute.`,
        fix: `Add a descriptive title attribute.`
      });
    }

    // 3. Positive tabIndex
    const tabIndexMatch = trimmed.match(/tabIndex=\{([1-9][0-9]*)\}|tabIndex=["']([1-9][0-9]*)["']/);
    if (tabIndexMatch) {
      findings.push({
        type: 'Accessibility (Positive tabIndex)',
        file: relPath,
        line: lineNum,
        snippet: trimmed,
        issue: `Positive tabIndex disrupts natural keyboard focus flow.`,
        fix: `Remove positive tabIndex or use 0 / -1.`
      });
    }

    // 4. onClick on non-interactive elements without role or keyboard handlers
    if (trimmed.includes('onClick=') && (trimmed.startsWith('<div') || trimmed.startsWith('<span') || trimmed.startsWith('<p') || trimmed.startsWith('<li') || trimmed.startsWith('<section'))) {
      if (!trimmed.includes('role=') && !trimmed.includes('onKeyDown') && !trimmed.includes('onKeyUp')) {
        findings.push({
          type: 'Accessibility (Non-interactive element with onClick)',
          file: relPath,
          line: lineNum,
          snippet: trimmed,
          issue: `Non-interactive element has onClick without role="button" or keyboard handlers.`,
          fix: `Use <button> or add role="button" tabIndex={0} and keyboard event handlers.`
        });
      }
    }

    // 5. Input missing label association
    if (trimmed.includes('<input') && !trimmed.includes('type="hidden"') && !trimmed.includes("type='hidden'")) {
      if (!trimmed.includes('aria-label') && !trimmed.includes('aria-labelledby') && !trimmed.includes('id=') && !trimmed.includes('name=')) {
        findings.push({
          type: 'Accessibility (Input missing label)',
          file: relPath,
          line: lineNum,
          snippet: trimmed,
          issue: `<input> lacks accessible labeling (aria-label, aria-labelledby, or id).`,
          fix: `Add aria-label or associate with <label>.`
        });
      }
    }
  });
});

console.log(`Precise audit completed. Total findings: ${findings.length}`);
fs.writeFileSync(path.resolve(__dirname, 'precise_audit_report.json'), JSON.stringify(findings, null, 2));

const summary = {};
findings.forEach(f => {
  summary[f.type] = (summary[f.type] || 0) + 1;
});
console.log('Summary:', summary);
