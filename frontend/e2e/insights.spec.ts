import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { composerLanguage, mainColumn } from './workspace'
import { pickOption } from './select'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

const insights = (page: Page) => page.getByRole('dialog', { name: 'Insights' })
const summary = (page: Page) => insights(page).getByRole('region', { name: 'Summary' })

async function openInsights(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Insights', exact: true }).click()
  await expect(insights(page).getByRole('heading', { level: 2, name: 'Insights' })).toBeFocused()
}

test('insights open over the workspace with the summary, the chart and the categories', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  await openInsights(page)
  // Assert
  await expect(page).toHaveURL('/?insights=1')
  await expect(summary(page)).toContainText('6 errors across 11 entries — 7.6 per 100 words.')
  await expect(insights(page).getByRole('img', { name: /across 11 entries.*Overall: steady/ })).toBeVisible()
  await expect(insights(page).getByRole('row', { name: /Verb conjugation/ })).toContainText('Getting worse')
  await expect(insights(page).getByRole('row', { name: /Article/ })).toContainText('Improving')
  await expectHealthy(page)
  await expectNoHorizontalScroll(page)
})

test('the filter narrows insights, and below three entries offers a way to write', async ({ page }) => {
  // Arrange
  await page.goto('/?insights=1')
  await expect(summary(page)).toBeVisible()
  // Act
  await pickOption(insights(page).getByLabel('Filter by language'), 'Spanish')
  // Assert
  await expect(page).toHaveURL(/language=es/)
  await expect(summary(page)).toContainText('Verb conjugation keeps recurring: 3 of your last 5 entries.')
  await expect(insights(page).getByRole('row', { name: /Verb conjugation/ })).toContainText('Recurring · 3 of last 5')
  await expectHealthy(page)
  await pickOption(insights(page).getByLabel('Filter by language'), 'German')
  await expect(insights(page).getByText('Insights start after 3 entries with feedback — 3 to go.')).toBeVisible()
  await expectHealthy(page)
  await insights(page).getByRole('link', { name: 'Write an entry' }).click()
  await expect(insights(page)).toBeHidden()
  await expect(mainColumn(page).getByRole('heading', { level: 1 })).toHaveText('Write')
})

test('a new entry with feedback changes insights that were already loaded', async ({ page }) => {
  // Arrange
  await page.goto('/?language=fr')
  await openInsights(page)
  await expect(summary(page)).toContainText('0 errors across 3 entries')
  await page.keyboard.press('Escape')
  await expect(insights(page)).toBeHidden()
  await pickOption(composerLanguage(page), 'French')
  await page.getByLabel('Your entry').fill('Je vais à le cinéma ce soir.')
  // Act
  await mainColumn(page).getByRole('button', { name: 'Get feedback' }).click()
  await expect(mainColumn(page).getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await openInsights(page)
  // Assert
  await expect(summary(page)).toContainText('Article is getting worse (0.0 → 6.7 per 100 words).')
  await expectHealthy(page)
})

test('Back closes insights and Forward reopens them', async ({ page }) => {
  // Arrange
  await page.goto('/')
  await openInsights(page)
  // Act
  await page.goBack()
  // Assert
  await expect(insights(page)).toBeHidden()
  await expect(page).toHaveURL('/')
  await page.goForward()
  await expect(insights(page)).toBeVisible()
})

test('insights show loading, a single retry on failure and an empty state', async ({ page }) => {
  // Arrange
  await page.goto('/?insights=1&mock=slow')
  // Act
  const loading = insights(page).getByRole('status').filter({ hasText: 'Loading' })
  // Assert
  await expect(loading.first()).toBeVisible()
  await page.goto('/?insights=1&mock=error')
  await expect(insights(page).getByRole('alert')).toHaveCount(1)
  await expect(insights(page).getByRole('button', { name: 'Try again' })).toHaveCount(1)
  await expect(insights(page).getByRole('status')).toHaveCount(0)
  await expectHealthy(page)
  await page.goto('/?insights=1&mock=empty')
  await expect(insights(page).getByText('Not enough entries yet')).toBeVisible()
  await expectHealthy(page)
})

// The mock analyser cannot produce a long unbroken snippet, so the response is rewritten in the page, after MSW has answered.
async function withLongExample(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const original = window.fetch.bind(window)
    window.fetch = async (...args) => {
      const response = await original(...args)
      const target = args[0] instanceof Request ? args[0].url : String(args[0])
      if (!target.includes('/insights')) return response
      const body = await response.json()
      const long = 'x'.repeat(120)
      for (const category of body.categories) category.latest_example = { original: long, correction: long }
      return new Response(JSON.stringify(body), { status: response.status, headers: { 'content-type': 'application/json' } })
    }
  })
}

test('a long unbroken example wraps instead of scrolling the page sideways on a phone', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 375, height: 800 })
  await withLongExample(page)
  // Act
  await page.goto('/?insights=1')
  // Assert
  await expect(insights(page).getByRole('row', { name: /Verb conjugation/ })).toContainText('x'.repeat(120))
  await expectNoHorizontalScroll(page)
})
