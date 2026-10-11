import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/renderWithProviders'
import { loadInsightsScreen } from './loadInsightsScreen'
import { Workspace } from './Workspace'

vi.mock('./loadInsightsScreen', () => ({ loadInsightsScreen: vi.fn() }))
const load = vi.mocked(loadInsightsScreen)
const Loaded = () => <p>Insights loaded</p>

afterEach(() => vi.restoreAllMocks())

function renderWorkspace() {
  renderWithProviders(<Workspace />, { route: '/' })
  return userEvent.setup()
}

const insightsButton = () => screen.getByRole('button', { name: 'Insights' })

describe('Workspace insights while the code loads', () => {
  it('opens the sheet at once with a loading status, and Escape still returns focus to the header button', async () => {
    // Arrange
    load.mockReturnValue(new Promise(() => undefined))
    const user = renderWorkspace()
    // Act
    await user.click(insightsButton())
    // Assert
    const sheet = screen.getByRole('dialog', { name: 'Insights' })
    expect(load).toHaveBeenCalled()
    // Skeletons from the first frame: the label is for screen readers only.
    expect(within(within(sheet).getByRole('status')).getByText('Loading insights…')).toHaveClass('sr-only')
    expect(within(sheet).getByRole('heading', { level: 2, name: 'Insights' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(insightsButton()).toHaveFocus()
  })

  it('explains a failed load inside the sheet and loads again on Try again', async () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    load.mockRejectedValueOnce(new Error('chunk failed')).mockResolvedValue({ default: Loaded })
    const user = renderWorkspace()
    await user.click(insightsButton())
    const sheet = await screen.findByRole('dialog', { name: 'Insights' })
    // Act
    await user.click(await within(sheet).findByRole('button', { name: 'Try again' }))
    // Assert
    expect(await within(sheet).findByText('Insights loaded')).toBeInTheDocument()
    expect(within(sheet).queryByRole('alert')).not.toBeInTheDocument()
  })
})
