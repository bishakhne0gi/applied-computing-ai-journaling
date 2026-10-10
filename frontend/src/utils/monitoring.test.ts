import { beforeEach, describe, expect, it, vi } from 'vitest'

const { init, breadcrumbsIntegration } = vi.hoisted(() => ({
  init: vi.fn(),
  breadcrumbsIntegration: vi.fn((options: object) => ({ name: 'Breadcrumbs', options })),
}))
vi.mock('@sentry/react', () => ({ init, breadcrumbsIntegration }))

import { initMonitoring } from './monitoring'

describe('initMonitoring', () => {
  beforeEach(() => init.mockClear())

  it('stays off without a DSN so local runs send nothing', async () => {
    // Arrange
    const dsn = ''
    // Act
    await initMonitoring(dsn)
    // Assert
    expect(init).not.toHaveBeenCalled()
  })

  it('initialises Sentry without personal data when a DSN is set', async () => {
    // Arrange
    const dsn = 'https://key@o1.ingest.sentry.io/1'
    // Act
    await initMonitoring(dsn)
    // Assert
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn,
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
      }),
    )
  })

  it('never records clicked elements, whose aria-labels can carry entry text', async () => {
    // Arrange
    const dsn = 'https://key@o1.ingest.sentry.io/1'
    // Act
    await initMonitoring(dsn)
    // Assert
    expect(breadcrumbsIntegration).toHaveBeenCalledWith(expect.objectContaining({ dom: false }))
    const { integrations } = init.mock.calls[0]?.[0] ?? {}
    expect(integrations).toContainEqual(expect.objectContaining({ name: 'Breadcrumbs' }))
  })
})
