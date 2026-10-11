import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { pickOption } from './select'
import { composerLanguage, mainColumn } from './workspace'

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
