import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

test('app shell loads with a heading, no a11y violations and pointer cursors', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  const heading = page.getByRole('heading', { level: 1 })
  // Assert
  await expect(heading).toBeVisible()
  await expect(heading).toHaveText('Language Journal')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})
