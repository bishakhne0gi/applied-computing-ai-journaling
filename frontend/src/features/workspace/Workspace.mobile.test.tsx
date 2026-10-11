import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { Workspace } from './Workspace'

// A phone: every media query answers "no", so the desktop sidebar query fails.
beforeEach(() => {
  vi.stubGlobal('matchMedia', (media: string) => ({ matches: false, media, addEventListener: () => undefined, removeEventListener: () => undefined }))
})
afterEach(() => vi.unstubAllGlobals())

async function openEntriesSheet() {
  renderWithProviders(
    <>
      <Workspace />
      <LocationProbe />
    </>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Entries' }))
  return user
}

const sheet = () => screen.getByRole('dialog', { name: 'Entries' })
const main = () => screen.getByRole('main')

describe('Workspace on a phone', () => {
  it('keeps the entries in a sheet opened from the header', async () => {
    // Arrange + Act
    await openEntriesSheet()
    // Assert
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
    expect(within(sheet()).getByRole('heading', { level: 2, name: 'Entries' })).toHaveFocus()
    expect(await within(sheet()).findByRole('list', { name: 'Entries' })).toBeInTheDocument()
  })

  it('closes when an entry is picked and focuses that entry, not the Entries button', async () => {
    // Arrange
    const user = await openEntriesSheet()
    // Act
    await user.click(await within(sheet()).findByRole('link', { name: /Je suis allé au marché/ }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry' })).toHaveFocus()
  })

  it('closes on "New entry" and focuses the editor', async () => {
    // Arrange
    const user = await openEntriesSheet()
    // Act
    await user.click(within(sheet()).getByRole('button', { name: 'New entry' }))
    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(within(main()).getByLabelText('Your entry')).toHaveFocus()
  })

  it('stays closed when the learner goes Back after picking an entry', async () => {
    // Arrange
    const user = await openEntriesSheet()
    await user.click(await within(sheet()).findByRole('link', { name: /Je suis allé au marché/ }))
    await within(main()).findByRole('heading', { level: 1, name: 'Entry' })
    // Act
    await user.click(screen.getByRole('button', { name: 'Go back' }))
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Write' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('makes way for insights opened from the progress card', async () => {
    // Arrange
    const user = await openEntriesSheet()
    // Act
    await user.click(within(sheet()).getByRole('button', { name: 'Open insights' }))
    // Assert
    expect(screen.queryByRole('dialog', { name: 'Entries' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Insights' })).toBeInTheDocument()
  })
})
