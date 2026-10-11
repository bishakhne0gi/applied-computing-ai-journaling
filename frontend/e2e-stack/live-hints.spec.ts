import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'
import { pickOption } from '../e2e/select'
import { composerLanguage, mainColumn } from '../e2e/workspace'

const DEMO_SUMMARY = 'Demo feedback. Configure Claude for real corrections.'

test('the real stack hints while typing; an accepted hint is gone from the saved feedback', async ({ page }, testInfo) => {
  // Arrange — unique per run and project, because the stack's database outlives one test.
  const tag = `(${testInfo.project.name} ${Date.now()})`
  const main = mainColumn(page)
  await page.goto('/')
  await pickOption(composerLanguage(page), 'Spanish')
  await page.getByLabel('Your entry').fill(`Hoy yo es feliz. ${tag}`)
  // Act
  await main.getByRole('button', { name: '1 hint' }).click()
  await main.getByRole('button', { name: 'Accept yo soy for yo es' }).click()
  await expect(page.getByLabel('Your entry')).toHaveValue(`Hoy yo soy feliz. ${tag}`)
  await expectNoA11yViolations(page)
  await main.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(main.getByText(DEMO_SUMMARY)).toBeVisible()
  await expect(main.getByRole('button', { name: /yo es/ })).toHaveCount(0)
  await expectButtonsShowPointer(page)
})
