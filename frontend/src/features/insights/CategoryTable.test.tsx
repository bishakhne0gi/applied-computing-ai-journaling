import { render, screen, within } from '@testing-library/react'
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
    render(<CategoryTable categories={[verbs, articles]} recurringWindow={5} totalWords={60} entriesToTrends={0} />)
    // Assert
    const row = screen.getByRole('row', { name: /Verb conjugation/ })
    expect(row).toHaveTextContent(/0\.0 →\s?to 8\.6/)
    expect(row).toHaveTextContent('Getting worse')
    expect(row).toHaveTextContent(/yo es\s+should be yo soy/)
    expect(screen.getByRole('row', { name: /Article/ })).toHaveTextContent('Improving')
  })

  it('marks only recurring categories, with how often they appeared', () => {
    // Arrange + Act
    render(<CategoryTable categories={[verbs, articles]} recurringWindow={5} totalWords={60} entriesToTrends={0} />)
    // Assert
    expect(screen.getByText('Recurring · 3 of last 5')).toBeInTheDocument()
    expect(screen.getAllByText(/^Recurring/)).toHaveLength(1)
  })

  it('before trends, shows each category’s rate across all entries and when its trend arrives, never a dash', () => {
    // Arrange
    const early = { ...verbs, earlier_rate: null, recent_rate: null, trend: null }
    // Act
    render(<CategoryTable categories={[early]} recurringWindow={3} totalWords={60} entriesToTrends={1} />)
    // Assert
    expect(screen.getByRole('columnheader', { name: 'Per 100 words' })).toBeInTheDocument()
    const row = screen.getByRole('row', { name: /Verb conjugation/ })
    expect(row).toHaveTextContent('5.0')
    expect(row).toHaveTextContent('After 1 more entry')
    expect(row).not.toHaveTextContent('—')
  })

  it('shows trends as arrows whose words are only for screen readers', () => {
    // Arrange
    const worsening = { ...verbs, category: 'preposition' as const }
    // Act
    render(<CategoryTable categories={[articles, worsening]} recurringWindow={5} totalWords={60} entriesToTrends={0} />)
    // Assert
    const article = screen.getByRole('row', { name: /Article/ })
    expect(within(article).getByText('Improving')).toHaveClass('sr-only')
    expect(within(article).queryByText('↓')).not.toBeInTheDocument()
    expect(within(screen.getByRole('row', { name: /Preposition/ })).getByText('Getting worse')).toHaveClass('sr-only')
  })

  it('puts the table in a focusable region that scrolls sideways instead of wrapping', () => {
    // Arrange / Act
    render(<CategoryTable categories={[verbs]} recurringWindow={5} totalWords={60} entriesToTrends={0} />)
    // Assert
    const region = screen.getByRole('region', { name: 'Errors by category' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('overflow-x-auto')
  })
})
