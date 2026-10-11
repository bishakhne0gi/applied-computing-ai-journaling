import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { WorkspaceHeader } from './WorkspaceHeader'

describe('WorkspaceHeader', () => {
  it('keeps the brand on one line so a phone header never wraps', () => {
    // Arrange + Act
    renderWithProviders(<WorkspaceHeader />)
    // Assert
    expect(screen.getByRole('link', { name: 'Language Journal' })).toHaveClass('whitespace-nowrap', 'shrink-0')
  })

  it('shows "All languages" without a filter, on one truncating line, hidden on phones where the row is full', async () => {
    // Arrange + Act
    renderWithProviders(<WorkspaceHeader />)
    // Assert
    expect(await screen.findByText('All languages')).toHaveClass('whitespace-nowrap', 'truncate', 'hidden', 'sm:block')
  })
})
