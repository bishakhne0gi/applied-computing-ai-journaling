import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App shell', () => {
  it('names the product in the top-level heading so every page has an accessible title', () => {
    // Arrange
    render(<App />)
    // Act
    const heading = screen.getByRole('heading', { level: 1 })
    // Assert
    expect(heading).toHaveTextContent('Language Journal')
  })
})
