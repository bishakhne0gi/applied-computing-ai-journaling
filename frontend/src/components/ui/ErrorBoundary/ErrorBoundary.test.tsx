import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { ErrorBoundary } from '.'

function Flaky({ broken }: { broken: boolean }) {
  if (broken) throw new Error('chunk failed')
  return <p>Loaded</p>
}

function Harness() {
  const [broken, setBroken] = useState(true)
  return (
    <ErrorBoundary onRetry={() => setBroken(false)} fallback={(retry) => <Button onClick={retry}>Try again</Button>}>
      <Flaky broken={broken} />
    </ErrorBoundary>
  )
}

// React reports every caught render error to console.error; silence it so the expected failure stays quiet.
beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined))
afterEach(() => vi.restoreAllMocks())

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    // Arrange + Act
    render(
      <ErrorBoundary fallback={() => <p>Broken</p>}>
        <p>Fine</p>
      </ErrorBoundary>,
    )
    // Assert
    expect(screen.getByText('Fine')).toBeInTheDocument()
  })

  it('shows the fallback when a child throws, and renders the children again after a retry', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<Harness />)
    // Act
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // Assert
    expect(screen.getByText('Loaded')).toBeInTheDocument()
  })
})
