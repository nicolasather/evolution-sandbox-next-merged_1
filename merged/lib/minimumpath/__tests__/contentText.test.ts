import { content } from '@/lib/minimumpath/content';
import { localize } from '@/lib/minimumpath/contentText';

/* Guard: every Vietnamese data string shown in English must have an English entry. */

const VI = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

describe('Minimum Path English data text', () => {
  const shown: string[] = [
    content.source.note,
    ...content.chapters.flatMap(c => [c.title, c.lesson]),
    ...content.missions.map(m => m.briefing),
  ];

  it('has no Vietnamese left in English for any shown data string', () => {
    const missing = [...new Set(shown)].filter(text => VI.test(localize('en', text)));
    expect(missing).toEqual([]);
  });

  it('keeps the original Vietnamese in Vietnamese mode', () => {
    expect(localize('vi', content.chapters[0].title)).toBe(content.chapters[0].title);
  });
});
