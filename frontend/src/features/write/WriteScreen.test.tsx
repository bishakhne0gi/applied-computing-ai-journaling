import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { waitForLanguages, pickOption } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { STORAGE_KEYS } from '@/utils/constants'
import { WriteScreen } from './WriteScreen'

describe('WriteScreen while drafting', () => {
  it('preselects the last language used', async () => {
    // Arrange
    localStorage.setItem(STORAGE_KEYS.language, 'fr')
    // Act
    renderWithProviders(<WriteScreen />)
    await waitForLanguages()
    // Assert
    expect(screen.getByLabelText('Language')).toHaveTextContent('French')
  })

  it('falls back to the first language when the remembered one is no longer offered', async () => {
    // Arrange
    localStorage.setItem(STORAGE_KEYS.language, 'xx')
    // Act
    renderWithProviders(<WriteScreen />)
    await waitForLanguages()
    // Assert
    expect(screen.getByLabelText('Language')).toHaveTextContent('Spanish')
  })

  it('remembers a newly chosen language', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<WriteScreen />)
    await waitForLanguages()
    // Act
    await pickOption(user, screen.getByLabelText('Language'), 'German')
    // Assert
    expect(localStorage.getItem(STORAGE_KEYS.language)).toBe('de')
  })

  it('restores the draft kept on this device', () => {
    // Arrange
    localStorage.setItem(STORAGE_KEYS.draft, 'Hola otra vez')
    // Act
    renderWithProviders(<WriteScreen />)
    // Assert
    expect(screen.getByLabelText('Your entry')).toHaveValue('Hola otra vez')
    expect(screen.getByRole('status')).toHaveTextContent('Draft kept on this device')
  })

  it('autosaves the draft and counts words as you type', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<WriteScreen />)
    // Act
    await user.type(screen.getByLabelText('Your entry'), 'Hoy es lunes')
    // Assert
    expect(localStorage.getItem(STORAGE_KEYS.draft)).toBe('Hoy es lunes')
    expect(screen.getByText('3 words')).toBeInTheDocument()
  })

  it('explains the bracket fallback for words you do not know yet', () => {
    // Arrange + Act
    renderWithProviders(<WriteScreen />)
    // Assert
    expect(screen.getByLabelText('Your entry')).toHaveAccessibleDescription(/in English in \[brackets\]/)
  })

  it('keeps "Get feedback" disabled until there is text', async () => {
    // Arrange
    renderWithProviders(<WriteScreen />)
    // Act
    await waitForLanguages()
    // Assert
    expect(screen.getByRole('button', { name: 'Get feedback' })).toBeDisabled()
  })
})
