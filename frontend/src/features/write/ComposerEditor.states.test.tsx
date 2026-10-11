import { act, fireEvent, screen, waitFor } from '@testing-library/react'
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

  it('keeps the last good hints when a newer check is unavailable', async () => {
    // Arrange
    const user = await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await screen.findByRole('button', { name: '1 hint' })
    let failures = 0
    server.use(
      http.post(apiUrl(ENDPOINTS.check), () => {
        failures += 1
        return HttpResponse.json({ detail: 'unavailable' }, { status: 503 })
      }),
    )
    // Act: a new check starts for the edited text and fails, then its single retry fails too.
    await user.type(screen.getByLabelText('Your entry'), ' ya')
    await waitFor(() => expect(failures).toBe(2), { timeout: 5000 })
    await delay(50)
    // Assert
    expect(screen.getByRole('button', { name: '1 hint' })).toBeInTheDocument()
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

  it('holds the check while an IME composition is open and runs it after', async () => {
    // Arrange
    await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await screen.findByRole('button', { name: '1 hint' })
    const seen = countChecks()
    const editor = screen.getByLabelText('Your entry')
    // Act
    fireEvent.compositionStart(editor)
    fireEvent.change(editor, { target: { value: 'Hoy yo es feliz y tranquilo ya' } })
    await delay(1600)
    const during = seen.count
    fireEvent.compositionEnd(editor)
    // Assert
    expect(during).toBe(0)
    await waitFor(() => expect(seen.count).toBe(1), { timeout: 3000 })
  })

  it('does not check text over the character limit', async () => {
    // Arrange
    const seen = countChecks()
    // Act
    await renderWithDraft('palabra '.repeat(700))
    await delay(100)
    // Assert
    expect(seen.count).toBe(0)
  })

  it('does not check once the entry is being submitted', async () => {
    // Arrange
    const user = await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await screen.findByRole('button', { name: '1 hint' })
    const seen = countChecks()
    // Act
    await user.type(screen.getByLabelText('Your entry'), ' ya')
    await user.click(screen.getByRole('button', { name: 'Get feedback' }))
    await act(() => delay(1600))
    // Assert
    expect(seen.count).toBe(0)
  })

  it('announces the count after a pause, not on each keystroke that re-anchors it', async () => {
    // Arrange
    const user = await renderWithDraft('Hoy yo es feliz y tranquilo.')
    await screen.findByRole('button', { name: '1 hint' })
    const live = () => document.querySelector('[aria-live="polite"]')?.textContent
    await waitFor(() => expect(live()).toBe('1 hint'), { timeout: 3000 })
    // Act: typing onto the hinted words drops the hint at once, but the announcement waits.
    await user.type(screen.getByLabelText('Your entry'), '{Control>}{Home}{/Control}{ArrowRight>6/}x')
    // Assert
    expect(screen.queryByRole('button', { name: '1 hint' })).not.toBeInTheDocument()
    expect(live()).toBe('1 hint')
  })
})
