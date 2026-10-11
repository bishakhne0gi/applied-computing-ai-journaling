import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { pickOption } from './select'
import { composerLanguage, mainColumn } from './workspace'

const TEXT = 'Hoy yo es feliz y tranquilo.'
const FIXED = 'Hoy yo soy feliz y tranquilo.'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function write(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await pickOption(composerLanguage(page), 'Spanish')
  await page.getByLabel('Your entry').fill(TEXT)
}

const hintsButton = (page: Page) => mainColumn(page).getByRole('button', { name: '1 hint' })
// The underline lives in the aria-hidden backdrop, so it is reached by element, not role.
const underline = (page: Page) => mainColumn(page).locator('mark[data-decoration-id]', { hasText: 'yo es' })

test('a hint appears after a pause, is accepted from the list, undone, accepted again, and the entry submits clean', async ({ page }) => {
  // Arrange
  await write(page)
  await expect(underline(page)).toBeVisible()
  await expectHealthy(page)
  // Act
  await hintsButton(page).click()
  await mainColumn(page).getByRole('button', { name: 'Accept yo soy for yo es' }).click()
  const editor = page.getByLabel('Your entry')
  await expect(editor).toHaveValue(FIXED)
  await editor.press('ControlOrMeta+z')
  await expect(editor).toHaveValue(TEXT)
  await expect(underline(page)).toBeVisible()
  await hintsButton(page).click()
  await mainColumn(page).getByRole('button', { name: 'Accept yo soy for yo es' }).click()
  await expect(editor).toHaveValue(FIXED)
  await mainColumn(page).getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(mainColumn(page).getByText('Great job, no mistakes found!')).toBeVisible()
  await expectHealthy(page)
})

test('clicking an underline opens the hint without taking the keyboard; the Accept button applies it', async ({ page }) => {
  // Arrange
  await write(page)
  const box = await underline(page).boundingBox()
  expect(box).not.toBeNull()
  // Act
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  const popover = page.getByRole('group', { name: 'Hint: yo es should be yo soy' })
  await expect(popover).toBeVisible()
  await expect(page.getByLabel('Your entry')).toBeFocused()
  await expectHealthy(page)
  await popover.getByRole('button', { name: 'Accept' }).click()
  // Assert
  await expect(page.getByLabel('Your entry')).toHaveValue(FIXED)
  await expect(popover).toBeHidden()
})

test('the Live hints switch turns hints off and stays off after a reload', async ({ page }) => {
  // Arrange
  await write(page)
  await expect(hintsButton(page)).toBeVisible()
  // Act
  await mainColumn(page).getByRole('switch', { name: 'Live hints' }).click()
  await page.reload()
  // Assert
  // The languages query enables the button once it lands; an a11y scan before that races the page's last re-render.
  await expect(mainColumn(page).getByRole('button', { name: 'Get feedback' })).toBeEnabled()
  await expect(mainColumn(page).getByRole('switch', { name: 'Live hints' })).toHaveAttribute('aria-checked', 'false')
  await expect(underline(page)).toHaveCount(0)
  await expectHealthy(page)
})

test('when live hints are unavailable, writing and feedback carry on without them', async ({ page }) => {
  // Arrange
  const unavailable = page.waitForResponse((response) => response.url().includes('/check') && response.status() === 503)
  await write(page, '/?mock=check-unavailable')
  // Act: the check fires after the debounce and is refused.
  await unavailable
  // Assert
  await expect(underline(page)).toHaveCount(0)
  await expect(mainColumn(page).getByRole('alert')).toHaveCount(0)
  await mainColumn(page).getByRole('button', { name: 'Get feedback' }).click()
  await expect(mainColumn(page).getByRole('heading', { name: 'Feedback' })).toBeVisible()
})

test('English without brackets gets word help like a bracket', async ({ page }) => {
  // Arrange
  await page.goto('/')
  await pickOption(composerLanguage(page), 'Spanish')
  const editor = page.getByLabel('Your entry')
  // Act
  await editor.fill('Hoy fui al market con mi madre.')
  // Assert
  await expect(mainColumn(page).locator('mark[data-decoration-id]', { hasText: 'market' })).toBeVisible()
  await mainColumn(page).getByRole('button', { name: '1 hint' }).click()
  await expect(mainColumn(page).getByText('Word help')).toBeVisible()
  await mainColumn(page).getByRole('button', { name: 'Accept mercado for market' }).click()
  await expect(editor).toHaveValue('Hoy fui al mercado con mi madre.')
  await expectHealthy(page)
})
