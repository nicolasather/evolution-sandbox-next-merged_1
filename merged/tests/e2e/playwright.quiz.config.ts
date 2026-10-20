import { defineConfig, devices } from '@playwright/test';

/** Put this file under merged/tests/e2e, or adjust testDir to match placement. */
export default defineConfig({
  testDir: '.',
  testMatch: ['projector-lab.spec.ts', 'td-practice.spec.ts', 'quiz-ui-smoke.spec.ts', 'quiz-api-security.spec.ts', 'quiz-creator.spec.ts', 'quiz-media-ui.spec.ts', 'swarm-survival.spec.ts', 'os-ui.spec.ts', 'arena-clash.spec.ts'],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/quiz', open: 'never' }]],
  use: { baseURL: process.env.BASE_URL || 'http://localhost:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure', bypassCSP: !!process.env.E2E_BYPASS_CSP, launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox'] } : undefined },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'chromium-mobile', use: { ...devices['Pixel 7'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 720 } } },
    { name: 'webkit-mobile', use: { ...devices['iPhone 13'] } },
  ],
});
