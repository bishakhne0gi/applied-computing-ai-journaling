import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiUrl, setMockMode, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { ENDPOINTS } from '@/utils/endpoints'
import { STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from './WriteScreen'

function countChecks(): { count: number } {
  const seen = { count: 0 }
  server.use(
    http.post(apiUrl(ENDPOINTS.check), () => {
      seen.count += 1
    }),
  )
  return seen
}

async function renderWithDraft(text: string) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  return userEvent.setup()
}

describe('ComposerEditor live hint states', () => {
  it('turns off with the Live hints switch and remembers it', async () => {
    // Arrange
    const user = await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await screen.findByRole('button', { name: '1 hint' })
    // Act
    await user.click(screen.getByRole('switch', { name: 'Live hints' }))
    // Assert
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEYS.liveHints)).toBe('off')
  })

  it('stays silent when live hints are unavailable', async () => {
    // Arrange
    setMockMode('check-unavailable')
    const seen = countChecks()
    // Act
    await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await delay(100)
    // Assert
    expect(seen.count).toBe(1)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /hint/ })).not.toBeInTheDocument()
  })

  it('waits for three words before checking', async () => {
    // Arrange
    const seen = countChecks()
    // Act
    await renderWithDraft('Hola yo')
    await delay(100)
    // Assert
    expect(seen.count).toBe(0)
  })

  it('does not check while the switch is off', async () => {
    // Arrange
    localStorage.setItem(STORAGE_KEYS.liveHints, 'off')
    const seen = countChecks()
    // Act
    await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await delay(100)
    // Assert
    expect(seen.count).toBe(0)
  })

  it('hides hints after a server error instead of showing stale ones', async () => {
    // Arrange
    server.use(http.post(apiUrl(ENDPOINTS.check), () => HttpResponse.json({ status: 500 }, { status: 500 })))
    // Act
    await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await delay(100)
    // Assert
    expect(screen.queryByRole('button', { name: /hint/ })).not.toBeInTheDocument()
  })
})
