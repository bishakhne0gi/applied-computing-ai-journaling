import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'
import { pickOption } from '../e2e/select'

const DEMO_SUMMARY = 'Demo feedback — configure Claude for real corrections.'

test('the real stack saves an entry, returns demo feedback and lists it in history', async ({ page }, testInfo) => {
  // Arrange — a unique entry per run and project, because the stack's database outlives one test.
  const text = `Ayer yo es feliz en el [park]. (${testInfo.project.name} ${Date.now()})`
  await page.goto('/')
  await expect(page).toHaveTitle('Write · Language Journal')
  await pickOption(page.getByLabel('Language'), 'Spanish')
  await page.getByLabel('Your entry').fill(text)
  // Act
  await page.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(page.getByText(DEMO_SUMMARY)).toBeVisible()
  await page.getByRole('button', { name: /yo es/ }).click()
  await expect(page.getByRole('region', { name: /should be yo soy/ })).toContainText('Verb conjugation')
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click()
  const row = page.getByRole('listitem').filter({ hasText: text })
  await expect(row).toContainText('1 error')
  await row.getByRole('link').click()
  await expect(page.getByText(DEMO_SUMMARY)).toBeVisible()
  await expectNoA11yViolations(page)
})

test('the real stack keeps a revision and the analysis it replaced', async ({ page }, testInfo) => {
  // Arrange — unique per run and project, like the first journey.
  const tag = `(${testInfo.project.name} ${Date.now()})`
  const original = `Ayer yo es feliz. ${tag}`
  const revised = `Hoy la problema es grande. ${tag}`
  await page.goto('/')
  await pickOption(page.getByLabel('Language'), 'Spanish')
  await page.getByLabel('Your entry').fill(original)
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await expect(page.getByRole('button', { name: /yo es/ })).toBeVisible()
  // Act
  await page.getByRole('button', { name: 'Revise & re-check' }).click()
  await page.getByLabel('Revise your entry').fill(revised)
  await page.getByRole('button', { name: 'Re-check' }).click()
  await expect(page.getByRole('button', { name: /la problema/ })).toBeVisible()
  await page.reload()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'History' }).click()
  await page.getByRole('listitem').filter({ hasText: tag }).getByRole('link').click()
  // Assert
  await expect(page.getByRole('button', { name: /la problema/ })).toBeVisible()
  await page.getByLabel('Analysis').click()
  const options = page.getByRole('listbox').getByRole('option')
  await expect(options).toHaveCount(2)
  await expect(options.first()).toContainText('(latest)')
  await expect(options.last()).not.toContainText('(latest)')
  await expectNoA11yViolations(page)
  await options.nth(1).click()
  await expect(page.getByRole('button', { name: /yo es/ })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Feedback' })).toContainText(original)
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})
