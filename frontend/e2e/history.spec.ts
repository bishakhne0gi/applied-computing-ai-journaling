import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { mainColumn, openEntries, ENTRY_TITLE } from './workspace'
import { pickOption } from './select'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

test('the sidebar filters and pages entries, then opens one whose past analyses can be switched', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const entries = await openEntries(page)
  const rows = entries.getByRole('list', { name: 'Entries' }).getByRole('listitem')
  await expect(rows).toHaveCount(10)
  await expectHealthy(page)
  // Act
  await entries.getByRole('button', { name: 'Load more' }).click()
  await expect(rows).toHaveCount(14)
  await pickOption(entries.getByLabel('Filter by language'), 'French')
  await expect(rows).toHaveCount(4)
  await expectHealthy(page)
  await entries.getByRole('link', { name: /Je suis allé au marché/ }).click()
  // Assert
  const main = mainColumn(page)
  await expect(main.getByRole('heading', { level: 1, name: ENTRY_TITLE })).toBeFocused()
  await expect(main.getByText('Great job, no mistakes found!')).toBeVisible()
  await expect(page).toHaveURL(/[?&]entry=00000000-0000-4000-8000-000000000001/)
  await expectHealthy(page)
  await pickOption(main.getByLabel('Analysis'), { index: 1 })
  await expect(main.getByRole('button', { name: /à le/ })).toBeVisible()
  await expectHealthy(page)
})

test('an empty journal offers a way to start writing', async ({ page }) => {
  // Arrange
  await page.goto('/?mock=empty')
  const entries = await openEntries(page)
  // Act
  await entries.getByRole('button', { name: 'Write your first entry' }).click()
  // Assert
  await expect(page.getByLabel('Your entry')).toBeFocused()
  await expectHealthy(page)
})

test('an interrupted analysis is flagged in the sidebar and can be retried in place', async ({ page }) => {
  // Arrange
  await page.goto('/')
  const entries = await openEntries(page)
  const row = entries.getByRole('listitem').filter({ hasText: 'Hier, je suis allé' })
  await expect(row.getByText('interrupted', { exact: true })).toBeVisible()
  await expect(row).toContainText('Analysis interrupted')
  await expectHealthy(page)
  // Act
  await row.getByRole('button', { name: /^Retry analysis/ }).click()
  // Assert
  await expect(row.getByText('1 error')).toBeVisible()
  await expect(row.getByRole('button', { name: /^Retry analysis/ })).toBeHidden()
  await expectHealthy(page)
})

test('an unknown entry explains itself and offers a new entry', async ({ page }) => {
  // Arrange
  await page.goto('/?entry=ffffffff-ffff-4fff-8fff-ffffffffffff')
  const main = mainColumn(page)
  await expect(main.getByRole('heading', { level: 1, name: 'Entry not found' })).toBeVisible()
  await expectHealthy(page)
  // Act
  await main.getByRole('link', { name: 'Write a new entry' }).click()
  // Assert
  await expect(page.getByLabel('Your entry')).toBeFocused()
})
