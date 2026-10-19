'use client';
export default function QuizError({ error, reset }: { error: Error; reset: () => void }) {
  return (<main className="qz-main"><h1>Something went wrong</h1><p role="alert">{error.message || 'Please try again.'}</p><button className="btn" onClick={reset}>Try again</button> <a className="btn ghost" href="/quiz">Back to Quiz Studio</a></main>);
}
