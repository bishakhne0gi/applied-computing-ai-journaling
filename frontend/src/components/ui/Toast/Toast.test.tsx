import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { ToastProvider, useToast } from '.'

function Trigger({ message = 'Feedback ready' }: { message?: string }) {
  const { show } = useToast()
  return <Button onClick={() => show({ message, tone: 'success' })}>Notify</Button>
}

const polite = () => document.querySelector('[aria-live="polite"]') as HTMLElement
const assertive = () => document.querySelector('[aria-live="assertive"]') as HTMLElement

const renderToasts = (duration?: number) =>
  render(
    <ToastProvider duration={duration}>
      <Trigger />
    </ToastProvider>,
  )

describe('Toast', () => {
  afterEach(() => vi.useRealTimers())

  it('announces a message in the polite region and dismisses it on request', async () => {
    // Arrange
    const user = userEvent.setup()
    renderToasts()
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    expect(polite()).toHaveTextContent('Feedback ready')
    // Act
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    // Assert
    expect(screen.queryByText('Feedback ready')).not.toBeInTheDocument()
  })

  it('dismisses itself after its duration', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToasts(1000)
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Act
    act(() => vi.advanceTimersByTime(900))
    // Assert
    expect(screen.getByText('Feedback ready')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(100))
    expect(screen.queryByText('Feedback ready')).not.toBeInTheDocument()
  })

  it('pauses the countdown while hovered and resumes with the time left', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToasts(1000)
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    act(() => vi.advanceTimersByTime(600))
    // Act
    await user.hover(screen.getByText('Feedback ready'))
    act(() => vi.advanceTimersByTime(5000))
    // Assert
    expect(screen.getByText('Feedback ready')).toBeInTheDocument()
    await user.unhover(screen.getByText('Feedback ready'))
    act(() => vi.advanceTimersByTime(300))
    expect(screen.getByText('Feedback ready')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(150))
    expect(screen.queryByText('Feedback ready')).not.toBeInTheDocument()
  })

  it('pauses while focus is inside and resumes on blur', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderToasts(1000)
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Act
    await user.tab()
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toHaveFocus()
    act(() => vi.advanceTimersByTime(5000))
    // Assert
    expect(screen.getByText('Feedback ready')).toBeInTheDocument()
    await user.tab()
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByText('Feedback ready')).not.toBeInTheDocument()
  })

  it('announces danger toasts in a persistent assertive region, others in a polite one', async () => {
    // Arrange
    const user = userEvent.setup()
    function Both() {
      const { show } = useToast()
      return <Button onClick={() => { show({ message: 'Saved', tone: 'success' }); show({ message: 'Broke', tone: 'danger' }) }}>Both</Button>
    }
    render(<ToastProvider><Both /></ToastProvider>)
    const status = polite()
    const alert = assertive()
    expect(status).toBeEmptyDOMElement()
    expect(alert).toBeEmptyDOMElement()
    // Act
    await user.click(screen.getByRole('button', { name: 'Both' }))
    // Assert
    expect(status).toHaveTextContent('Saved')
    expect(status).not.toHaveTextContent('Broke')
    expect(alert).toHaveTextContent('Broke')
  })

  it('keeps at most three on screen, dropping the oldest', async () => {
    // Arrange
    const user = userEvent.setup()
    renderToasts()
    // Act
    for (let i = 0; i < 4; i += 1) await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Assert
    expect(screen.getAllByRole('button', { name: 'Dismiss notification' })).toHaveLength(3)
  })

  it('does nothing without a provider, so isolated components still render', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Trigger />)
    // Act
    await user.click(screen.getByRole('button', { name: 'Notify' }))
    // Assert
    expect(screen.queryByText('Feedback ready')).not.toBeInTheDocument()
  })
})
