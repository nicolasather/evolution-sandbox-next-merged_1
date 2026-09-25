import type { VoiceId } from '@/lib/narrator/voices';

/* ============================================================================
   PORTRAITS — drawn in code, in the manner of an engraving: single-weight
   lines, a little hatching, no fill. One shared bust; each voice adds one thing
   it is known by. Archetypes have no face. The three dramatised figures get a
   brow and an eye line, nothing that resembles a likeness.
   ========================================================================== */

const HEAD = 'M40 12C30 12 26 22 27 31C28 41 34 47 40 47C46 47 52 41 53 31C54 22 50 12 40 12Z';
const BODY = 'M35 46L35 54M45 46L45 54M12 96C12 72 24 60 35 54M68 96C68 72 56 60 45 54';
const HATCH = 'M46 18L52 26M47 24L53 32M46 31L51 38M20 84L28 74M24 90L34 78';
const FACE = 'M33 29L37 28M43 28L47 29M40 30L39 36L41 36';

/** What each voice carries or wears. */
const ATTR: Record<VoiceId, string[]> = {
  toolmaker: ['M28 22C34 19 46 19 52 22', 'M30 84C24 76 27 66 35 62C43 66 45 76 37 86Z', 'M31 78L35 70M34 82L39 73'],
  firekeeper: ['M60 82L60 70', 'M60 66C53 58 57 50 60 42C64 50 67 58 60 66Z', 'M60 60C57 56 59 52 60 50C62 54 63 57 60 60Z'],
  builder: ['M27 20C34 15 46 15 53 20', 'M14 90H34V80H14Z', 'M24 90V80M14 85H34', 'M20 80V72H40V80'],
  grower: ['M18 96L18 56', 'M18 66C12 64 10 58 12 54M18 66C24 64 26 58 24 54', 'M18 74C12 72 10 66 12 62M18 74C24 72 26 66 24 62', 'M18 58C16 52 18 48 18 46C20 50 20 54 18 58Z'],
  scribe: ['M24 78H50V94H24Z', 'M28 84H46M28 88H42', 'M52 74L62 92', 'M62 92L60 94'],
  weigher: ['M22 68H58', 'M40 60V68', 'M22 68L16 80H28Z', 'M58 68L52 80H64Z', 'M40 60C40 57 42 56 44 57'],
  smith: ['M28 22C34 17 46 17 52 22', 'M58 92L64 66', 'M58 64H72V70H58Z', 'M30 60L34 96M50 60L46 96'],
  observer: ['M26 50C30 56 36 58 40 58C44 58 50 56 54 50', 'M30 54C32 60 36 62 40 62C44 62 48 60 50 54', 'M62 80L18 62', 'M63 84L19 66', 'M18 62L19 66'],
  engineer: ['M28 22C34 15 46 15 52 22', 'M24 24L56 24', 'M60 84m-10 0a10 10 0 1 0 20 0a10 10 0 1 0 -20 0', 'M60 74V70M60 98V94M50 84H46M74 84H70', 'M60 84m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0'],
  experimenter: ['M28 50L32 60L40 56L48 60L52 50', 'M60 60L54 74L62 74L54 92', 'M14 74C18 70 22 78 26 74C30 70 34 78 38 74'],
  logician: ['M14 88H66V96H14Z', 'M20 92m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M30 92m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M44 92m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M56 92m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12 92H14M66 92H68', 'M26 78H32V84H26Z M38 78H44V84H38Z'],
  player: ['M20 74H60C64 74 66 78 66 82C66 86 62 90 58 88L52 84H28L22 88C18 90 14 86 14 82C14 78 16 74 20 74Z', 'M26 78V84M23 81H29', 'M50 79m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M55 83m-1.5 0a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0'],
  archivist: ['M28 22C30 12 50 12 52 22', 'M40 76L52 82V94L40 100L28 94V82Z', 'M40 76V88M28 82L40 88L52 82', 'M40 88V100'],
};

const DRAMATISED: VoiceId[] = ['observer', 'experimenter', 'logician'];

export function NarratorPortrait({ voice, size = 64 }: { voice: VoiceId; size?: number }) {
  return (
    <svg className="nar-portrait" width={size} height={Math.round(size * 1.2)} viewBox="0 0 80 96" fill="none"
      stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={HEAD} />
      <path d={BODY} />
      <path d={HATCH} opacity=".55" strokeWidth=".9" />
      {DRAMATISED.includes(voice) && <path d={FACE} strokeWidth="1" />}
      {ATTR[voice].map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
