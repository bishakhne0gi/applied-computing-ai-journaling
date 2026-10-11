import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from './WriteScreen'

// Two independent mistakes, so the list has a next item to move to.
const TWO = 'Hoy yo es feliz y la problema es grande.'

async function openList(text: string) {
  localStorage.setItem(STORAGE_KEYS.draft, text)
  const user = userEvent.setup()
  renderWithProviders(<WriteScreen />)
  await waitForLanguages()
  await user.click(await screen.findByRole('button', { name: /^\d hints?$/ }))
  return user
}

describe('ComposerEditor hint list', () => {
  it('moves focus to the next hint after Accept, not back to the text', async () => {
    // Arrange
    const user = await openList(TWO)
    const accepts = screen.getAllByRole('button', { name: /^Accept/ })
    // Act
    await user.click(accepts[0] as HTMLElement)
    // Assert
    expect(accepts[1]).toHaveFocus()
  })

  it('does not leave focus in the text for even a moment after Accept in the list', async () => {
    // Arrange
    const user = await openList(TWO)
    const entry = screen.getByLabelText('Your entry')
    const accepts = screen.getAllByRole('button', { name: /^Accept/ })
    const seen: Element[] = []
    // The edit has to focus the text to be undoable; focus must have moved on before this task ends.
    entry.addEventListener('focus', () => setTimeout(() => seen.push(document.activeElement as Element), 0))
    // Act
    await user.click(accepts[0] as HTMLElement)
    await new Promise((resolve) => setTimeout(resolve, 10))
    // Assert
    expect(entry).toHaveValue('Hoy yo soy feliz y la problema es grande.')
    expect(seen).toHaveLength(1)
    expect(seen).not.toContain(entry)
    expect(accepts[1]).toHaveFocus()
  })

  it('moves focus to the switch when the last hint is gone', async () => {
    // Arrange
    const user = await openList('Hoy yo es feliz y tranquilo.')
    // Act
    await user.click(screen.getByRole('button', { name: /^Dismiss hint/ }))
    // Assert
    expect(screen.getByRole('switch', { name: 'Live hints' })).toHaveFocus()
  })

  it('does not reopen the list when new hints arrive after it emptied', async () => {
    // Arrange
    const user = await openList('Hoy yo es feliz y tranquilo.')
    await user.click(screen.getByRole('button', { name: /^Dismiss hint/ }))
    // Act
    await user.type(screen.getByLabelText('Your entry'), ' y la problema es grande')
    // Assert
    expect(await screen.findByRole('button', { name: '1 hint' }, { timeout: 3000 })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list', { name: 'Live hints' })).not.toBeInTheDocument()
  })
})
