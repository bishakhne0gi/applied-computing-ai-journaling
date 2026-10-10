import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CategoryInsightOut } from '@/types/insights'
import { CategoryTable } from './CategoryTable'

const verbs: CategoryInsightOut = {
  category: 'verb_conjugation',
  occurrences: 3,
  recent_entries: 3,
  recurring: true,
  earlier_rate: 0,
  recent_rate: 8.6,
  trend: 'worsening',
  latest_example: { original: 'yo es', correction: 'yo soy' },
}
const articles: CategoryInsightOut = { ...verbs, category: 'article', occurrences: 1, recent_entries: 1, recurring: false, trend: 'improving' }

describe('CategoryTable', () => {
  it('shows the rate change, a worded trend and the latest example for each category', () => {
    // Arrange + Act
    render(<CategoryTable categories={[verbs, articles]} recurringWindow={5} />)
    // Assert
    const row = screen.getByRole('row', { name: /Verb conjugation/ })
    expect(row).toHaveTextContent(/0\.0 →\s?to 8\.6/)
    expect(row).toHaveTextContent('Getting worse')
    expect(row).toHaveTextContent(/yo es →\s?should be yo soy/)
    expect(screen.getByRole('row', { name: /Article/ })).toHaveTextContent('Improving')
  })

  it('marks only recurring categories, with how often they appeared', () => {
    // Arrange + Act
    render(<CategoryTable categories={[verbs, articles]} recurringWindow={5} />)
    // Assert
    expect(screen.getByText('Recurring · 3 of last 5')).toBeInTheDocument()
    expect(screen.getAllByText(/^Recurring/)).toHaveLength(1)
  })

  it('says there is no trend yet instead of showing blank cells', () => {
    // Arrange
    const early = { ...verbs, earlier_rate: null, recent_rate: null, trend: null }
    // Act
    render(<CategoryTable categories={[early]} recurringWindow={3} />)
    // Assert
    expect(screen.getAllByText('Not enough entries yet')).toHaveLength(2)
  })
})
