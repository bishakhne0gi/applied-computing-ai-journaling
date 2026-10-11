import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '.'

function Trigger({ message = 'Feedback ready' }: { message?: string }) {
  const { show } = useToast()
  return <Button onClick={() => show({ message, tone: 'success' })}>Notify</Button>
}

const renderToasts = (duration?: number) =>
  render(
    <ToastProvider duration={duration}>
      <Trigger />
    </ToastProvider>,
  )

describe('Toast', () => {
  afterEach(() => vi.useRealTimers())

  it('announces a message as a status and dismisses it on request', async () => {
    // Arrange
    const user = userEvent.setup()
    renderToasts()
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getByRole('status')).toHaveTextContent('Feedback ready')
    // Act
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('dismisses itself after its duration', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToasts(1000)
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Act
    act(() => vi.advanceTimersByTime(1000))
    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps at most three on screen, dropping the oldest', async () => {
    // Arrange
    const user = userEvent.setup()
    renderToasts()
    // Act
    for (let i = 0; i < 4; i += 1) await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Assert
    expect(screen.getAllByRole('status')).toHaveLength(3)
  })

  it('does nothing without a provider, so isolated components still render', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Trigger />)
    // Act
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
