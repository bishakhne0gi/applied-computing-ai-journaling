import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sheet } from '.'

// motion caches the OS preference at module load; mocking the hook is the only way to flip it per file.
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

describe('Sheet with reduced motion', () => {
  it('appears in place instead of sliding', () => {
    // Arrange
    const onClose = vi.fn()
    // Act
    render(
      <Sheet open onClose={onClose} side="bottom" title="Entries">
        <p>List</p>
      </Sheet>,
    )
    // Assert
    expect(screen.getByRole('dialog').getAttribute('style') ?? '').not.toContain('translate')
  })
})
