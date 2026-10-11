import { describe, expect, it } from 'vitest'
import { analyzeText, failedAnalysis } from './analyzer'

const slice = (text: string, start: number | null, end: number | null) =>
  Array.from(text)
    .slice(start ?? 0, end ?? 0)
    .join('')

describe('mock analyzer', () => {
  it('places every mistake at code-point offsets that slice back to its snippet', () => {
    // Arrange
    const text = 'Hoy 😀 la problema fue difícil, pero yo es optimista en el [park].'
    // Act
    const analysis = analyzeText('entry-1', text)
    // Assert
    expect(analysis.mistakes.map((m) => slice(text, m.start, m.end))).toEqual(['la problema', 'yo es', '[park]'])
    expect(analysis.mistakes.map((m) => m.kind)).toEqual(['error', 'error', 'vocab_help'])
  })

  it('writes the corrected text with every fix applied', () => {
    // Arrange
    const text = 'Ayer yo es feliz en el [park].'
    // Act
    const analysis = analyzeText('entry-1', text)
    // Assert
    expect(analysis.corrected_text).toBe('Ayer yo soy feliz en el parque.')
    expect(analysis.feedback_summary).toBe('Good effort! 2 things to look at.')
  })

  it('praises text with nothing to fix', () => {
    // Arrange
    const text = 'Ayer fui feliz.'
    // Act
    const analysis = analyzeText('entry-1', text)
    // Assert
    expect(analysis.mistakes).toEqual([])
    expect(analysis.feedback_summary).toBe('Great job, no mistakes found!')
  })

  it('does not match a phrase hidden inside a longer word', () => {
    // Arrange
    const text = 'Entré en la sala el lunes.'
    // Act
    const analysis = analyzeText('entry-1', text)
    // Assert
    expect(analysis.mistakes).toEqual([])
  })

  it('records a timeout as a failed analysis with no mistakes', () => {
    // Arrange
    const text = 'Hola'
    // Act
    const analysis = failedAnalysis('entry-1', text)
    // Assert
    expect(analysis).toMatchObject({ status: 'failed', error_code: 'provider_timeout', mistakes: [], corrected_text: null })
  })
})
