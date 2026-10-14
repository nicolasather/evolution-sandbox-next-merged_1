/* ============================================================================
   DEVELOPER BETA — environment gates.

   There are two independent switches, and BOTH must be on for anything
   developer-only to exist:

     NEXT_PUBLIC_ENABLE_DEV_TOOLS=true   build-time, reaches the browser bundle.
                                          Decides whether the beta UI is built in.
     ENABLE_DEV_TOOLS=true               server-only, never sent to the browser.
                                          Decides whether the server will answer
                                          developer-only routes.

   The client flag alone is never an authorisation (anyone can read a bundle);
   the console additionally asks the server (GET /api/dev/status) and every
   override stays inert until the server says yes.

   On top of the flags, a PRODUCTION deployment always refuses: if Vercel says
   VERCEL_ENV === 'production' the answer is "no" even if someone mistakenly
   sets the flags there. Nothing in this file reads the URL, cookies or
   localStorage, so none of those can switch developer privileges on.

   `process.env.NEXT_PUBLIC_*` is written out literally (never destructured or
   looked up dynamically) so Next.js can inline it at build time.
   ========================================================================== */

/** The deploy environment recorded at build time (see `env` in next.config.ts). */
export function deployEnvironment(): string {
  return process.env.NEXT_PUBLIC_DEPLOY_ENV ?? '';
}

/** Is this bundle the Developer Beta build? (Client-visible, informational — NOT an authorisation.) */
export function clientDevToolsEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') return false;
  if (deployEnvironment() === 'production') return false;
  return true;
}

type EnvLike = Record<string, string | undefined>;

/** May the SERVER answer developer-only requests? Pass `env` in tests. */
export function serverDevToolsEnabled(env: EnvLike = process.env): boolean {
  if (env.ENABLE_DEV_TOOLS !== 'true') return false;
  if (env.VERCEL_ENV === 'production') return false;
  return true;
}

/** Build identity shown in the console and by /api/dev/status. Never contains secrets. */
export function buildInfo(env: EnvLike = process.env): {
  deployEnv: string; branch: string; commit: string; version: string;
} {
  return {
    deployEnv: env.VERCEL_ENV ?? env.NEXT_PUBLIC_DEPLOY_ENV ?? 'local',
    branch: env.VERCEL_GIT_COMMIT_REF ?? 'local',
    commit: (env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'local',
    version: env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
  };
}
