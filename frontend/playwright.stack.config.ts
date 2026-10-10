import { defineConfig, devices } from '@playwright/test'

// Drives an already running Compose stack (nginx + backend + Postgres); `make e2e-stack` starts and stops it.
export default defineConfig({
  testDir: 'e2e-stack',
  reporter: [['list']],
  timeout: 60_000,
  use: {
    baseURL: process.env.STACK_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
  ],
})
