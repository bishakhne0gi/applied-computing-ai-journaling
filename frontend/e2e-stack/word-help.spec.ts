import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'
import { pickOption } from '../e2e/select'
import { composerLanguage, mainColumn } from '../e2e/workspace'

const DEMO_SUMMARY = 'Demo feedback. Configure Claude for real corrections.'

test('the real stack offers word help for an unbracketed English word; accepted, it is gone from the saved feedback', async ({ page }, testInfo) => {
  // Arrange — unique per run and project, because the stack's database outlives one test.
  const tag = `(${testInfo.project.name} ${Date.now()})`
  const main = mainColumn(page)
  const editor = page.getByLabel('Your entry')
  await page.goto('/')
  await pickOption(composerLanguage(page), 'Spanish')
  await editor.fill(`Ayer fui al market con mi madre. ${tag}`)
  // Act
  await main.getByRole('button', { name: '1 hint' }).click()
  await expect(main.getByText('Word help')).toBeVisible()
  await main.getByRole('button', { name: 'Accept mercado for market' }).click()
  await expect(editor).toHaveValue(`Ayer fui al mercado con mi madre. ${tag}`)
  await expectNoA11yViolations(page)
  await main.getByRole('button', { name: 'Get feedback' }).click()
  // Assert
  await expect(main.getByText(DEMO_SUMMARY)).toBeVisible()
  await expect(main.getByRole('button', { name: /market/ })).toHaveCount(0)
  await expectButtonsShowPointer(page)
})
