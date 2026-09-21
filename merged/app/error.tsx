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
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Something went wrong
        </h2>
        <p className="text-zinc-500 max-w-md mx-auto">
          We encountered an unexpected issue while processing your request.
          Please try again later.
        </p>
        <div className="pt-4">
          <button 
            onClick={() => reset()} 
            className="px-4 py-2 bg-zinc-900 text-zinc-50 rounded-md font-medium text-sm hover:bg-zinc-800 transition-colors shadow-sm dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            aria-label="Try again"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
