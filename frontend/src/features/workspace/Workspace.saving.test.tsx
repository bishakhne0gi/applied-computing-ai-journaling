import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { listEntries } from '@/mocks/db'
import { seedStore } from '@/mocks/seed'
import { slowDown, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { server } from '@/test/server'
import { STORAGE_KEYS } from '@/utils/constants'
import { ENDPOINTS } from '@/utils/endpoints'
import { Workspace } from './Workspace'

const main = () => screen.getByRole('main')
const sidebar = () => screen.getByRole('complementary', { name: 'Your entries' })
const entryCount = () => listEntries(null, null, 50)?.items.length

const requests: string[] = []
const record = ({ request }: { request: Request }) => {
  requests.push(`${request.method} ${new URL(request.url).pathname}`)
}

afterEach(() => {
  server.events.removeAllListeners()
  requests.length = 0
})

describe('Workspace while an entry is saving', () => {
  it('finishes the save after the learner opens another entry: draft cleared, analysis started, no duplicate', async () => {
    // Arrange
    server.events.on('request:start', record)
    localStorage.setItem(STORAGE_KEYS.draft, 'Hoy yo es feliz.')
    slowDown('post', ENDPOINTS.entries, 300)
    const user = userEvent.setup()
    renderWithProviders(<Workspace />)
    await waitForLanguages()
    await user.click(within(main()).getByRole('button', { name: 'Get feedback' }))
    await within(main()).findByRole('button', { name: 'Saving…' })
    // Act
    await user.click(await within(sidebar()).findByRole('link', { name: /Je suis allé au marché/ }))
    // Assert
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEYS.draft)).toBeNull())
    await waitFor(() => expect(requests.some((r) => /^POST .*\/entries\/[^/]+\/analyses$/.test(r))).toBe(true))
    await user.click(within(sidebar()).getByRole('button', { name: 'New entry' }))
    expect(within(main()).getByLabelText('Your entry')).toHaveValue('')
    expect(entryCount()).toBe(seedStore().entries.length + 1)
  })

  it('treats a malformed entry id as not found without asking the server', async () => {
    // Arrange
    server.events.on('request:start', record)
    // Act
    renderWithProviders(<Workspace />, { route: '/?entry=not-an-id' })
    // Assert
    expect(await within(main()).findByRole('heading', { level: 1, name: 'Entry not found' })).toBeInTheDocument()
    await waitForLanguages()
    expect(requests.filter((r) => r.includes('not-an-id'))).toEqual([])
  })
})
