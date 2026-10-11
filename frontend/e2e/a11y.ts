import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** Fails on serious/critical WCAG 2.1 AA violations. Call after each meaningful UI state. */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  // Measure the settled UI: mid-transition colours (a button turning enabled, a list fading out) are not what users
  // read. Endless loops (skeleton pulse) never settle, so only finite animations are waited for.
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity),
  )
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
}
