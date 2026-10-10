import { expect, test, type Page } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'

const ENTRY = 'Ayer yo es feliz en el [park].'

async function expectHealthy(page: Page): Promise<void> {
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
}

async function writeEntry(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await page.getByLabel('Language').selectOption('es')
  await page.getByLabel('Your entry').fill(ENTRY)
}

test('writing an entry shows inline feedback, a detail panel and the corrected version', async ({ page }) => {
  // Arrange
  await writeEntry(page)
  await expectHealthy(page)
  // Act
  await page.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Saved')
  await expectHealthy(page)
  const highlight = page.getByRole('button', { name: /yo es/ })
  await highlight.click()
  const panel = page.getByRole('region', { name: /should be yo soy/ })
  await expect(panel).toContainText('Verb conjugation')
  await expectHealthy(page)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(highlight).toBeFocused()
  const toggle = page.getByRole('button', { name: 'Show corrected version' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Ayer yo soy feliz en el parque.')).toBeVisible()
  await expectHealthy(page)
})

test('a failed analysis keeps the entry and can be retried', async ({ page }) => {
  // Arrange
  await writeEntry(page, '/?mock=analysis-fail')
  // Act
  await page.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('took too long')
  await expect(page.getByLabel('Your entry')).toHaveValue(ENTRY)
  await expectHealthy(page)
  await alert.getByRole('button', { name: 'Retry analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible()
  await expectHealthy(page)
})

test('revising an entry re-checks it and shows the new feedback', async ({ page }) => {
  // Arrange
  await writeEntry(page)
  await page.getByRole('button', { name: 'Get feedback' }).click()
  await page.getByRole('button', { name: 'Revise & re-check' }).click()
  const editor = page.getByLabel('Revise your entry')
  await expect(editor).toHaveValue(ENTRY)
  // Act
  await editor.fill('Ayer yo soy feliz en el parque.')
  await expectHealthy(page)
  await page.getByRole('button', { name: 'Re-check' }).click()
  // Assert
  await expect(page.getByText('Great job — no mistakes found!')).toBeVisible()
  await expectHealthy(page)
})

test('a draft survives a reload', async ({ page }) => {
  // Arrange
  await writeEntry(page)
  // Act
  await page.reload()
  // Assert
  await expect(page.getByLabel('Your entry')).toHaveValue(ENTRY)
  await expect(page.getByRole('status')).toHaveText('Draft kept on this device')
})
