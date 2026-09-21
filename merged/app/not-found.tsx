import { StaticPage, DocLink } from '@/components/StaticPage';

export default function NotFound() {
  return (
    <StaticPage
      eyebrow="404"
      title="Nothing here yet"
      lead="This address does not lead anywhere — which, in a project about dead ends, is at least on theme."
    >
      <section>
        <p>Three places that do exist:</p>
        <ul>
          <li><DocLink href="/">The sandbox</DocLink> — four raw materials and 322 things to find.</li>
          <li><DocLink href="/method">How this was built</DocLink> — sourcing rules and graph validation.</li>
          <li><DocLink href="/faq">Questions</DocLink> — including how far this can be trusted as history.</li>
        </ul>
      </section>
    </StaticPage>
  );
}
