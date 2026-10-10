import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

test('history filters and pages, then opens an entry whose past analyses can be switched', async ({ page }) => {
  // Arrange
  await page.goto('/entries')
  const rows = page.getByRole('list', { name: 'Entries' }).getByRole('listitem')
  await expect(rows).toHaveCount(10)
  await expectHealthy(page)
  // Act
  await page.getByRole('button', { name: 'Load more' }).click()
  await expect(rows).toHaveCount(14)
  await page.getByLabel('Language').selectOption('fr')
  await expect(rows).toHaveCount(4)
  await expectHealthy(page)
  await page.getByRole('link', { name: /Je suis allé au marché/ }).click()
  // Assert
  await expect(page.getByRole('heading', { level: 1, name: 'Entry' })).toBeVisible()
  await expect(page.getByText('Great job — no mistakes found!')).toBeVisible()
  await expectHealthy(page)
  await page.getByLabel('Analysis').selectOption({ index: 1 })
  await expect(page.getByRole('button', { name: /à le/ })).toBeVisible()
  await expectHealthy(page)
})

test('history shows an empty state when there are no entries', async ({ page }) => {
  // Arrange
  await page.goto('/entries?mock=empty')
  // Act
  const link = page.getByRole('link', { name: 'Write your first entry' })
  // Assert
  await expect(link).toBeVisible()
  await expectHealthy(page)
})
