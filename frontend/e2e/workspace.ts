import type { Locator, Page } from '@playwright/test'

/** The entries sidebar (the left column). Task 8 turns it into a sheet on phones; specs already go through here. */
export async function openEntries(page: Page): Promise<Locator> {
  return page.getByRole('complementary', { name: 'Your entries' })
}

export const mainColumn = (page: Page): Locator => page.getByRole('main')

/** "Filter by language" also contains "Language", so the composer's select needs an exact match. */
export const composerLanguage = (page: Page): Locator => page.getByLabel('Language', { exact: true })
