import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { pickOption } from './select'
import { composerLanguage, mainColumn } from './workspace'

const TEXT = 'Hoy fui al mercado con mi madre'
const FULL = `${TEXT} y fue un buen día.`

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function write(page: Page, path = '/') {
  await page.goto(path)
  await pickOption(composerLanguage(page), 'Spanish')
  const editor = page.getByLabel('Your entry')
  await editor.pressSequentially(TEXT)
  return editor
}

const ghost = (page: Page) => mainColumn(page).locator('[data-ghost]')

test('ghost text after a pause; Tab accepts and undo restores; Esc dismisses; Tab without a ghost moves on', async ({ page }) => {
  // Arrange
  const editor = await write(page)
  // Act / Assert
  await expect(ghost(page)).toHaveText(' y fue un buen día.')
  await expectHealthy(page)
  await editor.press('Tab')
  await expect(editor).toHaveValue(FULL)
  await expect(editor).toBeFocused()
  await editor.press('ControlOrMeta+z')
  await expect(editor).toHaveValue(TEXT)
  // An answer is shown once: the undone text needs new words before it is asked again.
  await editor.pressSequentially(' hoy')
  await expect(ghost(page)).toHaveText(' y fue un buen día.')
  await editor.press('Escape')
  await expect(ghost(page)).toHaveCount(0)
  await expect(editor).toBeFocused()
  await editor.press('Tab')
  await expect(editor).not.toBeFocused()
  await expect(editor).toHaveValue(`${TEXT} hoy`)
})

test('the Autocomplete switch is remembered across a reload', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const toggle = mainColumn(page).getByRole('switch', { name: 'Autocomplete' })
  // Act
  await toggle.click()
  await page.reload()
  // Assert
  await expect(mainColumn(page).getByRole('switch', { name: 'Autocomplete' })).toHaveAttribute('aria-checked', 'false')
  await pickOption(composerLanguage(page), 'Spanish')
  await page.getByLabel('Your entry').pressSequentially(TEXT)
  await page.waitForTimeout(1500)
  await expect(ghost(page)).toHaveCount(0)
})

test('autocomplete unavailable shows nothing', async ({ page }) => {
  // Arrange + Act
  const editor = await write(page, '/?mock=assist-unavailable')
  await page.waitForTimeout(1500)
  // Assert
  await expect(ghost(page)).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(editor).toHaveValue(TEXT)
})
