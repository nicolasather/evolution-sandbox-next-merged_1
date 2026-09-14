import { LineHoverLink } from './vengeance/line-hover-link';

/** Build year, fixed when the page is rendered at build time. Kept out of the
 *  component body so rendering stays pure. */
const YEAR = new Date().getFullYear();

/** Typography for the pages' own text: sections, headings, paragraphs, lists,
 *  inline code. Tailwind utilities on the project's tokens — these pages have
 *  no rules in the shared design-system stylesheet. Direct-child selectors on
 *  purpose, so components dropped into a section (the FAQ accordion) keep
 *  their own spacing and list styles. */
const PROSE = [
  'pt-2',
  '[&>section]:border-b [&>section]:border-line [&>section]:py-[34px]',
  '[&>section>h2]:mt-0 [&>section>h2]:mb-3.5 [&>section>h2]:font-display [&>section>h2]:text-[26px] [&>section>h2]:leading-[1.15] [&>section>h2]:font-normal [&>section>h2]:tracking-[-0.01em] [&>section>h2]:text-bone',
  '[&>section>p]:mt-0 [&>section>p]:mb-3.5 [&>section>p]:max-w-[66ch] [&>section>p]:text-[14.5px] [&>section>p]:leading-[1.72] [&>section>p]:text-bone-2 [&>section>p:last-child]:mb-0',
  '[&>section>ul]:mt-0 [&>section>ul]:mb-3.5 [&>section>ul]:max-w-[66ch] [&>section>ul]:list-disc [&>section>ul]:pl-5 [&>section>ul]:text-[14.5px] [&>section>ul]:leading-[1.72] [&>section>ul]:text-bone-2',
  '[&>section>ul>li]:mb-2 [&>section>ul>li::marker]:text-bone-4',
  '[&_b]:font-medium [&_b]:text-bone',
  '[&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-bone-3',
].join(' ');

/** Chrome for the non-interactive pages: method, FAQ, privacy, 404. */
export function StaticPage({
  eyebrow, title, lead, children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    // the design system locks <body> to the viewport for the game; these pages scroll inside it
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[820px] px-[clamp(20px,5vw,40px)] pb-20">
        <header className="border-b border-line pt-[clamp(40px,7vw,86px)] pb-[30px]">
          <LineHoverLink href="/" variant="slide" className="mono mb-[38px] text-bone-3 hover:text-ochre">
            ← Evolution Sandbox
          </LineHoverLink>
          <p className="mono mt-0 mb-3 text-bone-4">{eyebrow}</p>
          <h1 className="mt-0 mb-[18px] font-display text-[clamp(34px,6vw,62px)] leading-[1.02] font-normal tracking-[-0.01em] text-balance text-bone">
            {title}
          </h1>
          {lead && <p className="m-0 max-w-[58ch] text-[17px] leading-[1.6] text-bone-2">{lead}</p>}
        </header>

        <main className={PROSE}>{children}</main>

        <footer className="mono flex flex-wrap justify-between gap-[18px] pt-7 text-bone-4">
          <span>© {YEAR} Evolution Sandbox</span>
          <nav className="flex gap-[18px]" aria-label="Pages">
            <LineHoverLink href="/method" variant="slide" className="hover:text-ochre">Method</LineHoverLink>
            <LineHoverLink href="/faq" variant="slide" className="hover:text-ochre">FAQ</LineHoverLink>
            <LineHoverLink href="/privacy" variant="slide" className="hover:text-ochre">Privacy</LineHoverLink>
            <LineHoverLink href="/terms" variant="slide" className="hover:text-ochre">Terms</LineHoverLink>
          </nav>
        </footer>
      </div>
    </div>
  );
}

/** The ochre inline link used in running text on these pages. */
export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <LineHoverLink href={href} variant="slide" className="whitespace-normal text-ochre">
      {children}
    </LineHoverLink>
  );
}
