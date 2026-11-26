import { defineConfig } from '@playwright/test'

// Uses the installed Chrome (no browser download). Runs against the production build.
export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'pnpm exec vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
})
