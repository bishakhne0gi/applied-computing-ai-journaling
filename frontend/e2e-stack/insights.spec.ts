import { expect, test, type APIRequestContext } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'
import { pickOption } from '../e2e/select'

const LANGUAGE_NAMES = { it: 'Italian', pt: 'Portuguese' } as const

// Every entry has «yo es» and the last two «la problema», which the demo FakeProvider marks as errors.
const ENTRIES = [
  'Hoy yo es feliz y tranquilo.',
  'Mañana yo es estudiante otra vez.',
  'Ayer yo es feliz con la problema.',
  'Creo que yo es listo pero la problema sigue aquí.',
]

interface InsightsBody {
  status: string
  entry_count: number
  summary: string[]
}

async function writeAnalysed(request: APIRequestContext, language: string, text: string): Promise<void> {
  const created = await request.post('/api/v1/entries', { data: { language, text } })
  expect(created.status()).toBe(201)
  const { id } = (await created.json()) as { id: string }
  const analysed = await request.post(`/api/v1/entries/${id}/analyses`)
  expect(analysed.status()).toBe(201)
}

test('the real stack turns analysed entries into insights', async ({ page, request }, testInfo) => {
  // Arrange — a language of its own per project, because both projects share the stack's database.
  const language = testInfo.project.name === 'mobile' ? 'pt' : 'it'
  for (const text of ENTRIES) await writeAnalysed(request, language, text)
  const response = await request.get('/api/v1/insights', { params: { language } })
  const expected = (await response.json()) as InsightsBody
  expect(expected.status).toBe('trends')
  // Act
  await page.goto('/?insights=1')
  const insights = page.getByRole('dialog', { name: 'Insights' })
  await pickOption(insights.getByLabel('Filter by language'), LANGUAGE_NAMES[language])
  // Assert
  await expect(insights.getByRole('heading', { name: 'Summary' })).toHaveCount(0)
  await expect(insights.getByRole('img', { name: new RegExp(`across ${expected.entry_count} entries`) })).toBeVisible()
  const verbs = insights.getByRole('row', { name: /Verb conjugation/ })
  await expect(verbs).toContainText(/Recurring · \d of last \d/)
  await expect(verbs).toContainText('yo es')
  await expect(verbs).toContainText('yo soy')
  await expect(insights.getByRole('row', { name: /Gender agreement/ })).toContainText('el problema')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})
