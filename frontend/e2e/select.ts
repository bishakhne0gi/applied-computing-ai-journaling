import { expect, type Locator } from '@playwright/test'

/** Selects in the app are custom comboboxes (Select primitive): open one, then click the option, as a learner would. */
export async function pickOption(combobox: Locator, option: string | { index: number }): Promise<void> {
  await combobox.click()
  const listbox = combobox.page().getByRole('listbox')
  const options = listbox.getByRole('option')
  const target = typeof option === 'string' ? options.filter({ hasText: new RegExp(`^${option}$`) }) : options.nth(option.index)
  await target.click()
  // Wait out the closing fade, so an axe pass right after never measures half-transparent option text.
  await expect(listbox).toHaveCount(0)
}
