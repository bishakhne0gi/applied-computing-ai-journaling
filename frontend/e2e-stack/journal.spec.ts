import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'

const DEMO_SUMMARY = 'Demo feedback — configure Claude for real corrections.'

test('the real stack saves an entry, returns demo feedback and lists it in history', async ({ page }, testInfo) => {
  // Arrange — a unique entry per run and project, because the stack's database outlives one test.
  const text = `Ayer yo es feliz en el [park]. (${testInfo.project.name} ${Date.now()})`
  await page.goto('/')
  await expect(page).toHaveTitle('Write · Language Journal')
  await page.getByLabel('Language').selectOption('es')
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
