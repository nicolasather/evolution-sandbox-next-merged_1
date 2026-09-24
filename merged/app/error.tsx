'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="state-screen">
      <p className="state-k mono">The archive could not be recovered.</p>
      <h2 className="state-h">Something went wrong</h2>
      <p className="state-p">Your progress is stored on this device and has not been touched. Try again.</p>
      <button onClick={() => reset()} className="chip state-btn" aria-label="Try again">
        Try again
      </button>
    </div>
  );
}
