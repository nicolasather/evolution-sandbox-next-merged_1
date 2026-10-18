'use client';
import MediaAttach from './MediaAttach';
import MediaView from './MediaView';
import { useCreator } from '@/components/quiz/creator/CreatorProvider';

/** Optional custom cover. Picking a built-in illustration above clears it. */
export default function CoverMedia() {
  const c = useCreator(); const s = c.settings;
  return (
    <div className="stack">
      {s.coverMediaId ? (
        <div className="qm-chosen">
          <MediaView media={{ id: s.coverMediaId, kind: 'image', alt: s.coverAlt || 'Quiz cover' }} height={160} />
          <label>Describe the cover<input value={s.coverAlt ?? ''} maxLength={300} onChange={(e) => c.patchSettings({ coverAlt: e.target.value })} /></label>
          <button type="button" className="btn small ghost" onClick={() => c.patchSettings({ coverMediaId: undefined, coverAlt: undefined })}>Remove custom cover</button>
        </div>
      ) : (
        <MediaAttach label="Upload your own cover" role="cover" allow={['image', 'gif']} value={undefined} onChange={(m) => m && c.patchSettings({ coverMediaId: m.id, coverAlt: m.alt })} />
      )}
    </div>
  );
}
