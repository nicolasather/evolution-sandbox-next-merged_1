import Link from 'next/link';
export default function NotFound() { return (<main className="qz-main"><h1>We couldn’t find that page</h1><p>The quiz or room may have been removed, or the link is mistyped.</p><Link className="btn" href="/quiz">Back to Quiz Studio</Link></main>); }
