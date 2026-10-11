import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { pickOption } from './select'
import { composerLanguage, mainColumn, openEntries } from './workspace'

const TEXT = 'Ayer fui al mercado. Hoy yo es feliz con mi familia.'
const FIXED = 'Ayer fui al mercado. Hoy yo soy feliz con mi familia.'
const VERSION = 'Hoy yo soy feliz con mi familia.'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function write(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await pickOption(composerLanguage(page), 'Spanish')
  const editor = page.getByLabel('Your entry')
  await editor.fill(TEXT)
  await editor.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(30, 30))
  await editor.press('ArrowRight') // a real key so React sees the caret move
}

const card = (page: Page) => page.getByRole('dialog', { name: 'Rephrase' })

test('rephrase the caret sentence, compare, apply, undo', async ({ page }) => {
  // Arrange
  await write(page)
  // Act
  await mainColumn(page).getByRole('button', { name: 'Rephrase' }).click()
  await expect(card(page).getByRole('button', { name: VERSION, exact: true })).toBeVisible()
  await expectHealthy(page)
  await card(page).getByRole('button', { name: 'Compare' }).first().click()
  await expect(card(page).locator('ins', { hasText: 'soy' }).last()).toBeVisible()
  await card(page).getByRole('button', { name: VERSION, exact: true }).click()
  // Assert
  const editor = page.getByLabel('Your entry')
  await expect(editor).toHaveValue(FIXED)
  await editor.press('ControlOrMeta+z')
  await expect(editor).toHaveValue(TEXT)
})

test('Alt+R opens the card; Esc returns to the text', async ({ page }) => {
  // Arrange
  await write(page)
  const editor = page.getByLabel('Your entry')
  // Act
  await editor.press('Alt+KeyR')
  await expect(card(page)).toBeVisible()
  await page.keyboard.press('Escape')
  // Assert
  await expect(card(page)).toBeHidden()
  await expect(editor).toBeFocused()
})

test('better words replace one word', async ({ page }) => {
  // Arrange
  await write(page)
  await mainColumn(page).getByRole('button', { name: 'Rephrase' }).click()
  await card(page).getByRole('tab', { name: 'Better words' }).click()
  // Act
  await card(page).getByRole('button', { name: /contento for feliz/ }).click()
  // Assert
  await expect(page.getByLabel('Your entry')).toHaveValue('Ayer fui al mercado. Hoy yo es contento con mi familia.')
})

test('rephrasing unavailable shows a retry and leaves writing alone', async ({ page }) => {
  // Arrange
  await write(page, '/?mock=assist-unavailable')
  // Act
  await mainColumn(page).getByRole('button', { name: 'Rephrase' }).click()
  // Assert
  await expect(card(page).getByRole('button', { name: 'Try again' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Your entry')).toHaveValue(TEXT)
  await expect(page.getByRole('button', { name: 'Get feedback', exact: true })).toBeEnabled()
})

test('a mouse-width selection shows a Rephrase pill that opens the card on it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch has its own selection menu')
  // Arrange
  await write(page)
  const editor = page.getByLabel('Your entry')
  // Act
  // The live-hint check lands asynchronously and re-renders the editor; select once it has settled.
  await expect(mainColumn(page).getByRole('button', { name: /^\d+ hints?$/ })).toBeVisible()
  await editor.evaluate((el: HTMLTextAreaElement, from) => el.setSelectionRange(from, from), TEXT.indexOf('con mi'))
  await editor.press('Shift+End') // a real key, so the selection is made the way a learner makes it
  const pill = mainColumn(page).getByRole('button', { name: 'Rephrase selection' })
  await expect(pill).toBeVisible()
  await expect(editor).toBeFocused()
  await expectHealthy(page)
  await pill.click()
  // Assert
  await expect(card(page).locator('blockquote')).toHaveText('con mi familia.')
  await expect(card(page).getByRole('button', { name: /Sinceramente/ })).toBeVisible()
  await expectHealthy(page)
})

test('a saved entry rephrases a chosen sentence read-only and copies a version', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only')
  // Arrange
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  const entries = await openEntries(page)
  await entries.getByRole('link', { name: /El fin de semana fue muy bueno/ }).click()
  const main = mainColumn(page)
  // Act
  await main.getByRole('button', { name: 'Rephrase a sentence' }).click()
  const section = main.getByRole('region', { name: 'Rephrase' })
  await expect(section.getByRole('button', { name: /^Copy/ }).first()).toBeVisible()
  await expectHealthy(page)
  await section.getByRole('button', { name: /^Copy/ }).first().click()
  // Assert
  await expect(page.getByText('Copied')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).not.toBe('')
  await section.getByRole('button', { name: 'Close' }).click()
  await expect(main.getByRole('button', { name: 'Rephrase a sentence' })).toBeFocused()
})
