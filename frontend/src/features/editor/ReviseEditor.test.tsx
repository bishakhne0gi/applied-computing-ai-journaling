import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { failWith } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENDPOINTS } from '@/utils/endpoints'
import { ReviseEditor } from './ReviseEditor'

const renderEditor = (onDone = vi.fn(), onCancel = vi.fn()) => {
  renderWithProviders(<ReviseEditor entryId={SEEDED.unanalysed} initialText="Hola" onDone={onDone} onCancel={onCancel} />)
  return userEvent.setup()
}

describe('ReviseEditor', () => {
  it('starts from the entry text with focus in the editor', () => {
    // Arrange + Act
    renderEditor()
    // Assert
    expect(screen.getByLabelText('Revise your entry')).toHaveValue('Hola')
    expect(screen.getByLabelText('Revise your entry')).toHaveFocus()
  })

  it('saves, re-checks and then reports it is done', async () => {
    // Arrange
    const onDone = vi.fn()
    const user = renderEditor(onDone)
    // Act
    await user.type(screen.getByLabelText('Revise your entry'), ' mundo')
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
  })

  it('keeps the text and explains why when saving fails', async () => {
    // Arrange
    failWith('patch', ENDPOINTS.entry(':entryId'))
    const user = renderEditor()
    // Act
    await user.click(screen.getByRole('button', { name: 'Re-check' }))
    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/on our side/)
    expect(screen.getByLabelText('Revise your entry')).toHaveValue('Hola')
  })

  it('will not re-check blank text', async () => {
    // Arrange
    const user = renderEditor()
    // Act
    await user.clear(screen.getByLabelText('Revise your entry'))
    // Assert
    expect(screen.getByRole('button', { name: 'Re-check' })).toBeDisabled()
  })

  it('cancels without saving', async () => {
    // Arrange
    const onCancel = vi.fn()
    const user = renderEditor(vi.fn(), onCancel)
    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    // Assert
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
