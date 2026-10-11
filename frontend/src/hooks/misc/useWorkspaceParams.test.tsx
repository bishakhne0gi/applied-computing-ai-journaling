import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Button } from '@/components/ui/Button'
import { LocationProbe } from '@/test/LocationProbe'
import { renderWithProviders } from '@/test/renderWithProviders'
import { useWorkspaceParams } from './useWorkspaceParams'

function Probe() {
  const params = useWorkspaceParams()
  return (
    <>
      <output aria-label="State">{JSON.stringify({ entry: params.entryId, insights: params.insightsOpen, language: params.language })}</output>
      <output aria-label="Href">{params.entryHref('e2')}</output>
      <Button onClick={() => params.selectEntry('e1')}>select</Button>
      <Button onClick={() => params.selectEntry(null)}>new</Button>
      <Button onClick={params.openInsights}>open</Button>
      <Button onClick={params.closeInsights}>close</Button>
      <Button onClick={() => params.setLanguage('es')}>es</Button>
      <Button onClick={() => params.setLanguage(null)}>all</Button>
      <LocationProbe />
    </>
  )
}

const renderAt = (route: string) => {
  renderWithProviders(<Probe />, { route })
  return userEvent.setup()
}
const location = () => screen.getByLabelText('Location')
const button = (name: string) => screen.getByRole('button', { name })

describe('useWorkspaceParams', () => {
  it('reads the entry, the insights flag and the language from the URL', () => {
    // Arrange + Act
    renderAt('/?entry=e1&insights=1&language=fr')
    // Assert
    expect(screen.getByLabelText('State')).toHaveTextContent('{"entry":"e1","insights":true,"language":"fr"}')
  })

  it('treats an empty entry as no entry', () => {
    // Arrange + Act
    renderAt('/?entry=')
    // Assert
    expect(screen.getByLabelText('State')).toHaveTextContent('"entry":null')
  })

  it('selects and clears an entry without touching other params', async () => {
    // Arrange
    const user = renderAt('/?language=fr&mock=slow')
    // Act + Assert
    await user.click(button('select'))
    expect(location()).toHaveTextContent('/?language=fr&mock=slow&entry=e1')
    await user.click(button('new'))
    expect(location()).toHaveTextContent(/^\/\?language=fr&mock=slow$/)
  })

  it('links to an entry with the filter kept and insights closed', () => {
    // Arrange + Act
    renderAt('/?language=fr&insights=1')
    // Assert
    expect(screen.getByLabelText('Href')).toHaveTextContent('/?language=fr&entry=e2')
  })

  it('closes insights it opened by going Back, so history holds no duplicate', async () => {
    // Arrange
    const user = renderAt('/?language=fr')
    await user.click(button('open'))
    expect(location()).toHaveTextContent('/?language=fr&insights=1')
    // Act
    await user.click(button('close'))
    // Assert
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
  })

  it('goes Back rather than replacing: one more Back leaves for the page before the workspace', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/x', '/?language=fr']} initialIndex={1}>
        <Probe />
      </MemoryRouter>,
    )
    await user.click(button('open'))
    // Act
    await user.click(button('close'))
    // Assert
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
    await user.click(button('Go back'))
    expect(location()).toHaveTextContent(/^\/x$/)
  })

  it('closes deep-linked insights by replacing the URL, so closing never leaves the app', async () => {
    // Arrange
    const user = renderAt('/?insights=1&language=fr')
    // Act
    await user.click(button('close'))
    // Assert
    expect(location()).toHaveTextContent(/^\/\?language=fr$/)
  })

  it('sets and clears the language', async () => {
    // Arrange
    const user = renderAt('/?entry=e1')
    // Act + Assert
    await user.click(button('es'))
    expect(location()).toHaveTextContent('/?entry=e1&language=es')
    await user.click(button('all'))
    expect(location()).toHaveTextContent(/^\/\?entry=e1$/)
  })
})
