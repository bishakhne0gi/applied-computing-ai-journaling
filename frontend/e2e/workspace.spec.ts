import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { mainColumn, openEntries, ENTRY_TITLE } from './workspace'

async function expectFitsWidth(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

const heading = (page: Page, name: string | RegExp) => mainColumn(page).getByRole('heading', { level: 1, name })

test('Back and Forward walk between the composer and entries without leaving the workspace', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const entries = await openEntries(page)
  await entries.getByRole('link', { name: /Je suis allé au marché/ }).click()
  await expect(heading(page, ENTRY_TITLE)).toBeVisible()
  // Act
  await page.goBack()
  // Assert
  await expect(heading(page, 'Write')).toBeVisible()
  await expect(page).toHaveURL('/')
  await page.goForward()
  await expect(heading(page, ENTRY_TITLE)).toBeVisible()
})

test('every surface fits a 375px screen', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expectFitsWidth(page)
  // Act + Assert
  const entries = await openEntries(page)
  await expect(entries.getByRole('list', { name: 'Entries' })).toBeVisible()
  await expectFitsWidth(page)
  await entries.getByRole('link', { name: /Hoy 😀 la problema/ }).click()
  await expect(heading(page, ENTRY_TITLE)).toBeVisible()
  await expectFitsWidth(page)
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Insights' }).getByRole('region', { name: 'Summary' })).toBeVisible()
  await expectFitsWidth(page)
  await expectNoA11yViolations(page)
})

test('sheets appear without sliding when the user prefers reduced motion', async ({ page }) => {
  // Arrange
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  // Act
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Insights' })
  await expect(dialog).toBeVisible()
  // Assert
  expect(await dialog.evaluate((element) => getComputedStyle(element).transform)).toBe('none')
})

test('the insights sheet works from the keyboard alone', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const opener = page.getByRole('button', { name: 'Insights', exact: true })
  await opener.focus()
  // Act
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Insights' })
  // Assert
  await expect(dialog.getByRole('heading', { level: 2, name: 'Insights' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await expectButtonsShowPointer(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})
