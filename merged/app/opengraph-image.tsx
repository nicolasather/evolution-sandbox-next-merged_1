import { ImageResponse } from 'next/og';
import db from '@/data/db.json';

// figures come from the data, so the card cannot drift from the site
const TOTAL = db.counts.total;
const SOURCES = Object.keys(db.sources).length;

export const alt = 'Evolution Sandbox — how did we get here?';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', background: '#0a0a0b', color: '#e9e5dd',
          padding: '70px 76px', fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, color: '#6d6963', letterSpacing: 3 }}>
          <span>EVOLUTION SANDBOX</span>
          {/* one text node: Satori wants display:flex on anything with several children */}
          <span>{`${TOTAL} DISCOVERIES · ${SOURCES} CITED SOURCES`}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ fontSize: 96, lineHeight: 0.95, letterSpacing: -2 }}>How did we</div>
            {/* Satori requires an explicit display on any node with more than
                one child, so this line is a flex row of spans, not mixed text. */}
            <div style={{ display: 'flex', fontSize: 96, lineHeight: 0.95, letterSpacing: -2 }}>
              <span>get&nbsp;</span>
              <span style={{ color: '#c4642c', fontStyle: 'italic' }}>here</span>
              <span>?</span>
            </div>
          </div>
          <svg width="230" height="230" viewBox="0 0 200 200" fill="none" stroke="#e9e5dd" strokeWidth="3" strokeLinejoin="round">
            <circle cx="100" cy="100" r="86" stroke="#3a3835" strokeWidth="2" />
            <path d="M62 118 L52 84 L74 56 L112 46 L146 62 L152 96 L138 132 L104 148 Z" />
            <path d="M74 56 L96 88 L152 96" stroke="#8e8a83" />
            <path d="M96 88 L104 148" stroke="#8e8a83" />
          </svg>
        </div>

        <div style={{ fontSize: 26, color: '#a6a199', maxWidth: 900, lineHeight: 1.4 }}>
          Start with a stone, a stick, a bone and a length of fibre. Everything else you have to find.
        </div>
      </div>
    ),
    size,
  );
}
