import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from '.'

// motion caches the OS preference at module load; mocking the hook is the only way to flip it per file.
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

describe('Select with reduced motion', () => {
  it('shows the list in place instead of fading and sliding it in', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Select id="s" aria-label="Language" value="es" options={[{ value: 'es', label: 'Spanish' }]} onChange={vi.fn()} />)
    // Act
    await user.click(screen.getByRole('combobox', { name: 'Language' }))
    // Assert
    const style = screen.getByRole('listbox').getAttribute('style') ?? ''
    expect(style).not.toContain('opacity: 0')
    expect(style).not.toContain('translate')
  })
})
