import type { Metadata } from 'next';
import { StaticPage, DocLink } from '@/components/StaticPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Evolution Sandbox stores, where it stores it, and what it never collects.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <StaticPage
      eyebrow="Privacy"
      title="What this stores"
      lead="Short, because there is very little to describe."
    >
      <section>
        <h2>What is stored</h2>
        <p>
          Your progress — which discoveries you have made, the order you made them in, and how
          many combinations failed — is written to <code>localStorage</code> in
          your own browser, under the key <code>evo.sandbox.v1</code>.
        </p>
        <p>
          That data stays on the device you are using. It is not sent to a server, it does not
          follow you to another browser or another machine, and nobody else can read it. Clearing
          your site data, or using a private window, removes it. The <b>Start over</b> control in
          the top bar deletes it after you confirm.
        </p>
      </section>

      <section>
        <h2>What is not collected</h2>
        <ul>
          <li>No account, sign-in, or email address.</li>
          <li>No analytics, tracking pixels, or advertising identifiers.</li>
          <li>No cookies.</li>
          <li>No personal information of any kind.</li>
        </ul>
      </section>

      <section>
        <h2>What is loaded from elsewhere</h2>
        <p>
          Nothing, while you use the site. The three typefaces are downloaded once, when the site
          is built, and served from here like every other file, so your browser never contacts a
          font service. The discovery database ships with the page.
        </p>
        <p>
          Source links in the exhibit panel point to external institutions. Opening one takes you
          to that organisation&rsquo;s site, under their privacy policy, not this one.
        </p>
      </section>

      <p className="pt-[34px]"><DocLink href="/">← Back to the sandbox</DocLink></p>
    </StaticPage>
  );
}
