import { readFileSync } from 'fs';
import { join } from 'path';

export function checkDbConnectivity(): boolean {
  try {
    const dbPath = join(process.cwd(), 'data', 'db.json');
    const data = JSON.parse(readFileSync(dbPath, 'utf8'));
    return !!(data && typeof data === 'object' && Array.isArray(data.nodes));
  } catch {
    return false;
  }
}
