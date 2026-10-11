import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { holdResponse, setMockMode, waitForLanguages } from '@/test/helpers'
import { renderWithProviders } from '@/test/renderWithProviders'
import { ENDPOINTS } from '@/utils/endpoints'
import { Workspace } from './Workspace'

const main = () => screen.getByRole('main')
const sidebar = () => screen.getByRole('complementary', { name: 'Your entries' })

async function submitEntry() {
  const user = userEvent.setup()
  renderWithProviders(<Workspace />)
  await waitForLanguages()
  await user.type(within(main()).getByLabelText('Your entry'), 'Hoy yo es feliz.')
  await user.click(within(main()).getByRole('button', { name: 'Get feedback' }))
  return user
}

async function leaveWhileAnalysing(user: ReturnType<typeof userEvent.setup>) {
  await within(main()).findByText('Saved. Analyzing…')
  await user.click(await within(sidebar()).findByRole('link', { name: /Je suis allé au marché/ }))
}

describe('Workspace background toasts', () => {
  it('tells the learner when feedback arrives after they left the composer', async () => {
    // Arrange
    const release = holdResponse('post', ENDPOINTS.analyses(':entryId'))
    const user = await submitEntry()
    // Act
    await leaveWhileAnalysing(user)
    release()
    // Assert
    expect(await screen.findByText(/Feedback is ready/)).toBeInTheDocument()
  })

  it('says so when that analysis fails', async () => {
    // Arrange
    setMockMode('analysis-fail')
    const release = holdResponse('post', ENDPOINTS.analyses(':entryId'))
    const user = await submitEntry()
    // Act
    await leaveWhileAnalysing(user)
    release()
    // Assert
    expect(await screen.findByText(/did not finish/)).toBeInTheDocument()
  })

  it('stays quiet while the feedback appears where the learner is looking', async () => {
    // Arrange + Act
    await submitEntry()
    // Assert
    expect(await within(main()).findByRole('heading', { name: 'Feedback' })).toBeInTheDocument()
    expect(screen.queryByText(/Feedback is ready/)).not.toBeInTheDocument()
  })
})
