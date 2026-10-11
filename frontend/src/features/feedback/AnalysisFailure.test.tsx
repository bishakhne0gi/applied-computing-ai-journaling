import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildAnalysis } from '@/mocks/factories'
import { AnalysisFailure } from './AnalysisFailure'

describe('AnalysisFailure', () => {
  it('explains a failed analysis and retries it', async () => {
    // Arrange
    const onRetry = vi.fn()
    const failed = buildAnalysis({ status: 'failed', error_code: 'provider_timeout', mistakes: [] })
    render(<AnalysisFailure analysis={failed} requestError={null} isRetrying={false} onRetry={onRetry} />)
    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry analysis' }))
    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent('The AI took too long to respond. Your entry is saved. Try again.')
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('explains a request that never reached the server', () => {
    // Arrange
    const requestError = new TypeError('Failed to fetch')
    // Act
    render(<AnalysisFailure analysis={null} requestError={requestError} isRetrying={false} onRetry={vi.fn()} />)
    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't reach the server. Check your connection and try again. Your entry is saved.")
  })

  it('disables the retry while it runs', () => {
    // Arrange
    const isRetrying = true
    // Act
    render(<AnalysisFailure analysis={null} requestError={null} isRetrying={isRetrying} onRetry={vi.fn()} />)
    // Assert
    expect(screen.getByRole('button', { name: 'Retrying…' })).toBeDisabled()
  })
})
