import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { clearMockMode, setMockMode, waitForLanguages, pickOption } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { LanguageSelect } from './LanguageSelect'

describe('LanguageSelect', () => {
  it('shows a disabled loading option until the languages arrive', async () => {
    // Arrange
    renderWithProviders(<LanguageSelect id="l" label="Language" value="" onChange={vi.fn()} />)
    // Act
    const select = screen.getByLabelText('Language')
    // Assert
    expect(select).toBeDisabled()
    expect(select).toHaveTextContent('Loading languages…')
    await waitForLanguages()
    expect(select).toBeEnabled()
  })

  it('reports the chosen language code', async () => {
    // Arrange
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<LanguageSelect id="l" label="Language" value="es" onChange={onChange} />)
    await waitForLanguages()
    // Act
    await pickOption(user, screen.getByLabelText('Language'), 'Italian')
    // Assert
    expect(onChange).toHaveBeenCalledWith('it')
  })

  it('can offer an option for every language', async () => {
    // Arrange
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<LanguageSelect id="l" label="Language" value="es" onChange={onChange} allLabel="All languages" />)
    await waitForLanguages()
    // Act
    await pickOption(user, screen.getByLabelText('Language'), 'All languages')
    // Assert
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('offers a retry when the languages cannot load', async () => {
    // Arrange
    setMockMode('error')
    const user = userEvent.setup()
    renderWithProviders(<LanguageSelect id="l" label="Language" value="" onChange={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    clearMockMode()
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    await waitForLanguages()
  })
})
