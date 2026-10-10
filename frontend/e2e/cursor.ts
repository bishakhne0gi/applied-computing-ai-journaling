import { expect, type Page } from '@playwright/test'

/** Every enabled button must show a pointer cursor, every disabled one not-allowed. Call after each meaningful UI state. */
export async function expectButtonsShowPointer(page: Page): Promise<void> {
  const cursors = await page.$$eval('button', (buttons) =>
    buttons.map((button) => ({
      name: button.textContent?.trim() || button.getAttribute('aria-label') || '(unnamed)',
      disabled: button.disabled || button.getAttribute('aria-disabled') === 'true',
      cursor: getComputedStyle(button).cursor,
    })),
  )
  const wrong = cursors
    .filter(({ disabled, cursor }) => cursor !== (disabled ? 'not-allowed' : 'pointer'))
    .map(({ name, cursor }) => `${name}: ${cursor}`)
  expect(wrong).toEqual([])
}
