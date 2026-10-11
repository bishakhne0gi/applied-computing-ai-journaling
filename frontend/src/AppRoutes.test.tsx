import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { AppRoutes } from './AppRoutes'

const renderAt = (route: string) =>
  renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    { route },
  )
const location = () => screen.getByLabelText('Location')

// The sheet is code-split; loading it up front keeps a cold transform (slow under coverage) out of the 1s findBy budget.
beforeAll(() => import('@/features/workspace/InsightsSheet'))

describe('routes', () => {
  it('opens the workspace at the root: brand, composer and entries', async () => {
    // Arrange + Act
    renderAt('/')
    // Assert
    expect(screen.getByRole('link', { name: 'Language Journal' })).toHaveAttribute('href', '/')
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Write' })).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Entries' })).toBeInTheDocument()
  })

  it.each([
    ['/entries', '/'],
    ['/entries?language=fr', '/?language=fr'],
    ['/insights?language=fr', '/?language=fr&insights=1'],
    [`/entries/${SEEDED.emoji}`, `/?entry=${SEEDED.emoji}`],
    [`/entries/${SEEDED.emoji}?language=es`, `/?language=es&entry=${SEEDED.emoji}`],
  ])('redirects the old link %s into the workspace at %s', async (route, target) => {
    // Arrange + Act
    renderAt(route)
    // Assert
    await waitFor(() => expect(location()).toHaveTextContent(target))
    expect(location().textContent).toBe(target)
  })

  it('opens insights as a sheet for the old /insights link', async () => {
    // Arrange + Act
    renderAt('/insights')
    // Assert
    expect(await screen.findByRole('dialog', { name: 'Insights' })).toBeInTheDocument()
  })

  it('leaves focus alone on first load, even through a redirect', async () => {
    // Arrange + Act
    renderAt(`/entries/${SEEDED.emoji}`)
    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: 'Entry' })).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })

  it('shows a not-found page with a way back for unknown paths', () => {
    // Arrange + Act
    renderAt('/nowhere')
    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to writing' })).toHaveAttribute('href', '/')
  })

  it('moves focus to the workspace heading when coming back from a missing page', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/nowhere')
    // Act
    await user.click(screen.getByRole('link', { name: 'Back to writing' }))
    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: 'Write' })).toHaveFocus()
  })

  it.each(['/', '/nowhere'])('offers a skip link to the main content on %s', (route) => {
    // Arrange + Act
    renderAt(route)
    // Assert
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })

  it('does not steal focus when only the filter changes', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    const filter = await screen.findByLabelText('Filter by language')
    await within(filter).findByRole('option', { name: 'Spanish' })
    // Act
    await user.selectOptions(filter, 'es')
    // Assert
    expect(filter).toHaveFocus()
  })

  it.each([
    ['/', 'Write · Language Journal'],
    [`/?entry=${SEEDED.emoji}`, 'Entry · Language Journal'],
    ['/?insights=1', 'Write · Language Journal'],
    ['/nowhere', 'Page not found · Language Journal'],
  ])('titles the document for %s', async (route, title) => {
    // Arrange + Act
    renderAt(route)
    // Assert
    await waitFor(() => expect(document.title).toBe(title))
  })
})
