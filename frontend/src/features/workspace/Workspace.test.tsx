import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SEEDED } from '@/mocks/seed'
import { waitForLanguages } from '@/test/helpers'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { Workspace } from './Workspace'

const MISSING = 'ffffffff-ffff-4fff-8fff-ffffffffffff'

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

const sidebar = () => screen.getByRole('complementary', { name: 'Your entries' })
const main = () => screen.getByRole('main')
const location = () => screen.getByLabelText('Location')
const marketRow = () => within(sidebar()).findByRole('link', { name: /Je suis allé au marché/ })

describe('Workspace', () => {
  it('opens an entry from the sidebar in place, marks its row and focuses its heading', async () => {
    // Arrange
    const user = renderWorkspace()
    // Act
    await user.click(await marketRow())
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry' })).toHaveFocus()
    expect(await marketRow()).toHaveAttribute('aria-current', 'true')
    expect(location()).toHaveTextContent(`/?entry=${SEEDED.revisedFrench}`)
    expect(within(main()).queryByLabelText('Your entry')).not.toBeInTheDocument()
  })

  it('starts a new entry from the sidebar: selection cleared, editor focused', async () => {
    // Arrange
    const user = renderWorkspace(`/?entry=${SEEDED.emoji}`)
    await within(main()).findByRole('heading', { level: 1, name: 'Entry' })
    // Act
    await user.click(within(sidebar()).getByRole('button', { name: 'New entry' }))
    // Assert
    expect(within(main()).getByLabelText('Your entry')).toHaveFocus()
    expect(location()).toHaveTextContent(/^\/$/)
  })

  it('keeps the draft when the learner peeks at an old entry and comes back', async () => {
    // Arrange
    const user = renderWorkspace()
    await waitForLanguages()
    await user.type(within(main()).getByLabelText('Your entry'), 'Hola amigos')
    await user.click(await marketRow())
    await within(main()).findByRole('heading', { level: 1, name: 'Entry' })
    // Act
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    // Assert
    expect(await within(main()).findByLabelText('Your entry')).toHaveValue('Hola amigos')
  })

  it('leaves focus alone when a deep link opens an entry', async () => {
    // Arrange + Act
    renderWorkspace(`/?entry=${SEEDED.emoji}`)
    // Assert
    expect(await within(main()).findByRole('heading', { level: 2, name: 'Feedback' })).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })

  it('leaves focus alone on a first load of the composer', async () => {
    // Arrange + Act
    renderWorkspace('/')
    await waitForLanguages()
    // Assert
    expect(within(main()).getByLabelText('Your entry')).toBeInTheDocument()
    expect(document.body).toHaveFocus()
  })

  it('explains a missing entry in the main column and keeps the sidebar usable', async () => {
    // Arrange + Act
    renderWorkspace(`/?entry=${MISSING}&language=fr`)
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry not found' })).toBeInTheDocument()
    expect(within(main()).getByRole('link', { name: 'Write a new entry' })).toHaveAttribute('href', '/?language=fr')
    expect(await marketRow()).toBeInTheDocument()
  })

  it('treats a mangled entry id as not found rather than an error to retry', async () => {
    // Arrange + Act
    renderWorkspace('/?entry=not-an-id')
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry not found' })).toBeInTheDocument()
    expect(within(main()).queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  })
})
