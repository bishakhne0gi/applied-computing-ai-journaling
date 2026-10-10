import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

const summary = (page: Page) => page.getByRole('region', { name: 'Summary' })
const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name })

test('insights summarise every language, chart the rate and break errors down by category', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  await nav(page, 'Insights').click()
  // Assert
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights')
  await expect(summary(page)).toContainText('6 errors across 11 entries — 7.6 per 100 words.')
  await expect(page.getByRole('img', { name: /across 11 entries.*Overall: steady/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Verb conjugation/ })).toContainText('Getting worse')
  await expect(page.getByRole('row', { name: /Article/ })).toContainText('Improving')
  await expectHealthy(page)
  await expectNoHorizontalScroll(page)
})

test('the language filter narrows insights and below three entries offers a way to write', async ({ page }) => {
  // Arrange
  await page.goto('/insights')
  await expect(summary(page)).toBeVisible()
  // Act
  await page.getByLabel('Language').selectOption('es')
  // Assert
  await expect(page).toHaveURL(/language=es/)
  await expect(summary(page)).toContainText('Verb conjugation keeps recurring: 3 of your last 5 entries.')
  await expect(page.getByRole('row', { name: /Verb conjugation/ })).toContainText('Recurring · 3 of last 5')
  await expectHealthy(page)
  await expectNoHorizontalScroll(page)
  await page.getByLabel('Language').selectOption('de')
  await expect(page.getByText('Insights start after 3 entries with feedback — 3 to go.')).toBeVisible()
  await expectHealthy(page)
  await page.getByRole('link', { name: 'Write an entry' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write')
})

test('a new entry with feedback changes insights that were already loaded', async ({ page }) => {
  // Arrange
  await page.goto('/insights?language=fr')
  await expect(summary(page)).toContainText('0 errors across 3 entries')
  await nav(page, 'Write').click()
  // Wait for the new page: the Insights filter is also labelled "Language" until it unmounts.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Write')
  await page.getByLabel('Language').selectOption('fr')
  await page.getByLabel('Your entry').fill('Je vais à le cinéma ce soir.')
  // Act
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await nav(page, 'Insights').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Insights')
  await page.getByLabel('Language').selectOption('fr')
  // Assert
  await expect(summary(page)).toContainText('Article is getting worse (0.0 → 6.7 per 100 words).')
  await expectHealthy(page)
})

test('insights show loading, a single retry on failure and an empty state', async ({ page }) => {
  // Arrange
  await page.goto('/insights?mock=slow')
  // Act
  const loading = page.getByRole('status').filter({ hasText: 'Loading insights…' })
  // Assert
  await expect(loading).toBeVisible()
  await page.goto('/insights?mock=error')
  await expect(page.getByRole('alert')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(1)
  await expect(page.getByRole('status')).toHaveCount(0)
  await expectHealthy(page)
  await page.goto('/insights?mock=empty')
  await expect(page.getByText('Not enough entries yet')).toBeVisible()
  await expectHealthy(page)
})
