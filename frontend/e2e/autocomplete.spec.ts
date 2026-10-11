import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { pickOption } from './select'
import { composerLanguage, mainColumn } from './workspace'

const TEXT = 'Hoy fui al mercado con mi madre'
const OFF_OBSERVATION_MS = 1500
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
  const asked = page.waitForRequest('**/complete', { timeout: OFF_OBSERVATION_MS }).then(() => true, () => false)
  await page.getByLabel('Your entry').pressSequentially(TEXT)
  // Nothing is requested while the switch is off, so there is no response to wait for: observe the request channel instead.
  expect(await asked).toBe(false)
  await expect(ghost(page)).toHaveCount(0)
})

test('autocomplete unavailable shows nothing', async ({ page }) => {
  // Arrange + Act
  const answered = page.waitForResponse('**/complete')
  const editor = await write(page, '/?mock=assist-unavailable')
  await answered
  // Assert
  await expect(ghost(page)).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(editor).toHaveValue(TEXT)
})

test('on touch the Accept suggestion button inserts the ghost and the text keeps focus', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a coarse pointer has no Tab key')
  // Arrange
  const editor = await write(page)
  const accept = mainColumn(page).getByRole('button', { name: 'Accept suggestion' })
  // Act
  await expect(ghost(page)).toHaveText(' y fue un buen día.')
  await expect(accept).toBeVisible()
  expect((await accept.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  await expectHealthy(page)
  await accept.tap()
  // Assert
  await expect(editor).toHaveValue(FULL)
  await expect(editor).toBeFocused()
  await expect(accept).toHaveCount(0)
  await editor.press('ControlOrMeta+z')
  await expect(editor).toHaveValue(TEXT)
})
