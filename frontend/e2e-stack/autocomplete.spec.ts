import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from '../e2e/a11y'
import { expectButtonsShowPointer } from '../e2e/cursor'
import { pickOption } from '../e2e/select'
import { composerLanguage, mainColumn } from '../e2e/workspace'

const TEXT = 'Hoy fui al mercado con mi madre'
const COMPLETION = ' y fue un buen día.'

test('the real stack suggests a completion at a pause; accepting it inserts it', async ({ page, isMobile }) => {
  // Arrange
  const editor = page.getByLabel('Your entry')
  await page.goto('/')
  await pickOption(composerLanguage(page), 'Spanish')
  await editor.pressSequentially(TEXT)
  // Act
  await expect(mainColumn(page).locator('[data-ghost]')).toHaveText(COMPLETION)
  await expectNoA11yViolations(page)
  if (isMobile) await mainColumn(page).getByRole('button', { name: 'Accept suggestion' }).tap()
  else await editor.press('Tab')
  // Assert
  await expect(editor).toHaveValue(`${TEXT}${COMPLETION}`)
  await expect(editor).toBeFocused()
  await expectButtonsShowPointer(page)
})
