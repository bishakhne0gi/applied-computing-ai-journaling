import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

test('the app shell loads with the brand, the Write page and no a11y violations', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  const heading = page.getByRole('heading', { level: 1 })
  // Assert
  await expect(page.getByRole('link', { name: 'Language Journal' })).toBeVisible()
  await expect(heading).toHaveText('Write')
  await expect(page).toHaveTitle('Write · Language Journal')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})

test('the main navigation reaches History', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click()
  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('History')
  await expectNoA11yViolations(page)
})

test('unknown paths show a not-found page with a way back', async ({ page }) => {
  // Arrange
  await page.goto('/nowhere')
  // Act
  await page.getByRole('link', { name: 'Back to writing' }).click()
  // Assert
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write')
})
