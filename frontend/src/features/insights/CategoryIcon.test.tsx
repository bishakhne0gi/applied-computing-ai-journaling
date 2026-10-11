import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Category } from '@/types/analysis'
import { CategoryIcon } from './CategoryIcon'

const CATEGORIES: Category[] = [
  'verb_conjugation', 'verb_tense', 'gender_agreement', 'number_agreement', 'article', 'preposition',
  'word_order', 'spelling', 'vocabulary', 'punctuation', 'other',
]

describe('CategoryIcon', () => {
  it.each(CATEGORIES)('draws a decorative glyph for %s', (category) => {
    // Arrange / Act
    const { container } = render(<CategoryIcon category={category} />)
    // Assert
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
