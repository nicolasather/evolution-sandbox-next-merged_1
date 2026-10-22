import os
import re
import sys

root = r"C:\Users\ThinkBook\OneDrive\Document\Evolution Sandbox\evolution-sandbox-next-merged_1\merged"

def get_real_path(path):
    # Returns the exact case-sensitive path on disk for a given absolute path
    directory, filename = os.path.split(path)
    if not os.path.exists(directory):
        return None
    try:
        for f in os.listdir(directory):
            if f.lower() == filename.lower():
                return os.path.join(directory, f)
    except Exception:
        pass
    return None

def check_file(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    # Match import ... from '...' or import '...' or require('...')
    patterns = [
        r"import\s+(?:[\w\s{},*]+from\s+)?['\"]([^'\"]+)['\"]",
        r"import\s*\(\s*['\"]([^'\"]+)['\"]?\s*\)",
        r"require\s*\(\s*['\"]([^'\"]+)['\"]?\s*\)"
    ]

    imports = []
    for pat in patterns:
        for m in re.finditer(pat, content):
            imports.append((m.group(1), m.start()))
    return imports

import_errors = []
file_count = 0

for dirpath, _, filenames in os.walk(root):
    if 'node_modules' in dirpath or '.next' in dirpath or '.git' in dirpath:
        continue
    for file in filenames:
        if file.endswith(('.ts', '.tsx', '.js', '.jsx')):
            filepath = os.path.join(dirpath, file)
            file_count += 1
            imports = check_file(filepath)
            for imp, pos in imports:
                # resolve alias
                resolved = None
                if imp.startswith('@/'):
                    rel = imp[2:]
                    resolved = os.path.join(root, rel.replace('/', os.sep))
                elif imp.startswith('.'):
                    resolved = os.path.normpath(os.path.join(dirpath, imp))
                else:
                    # package import or external
                    continue

                # Check extensions if not present
                candidates = [resolved]
                if not os.path.splitext(resolved)[1]:
                    candidates = [
                        resolved + '.ts',
                        resolved + '.tsx',
                        resolved + '.js',
                        resolved + '.jsx',
                        os.path.join(resolved, 'index.ts'),
                        os.path.join(resolved, 'index.tsx'),
                        os.path.join(resolved, 'index.js'),
                        resolved
                    ]

                found = False
                exact_match = False
                for cand in candidates:
                    if os.path.exists(cand):
                        found = True
                        real = get_real_path(cand)
                        if real and os.path.normpath(real) == os.path.normpath(cand):
                            exact_match = True
                            break

                if not found:
                    import_errors.append((filepath, imp, "Missing file"))
                elif not exact_match:
                    import_errors.append((filepath, imp, "Case mismatch"))

print(f"Scanned {file_count} files.")
print(f"Found {len(import_errors)} import issues:")
for err in import_errors:
    print(f"File: {err[0]}\n  Import: {err[1]}\n  Issue: {err[2]}\n")
