import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '.'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

function Trigger() {
  const { show } = useToast()
  return <Button onClick={() => show({ message: 'Saved' })}>Notify</Button>
}

describe('Toast with reduced motion', () => {
  it('fades in place instead of rising', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    // Act
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Assert
    expect(screen.getByRole('status').getAttribute('style') ?? '').not.toContain('translate')
  })
})
