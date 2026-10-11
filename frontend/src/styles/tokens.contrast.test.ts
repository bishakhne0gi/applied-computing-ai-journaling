import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/styles/tokens.css'), 'utf8')

// Short hex (#fff, which stylelint enforces) is expanded to six digits.
function expand(hex: string): string {
  return hex.length === 4 ? `#${Array.from(hex.slice(1), (c) => c + c).join('')}` : hex
}

// Only hex colours are contrast-checked; rgb() values (scrim) are overlays, not text or borders.
function colours(marker: string): Record<string, string> {
  const start = css.indexOf(marker)
  const body = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries(Array.from(body.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{3,6})\b/giu), ([, name = '', hex = '']) => [name, expand(hex)]))
}

function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

function ratio(a = '', b = ''): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05)
}

const light = colours('@theme')
const dark = { ...light, ...colours('@media (prefers-color-scheme: dark)') }

const TEXT: [string, string][] = [
  ['fg', 'bg'], ['fg', 'surface'], ['fg-secondary', 'bg'], ['fg-secondary', 'surface'], ['muted', 'bg'], ['muted', 'surface'],
  ['primary', 'bg'], ['primary', 'surface'], ['primary-contrast', 'primary'], ['primary-contrast', 'primary-pressed'],
  ['danger', 'bg'], ['danger', 'surface'], ['success', 'bg'], ['success', 'surface'], ['warning', 'bg'], ['warning', 'surface'],
  ['fg', 'primary-soft'], ['fg-secondary', 'primary-soft'], ['primary', 'primary-soft'], ['fg', 'band'], ['bg', 'fg'],
  ['fg', 'mark-error-bg'], ['fg', 'mark-suggestion-bg'], ['fg', 'mark-vocab-bg'],
  ['mark-error', 'mark-error-bg'], ['mark-suggestion', 'mark-suggestion-bg'], ['mark-vocab', 'mark-vocab-bg'],
]
const NON_TEXT: [string, string][] = [['border-input', 'bg'], ['border-input', 'surface']]

describe.each([
  ['light', light],
  ['dark', dark],
])('%s tokens', (_mode, palette) => {
  it.each(TEXT)('%s on %s reaches 4.5:1 for text', (foreground, background) => {
    // Arrange
    const pair = [palette[foreground], palette[background]]
    // Act
    const value = ratio(...pair)
    // Assert
    expect(pair.every(Boolean)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(4.5)
  })

  it.each(NON_TEXT)('%s on %s reaches 3:1 for control boundaries', (foreground, background) => {
    // Arrange
    const pair = [palette[foreground], palette[background]]
    // Act
    const value = ratio(...pair)
    // Assert
    expect(pair.every(Boolean)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(3)
  })
})
