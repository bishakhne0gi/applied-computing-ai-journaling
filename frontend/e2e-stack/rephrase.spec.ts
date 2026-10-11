import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'
import { pickOption } from '../e2e/select'
import { composerLanguage, mainColumn } from '../e2e/workspace'

const VERSION = 'Hoy yo soy feliz con mi familia.'

test('the real stack rephrases the caret sentence; applying it changes the text and undo restores it', async ({ page }, testInfo) => {
  // Arrange — the tag rides on the first sentence, so the sentence under the caret stays the one the demo answer is pinned to.
  const tag = `(${testInfo.project.name} ${Date.now()})`
  const first = `Ayer fui al mercado ${tag}.`
  const text = `${first} Hoy yo es feliz con mi familia.`
  const fixed = `${first} ${VERSION}`
  const editor = page.getByLabel('Your entry')
  await page.goto('/')
  await pickOption(composerLanguage(page), 'Spanish')
  await editor.fill(text)
  const caret = first.length + 10 // inside «Hoy yo es feliz…»
  await editor.evaluate((el: HTMLTextAreaElement, at: number) => el.setSelectionRange(at, at), caret)
  await editor.press('ArrowRight') // a real key so React sees the caret move
  // Act
  await mainColumn(page).getByRole('button', { name: 'Rephrase' }).click()
  const card = page.getByRole('dialog', { name: 'Rephrase' })
  await expect(card.getByRole('button', { name: VERSION, exact: true })).toBeVisible()
  await expectNoA11yViolations(page)
  await card.getByRole('button', { name: VERSION, exact: true }).click()
  // Assert
  await expect(editor).toHaveValue(fixed)
  await editor.press('ControlOrMeta+z')
  await expect(editor).toHaveValue(text)
  await expectButtonsShowPointer(page)
})
