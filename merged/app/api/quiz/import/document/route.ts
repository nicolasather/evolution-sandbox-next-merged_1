import { currentUser } from '@/lib/quiz/supabase';
import { assertSameOrigin, failure, rateLimit, success } from '@/lib/quiz/api';
import { AppError } from '@/lib/quiz/errors';

export const runtime = 'nodejs';
const MAX = 5_000_000;
const TEXT_LIMIT = 60_000;

/** Reads the text out of a .docx or .pdf. The text is returned to the browser, which stages it for review — nothing is saved here. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await currentUser();
    await rateLimit(req, 'quiz-import-doc', 20, 600, user.id);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('Choose a .docx or .pdf file', 400);
    if (file.size === 0) throw new AppError('That file is empty', 400);
    if (file.size > MAX) throw new AppError('That file is larger than 5 MB', 413);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // docx is a zip
    const isPdf = String.fromCharCode(...bytes.subarray(0, 5)) === '%PDF-';
    let text = '';
    if (isZip && /\.docx$/i.test(file.name)) {
      const mammoth = await import('mammoth');
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } else if (isPdf) {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(bytes);
      text = (await extractText(pdf, { mergePages: true })).text as string;
    } else throw new AppError('Only .docx and text-based .pdf files can be read. Older .doc files: save as .docx first.', 400);
    text = text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
    if (!text) throw new AppError('No text was found. Scanned PDFs (pictures of pages) can’t be read.', 422);
    const truncated = text.length > TEXT_LIMIT;
    return success({ text: text.slice(0, TEXT_LIMIT), truncated });
  } catch (e) { return failure(e); }
}
