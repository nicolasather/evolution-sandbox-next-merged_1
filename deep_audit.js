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

// 1. Gather all defined CSS classes
const definedClasses = new Set();
cssFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(MERGED_DIR, file);

  // Match class selectors e.g. .my-class
  const classRegex = /\.([a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = classRegex.exec(content)) !== null) {
    definedClasses.add(match[1]);
  }
});

// Known Tailwind / standard utility prefixes or common utility terms
const tailwindPrefixes = [
  'flex', 'grid', 'block', 'inline', 'hidden', 'absolute', 'relative', 'fixed', 'sticky',
  'p-', 'px-', 'py-', 'pt-', 'pb-', 'pl-', 'pr-',
  'm-', 'mx-', 'my-', 'mt-', 'mb-', 'ml-', 'mr-',
  'w-', 'h-', 'min-w-', 'min-h-', 'max-w-', 'max-h-',
  'text-', 'bg-', 'border-', 'rounded-', 'shadow-', 'opacity-',
  'font-', 'leading-', 'tracking-', 'align-', 'justify-', 'items-', 'self-',
  'space-', 'gap-', 'overflow-', 'cursor-', 'transition-', 'duration-', 'transform-',
  'scale-', 'rotate-', 'translate-', 'hover:', 'focus:', 'active:', 'disabled:',
  'dark:', 'group', 'peer', 'z-', 'inset-', 'top-', 'bottom-', 'left-', 'right-'
];

function isTailwindOrKnown(cls) {
  if (!cls) return true;
  if (definedClasses.has(cls)) return true;
  for (const prefix of tailwindPrefixes) {
    if (cls === prefix || cls.startsWith(prefix)) return true;
  }
  return false;
}

// 2. Analyze TSX files for accessibility and class mismatches
tsxFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(MERGED_DIR, file);
  const lines = content.split('\n');

  // Check className usages
  const classNameRegex = /className=(?:["']([^"']+)["']|\{([^}]+)\})/g;
  let match;
  while ((match = classNameRegex.exec(content)) !== null) {
    const classStr = match[1] || match[2];
    if (!classStr) continue;
    // Extract individual class names
    const classes = classStr.replace(/['"`]/g, '').split(/\s+/);
    classes.forEach(cls => {
      // Remove conditional ternary artifacts or template variables if any
      cls = cls.replace(/\${.*}/g, '').trim();
      if (!cls) return;
      if (!isTailwindOrKnown(cls)) {
        // Potential dead style / typo
        // Let's check if it's a near miss of any defined class
        const lineNum = content.substring(0, match.index).split('\n').length;
        findings.push({
          category: 'CSS Class Mismatch',
          file: relPath,
          line: lineNum,
          snippet: cls,
          issue: `Class "${cls}" used in component has no matching CSS rule definition and is not a known Tailwind utility.`,
          fix: `Check for typos or define ".${cls}" in CSS.`
        });
      }
    });
  }

  // Check accessibility issues line by line / element by element
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    // <img> without alt
    if (trimmed.includes('<img') && !trimmed.includes('alt=') && !line.includes('alt=')) {
      // Check if subsequent lines in tag have alt
      let hasAlt = false;
      for (let j = idx; j < Math.min(idx + 5, lines.length); j++) {
        if (lines[j].includes('alt=')) hasAlt = true;
      }
      if (!hasAlt) {
        findings.push({
          category: 'Accessibility (Image missing alt)',
          file: relPath,
          line: lineNum,
          snippet: trimmed,
          issue: `<img> element rendered without an 'alt' attribute.`,
          fix: `Add an appropriate 'alt' attribute (descriptive text or alt="" for decorative images).`
        });
      }
    }

    // iframe without title
    if (trimmed.includes('<iframe') && !trimmed.includes('title=')) {
      findings.push({
        category: 'Accessibility (Iframe missing title)',
        file: relPath,
        line: lineNum,
        snippet: trimmed,
        issue: `<iframe> element rendered without a 'title' attribute.`,
        fix: `Add a descriptive 'title' attribute to the iframe.`
      });
    }

    // positive tabIndex
    const tabIndexMatch = trimmed.match(/tabIndex=\{([1-9][0-9]*)\}|tabIndex=["']([1-9][0-9]*)["']/);
    if (tabIndexMatch) {
      findings.push({
        category: 'Accessibility (Positive tabIndex)',
        file: relPath,
        line: lineNum,
        snippet: trimmed,
        issue: `Positive tabIndex disrupts natural keyboard navigation order.`,
        fix: `Remove positive tabIndex or use tabIndex={0} / tabIndex={-1}.`
      });
    }

    // onClick on non-interactive elements without role or keyboard handler
    // e.g. <div onClick=... without role=button
    if (trimmed.includes('onClick=') && (trimmed.startsWith('<div') || trimmed.startsWith('<span') || trimmed.startsWith('<p') || trimmed.startsWith('<li') || trimmed.startsWith('<section'))) {
      if (!trimmed.includes('role=') && !trimmed.includes('onKeyDown') && !trimmed.includes('onKeyUp')) {
        findings.push({
          category: 'Accessibility (Non-interactive element with onClick)',
          file: relPath,
          line: lineNum,
          snippet: trimmed,
          issue: `Non-interactive element has an 'onClick' handler but lacks role="button" and keyboard handlers (onKeyDown/onKeyUp).`,
          fix: `Use a <button> element instead, or add role="button" tabIndex={0} and keyboard event handlers.`
        });
      }
    }

    // Inputs without labels (<input type="..." ... /> without id/aria-label/aria-labelledby)
    if (trimmed.includes('<input') && !trimmed.includes('type="hidden"') && !trimmed.includes("type='hidden'")) {
      if (!trimmed.includes('aria-label') && !trimmed.includes('aria-labelledby') && !trimmed.includes('id=')) {
        findings.push({
          category: 'Accessibility (Input missing label)',
          file: relPath,
          line: lineNum,
          snippet: trimmed,
          issue: `<input> element lacks an accessible label (aria-label, aria-labelledby, or id for htmlFor pairing).`,
          fix: `Add an aria-label or associate with a <label> via id and htmlFor.`
        });
      }
    }
  });
});

console.log(`Deep audit completed. Total findings: ${findings.length}`);
fs.writeFileSync(path.resolve(__dirname, 'deep_audit_report.json'), JSON.stringify(findings, null, 2));

// Print summary by category
const summary = {};
findings.forEach(f => {
  summary[f.category] = (summary[f.category] || 0) + 1;
});
console.log('Findings summary by category:', summary);
