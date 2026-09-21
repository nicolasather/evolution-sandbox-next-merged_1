'use client';

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error(_error);
  return (
    <html lang="en">
      <body>
        <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center bg-zinc-50 dark:bg-zinc-950">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Critical System Error
            </h2>
            <p className="text-zinc-500 max-w-md mx-auto">
              Failed to initialize the application. We have recorded this issue.
            </p>
            <div className="pt-4">
              <button 
                onClick={() => reset()} 
                className="px-4 py-2 bg-zinc-900 text-zinc-50 rounded-md font-medium text-sm hover:bg-zinc-800 transition-colors shadow-sm dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
