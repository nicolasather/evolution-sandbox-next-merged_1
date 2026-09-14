import type { Metadata } from 'next';
import { StaticPage, DocLink } from '@/components/StaticPage';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The short, honest version: a free project, provided as-is, with sources cited and no data collected.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <StaticPage
      eyebrow="Terms"
      title="Terms of use"
      lead="There is no account and nothing for sale, so this stays short."
    >
      <section>
        <h2>What this is</h2>
        <p>
          Evolution Sandbox is a free, ad-free explorable game about the history of technology. It
          is provided as-is, with no warranty of any kind, express or implied — including no
          guarantee that it will be available, error-free, or fit for a particular purpose. See{' '}
          <DocLink href="/faq">the FAQ</DocLink> for what the game does and does not claim about
          history, and <DocLink href="/method">the method page</DocLink> for how the data was
          sourced and checked.
        </p>
      </section>

      <section>
        <h2>Using it</h2>
        <p>
          You are welcome to play, link to, and write about this project. What you may not do is
          present its content as your own original research, or use it in a way that misrepresents
          the sources it cites. Historical facts are not owned by anyone; the specific text, the
          combination graph, and the presentation of both are.
        </p>
      </section>

      <section>
        <h2>Third-party content</h2>
        <p>
          Every source link in the exhibit panel leads to an external institution — a museum, a
          university, a journal, a standards body — under that organisation&rsquo;s own terms, not
          this project&rsquo;s. This project is not responsible for the content, availability, or
          accuracy of pages it links to, though every link was fetched and confirmed to resolve
          before it was added; see <DocLink href="/method">the method page</DocLink> for the
          verification date.
        </p>
        <p>
          A small number of interface components are adapted from{' '}
          <a href="https://www.vengenceui.com" rel="noopener noreferrer" target="_blank">
            Vengeance UI
          </a>{' '}
          under the MIT licence; the fonts are Google&rsquo;s open-source Archivo, Instrument
          Serif and JetBrains Mono, self-hosted at build time.
        </p>
      </section>

      <section>
        <h2>No data, so nothing to remove</h2>
        <p>
          There is no account, no server-side storage, and nothing collected about you — see{' '}
          <DocLink href="/privacy">the privacy page</DocLink> for the full, short version. Your
          saved progress lives only in your own browser, and you can delete it yourself at any
          time with the <b>Start over</b> control.
        </p>
      </section>

      <p className="pt-[34px]"><DocLink href="/">← Back to the sandbox</DocLink></p>
    </StaticPage>
  );
}
