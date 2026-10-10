import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/renderWithProviders'
import App from './App'

describe('App shell', () => {
  it('names the product in the top-level heading so every page has an accessible title', () => {
    // Arrange
    renderWithProviders(<App />)
    // Act
    const heading = screen.getByRole('heading', { level: 1 })
    // Assert
    expect(heading).toHaveTextContent('Language Journal')
  })
})
