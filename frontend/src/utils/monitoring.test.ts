import { beforeEach, describe, expect, it, vi } from 'vitest'

const { init } = vi.hoisted(() => ({ init: vi.fn() }))
vi.mock('@sentry/react', () => ({ init }))

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
        dataCollection: expect.objectContaining({ userInfo: false, cookies: false }),
      }),
    )
  })
})
