import { expect, test } from '@playwright/test'
import { expectNoA11yViolations } from './a11y'
import { expectButtonsShowPointer } from './cursor'
import { mainColumn, openEntries, ENTRY_TITLE } from './workspace'

test('the workspace loads with the brand, the composer and the entries, with no a11y violations', async ({ page }) => {
  // Arrange
  await page.goto('/')
  // Act
  const entries = await openEntries(page)
  // Assert
  await expect(page.getByRole('link', { name: 'Language Journal' })).toBeVisible()
  await expect(mainColumn(page).getByRole('heading', { level: 1 })).toHaveText('Write')
  await expect(page).toHaveTitle('Write · Language Journal')
  await expect(entries.getByRole('list', { name: 'Entries' }).getByRole('listitem')).toHaveCount(10)
  await expectNoA11yViolations(page)
  await expectButtonsShowPointer(page)
})

test('a link from before the workspace opens that entry in it', async ({ page }) => {
  // Arrange
  const id = '00000000-0000-4000-8000-000000000002'
  // Act
  await page.goto(`/entries/${id}?language=es`)
  // Assert
  await expect(page).toHaveURL(`/?language=es&entry=${id}`)
  await expect(mainColumn(page).getByRole('heading', { level: 1, name: ENTRY_TITLE })).toBeVisible()
})

test('unknown paths show a not-found page with a way back', async ({ page }) => {
  // Arrange
  await page.goto('/nowhere')
  // Act
  await page.getByRole('link', { name: 'Back to writing' }).click()
  // Assert
  await expect(page).toHaveURL('/')
  await expect(mainColumn(page).getByRole('heading', { level: 1 })).toHaveText('Write')
})

test('the header stays on one line on a phone', async ({ page }) => {
  // Arrange
  await page.setViewportSize({ width: 375, height: 812 })
  // Act
  await page.goto('/')
  // Assert
  const header = page.getByRole('banner')
  await expect(page.getByRole('link', { name: 'Language Journal' })).toBeVisible()
  // Measure the settled row: the phone layout adds the Entries button after mount, and the web font changes text widths.
  await expect(page.getByRole('button', { name: 'Entries', exact: true })).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  // The header has a fixed height, so a wrapped row would show as overflow and as items on different lines.
  const row = await header.evaluate((element) => {
    const inner = element.firstElementChild as HTMLElement
    const centres = [...inner.children].map((child) => {
      const box = child.getBoundingClientRect()
      return box.top + box.height / 2
    })
    return { overflow: inner.scrollHeight - inner.clientHeight, spread: Math.max(...centres) - Math.min(...centres) }
  })
  expect(row.overflow).toBeLessThanOrEqual(0)
  expect(row.spread).toBeLessThanOrEqual(2)
})
