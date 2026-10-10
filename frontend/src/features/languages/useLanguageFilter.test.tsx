import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/Button'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useLanguageFilter } from './useLanguageFilter'

function Probe() {
  const filter = useLanguageFilter()
  const { search } = useLocation()
  return (
    <>
      <output aria-label="query">{search}</output>
      <Button onClick={() => filter.changeLanguage('es')}>pick es</Button>
      <Button onClick={() => filter.changeLanguage('')}>clear</Button>
    </>
  )
}

const query = () => screen.getByLabelText('query')

describe('useLanguageFilter', () => {
  it('keeps other query params when the language changes or is cleared', async () => {
    // Arrange
    const user = userEvent.setup()
    renderWithProviders(<Probe />, { route: '/?sort=old&language=it' })
    // Act
    await user.click(screen.getByRole('button', { name: 'pick es' }))
    // Assert
    expect(query()).toHaveTextContent('?sort=old&language=es')
    await user.click(screen.getByRole('button', { name: 'clear' }))
    expect(query()).toHaveTextContent(/^\?sort=old$/)
  })

  it('drops only a language the server does not offer', async () => {
    // Arrange + Act
    renderWithProviders(<Probe />, { route: '/?sort=old&language=xx' })
    // Assert
    await waitFor(() => expect(query()).toHaveTextContent(/^\?sort=old$/))
  })
})
