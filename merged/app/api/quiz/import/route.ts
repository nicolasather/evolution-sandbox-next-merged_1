import { inflateRawSync } from 'node:zlib';
import { readXlsx } from '@/lib/quiz/portability';
import { AppError } from '@/lib/quiz/errors';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';

export const runtime = 'nodejs';

/** Reads the cells of an .xlsx workbook so the browser can preview an import. Nothing is stored; files over 5 MB are refused. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    await rateLimit(req, 'import-xlsx', 30, 600);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('Choose a spreadsheet to import', 400);
    if (file.size > 5_000_000) throw new AppError('That spreadsheet is larger than 5 MB.', 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new AppError('That does not look like an .xlsx file. Save it as .xlsx or .csv and try again.', 400);
    let rows: string[][];
    try { rows = readXlsx(bytes, (b) => new Uint8Array(inflateRawSync(b))); } catch { throw new AppError('Could not read that spreadsheet. Save it as .csv and try again.', 400); }
    return success({ rows: rows.slice(0, 1000) });
  } catch (e) { return failure(e); }
}
