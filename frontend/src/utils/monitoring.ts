// Imported lazily so the Sentry bundle never costs anything when no DSN is configured.
export async function initMonitoring(dsn = import.meta.env.VITE_SENTRY_DSN): Promise<void> {
  if (!dsn) return
  const Sentry = await import('@sentry/react')
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_RELEASE,
    // Sentry 11 replaced sendDefaultPii with dataCollection; every category is off so no personal data leaves the browser.
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  })
}
