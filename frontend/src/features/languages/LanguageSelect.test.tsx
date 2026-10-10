import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { clearMockMode, setMockMode, waitForLanguages } from '@/test/helpers'
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
    expect(screen.getByRole('option', { name: 'Loading languages…' })).toBeInTheDocument()
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
    await user.selectOptions(screen.getByLabelText('Language'), 'it')
    // Assert
    expect(onChange).toHaveBeenCalledWith('it')
  })

  it('can offer an option for every language', async () => {
    // Arrange
    renderWithProviders(<LanguageSelect id="l" label="Language" value="" onChange={vi.fn()} allLabel="All languages" />)
    // Act
    await waitForLanguages()
    // Assert
    expect(screen.getByRole('option', { name: 'All languages' })).toHaveValue('')
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
