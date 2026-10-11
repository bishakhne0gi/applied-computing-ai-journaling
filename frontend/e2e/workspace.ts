import type { Locator, Page } from '@playwright/test'

/** The entries sidebar: the left column on desktop, a sheet behind the header's "Entries" button on phones. */
export async function openEntries(page: Page): Promise<Locator> {
  const button = page.getByRole('button', { name: 'Entries', exact: true })
  const aside = page.getByRole('complementary', { name: 'Your entries' })
  // The layout is decided on mount, so wait for whichever of the two appears.
  await button.or(aside).waitFor()
  if (await button.isVisible()) {
    await button.click()
    return page.getByRole('dialog', { name: 'Entries' })
  }
  return aside
}

export const mainColumn = (page: Page): Locator => page.getByRole('main')

/** "Filter by language" also contains "Language", so the composer's select needs an exact match. */
export const composerLanguage = (page: Page): Locator => page.getByLabel('Language', { exact: true })
