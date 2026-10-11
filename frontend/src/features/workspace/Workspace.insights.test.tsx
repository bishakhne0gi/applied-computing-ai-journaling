import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it } from 'vitest'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { Workspace } from './Workspace'

// The sheet is code-split; loading it up front keeps a cold transform (slow under coverage) out of the 1s findBy budget.
beforeAll(() => import('./InsightsSheet'))

function renderWorkspace(route = '/') {
  renderWithProviders(
    <>
      <Workspace />
      <LocationProbe />
    </>,
    { route },
  )
  return userEvent.setup()
}

const dialog = () => screen.findByRole('dialog', { name: 'Insights' })
const insightsButton = () => screen.getByRole('button', { name: 'Insights' })
const location = () => screen.getByLabelText('Location')

describe('Workspace insights', () => {
  it('opens from the header as a dialog focused on its heading and recorded in the URL', async () => {
    // Arrange
    const user = renderWorkspace()
    // Act
    await user.click(insightsButton())
    // Assert
    const sheet = await dialog()
    expect(within(sheet).getByRole('heading', { level: 2, name: 'Insights' })).toHaveFocus()
    expect(insightsButton()).toHaveAttribute('aria-expanded', 'true')
    expect(location()).toHaveTextContent('/?insights=1')
    expect(await within(sheet).findByRole('region', { name: 'Summary' })).toBeInTheDocument()
  })

  it('closes on Escape by going Back, and returns focus to the header button', async () => {
    // Arrange
    const user = renderWorkspace('/?language=fr')
    await user.click(insightsButton())
    await dialog()
    // Act
    await user.keyboard('{Escape}')
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
    expect(insightsButton()).toHaveFocus()
  })

  it('opens from a deep link and closes without leaving the app', async () => {
    // Arrange
    const user = renderWorkspace('/?insights=1&language=fr')
    const sheet = await dialog()
    expect(await within(sheet).findByText('Trends start at 4 entries with feedback.')).toBeInTheDocument()
    // Act
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
  })

  it('filters insights and the entries sidebar together', async () => {
    // Arrange
    const user = renderWorkspace('/?insights=1')
    const sheet = await dialog()
    const filter = await within(sheet).findByLabelText('Filter by language')
    await within(filter).findByRole('option', { name: 'Spanish' })
    // Act
    await user.selectOptions(filter, 'es')
    await user.click(within(sheet).getByRole('button', { name: 'Close' }))
    // Assert
    const sidebar = screen.getByRole('complementary', { name: 'Your entries' })
    expect(await within(sidebar).findByLabelText('Filter by language')).toHaveValue('es')
    expect(location()).toHaveTextContent(/^\/\?language=es$/)
  })
})
