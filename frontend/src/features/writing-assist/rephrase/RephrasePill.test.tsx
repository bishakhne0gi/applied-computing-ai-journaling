import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RephrasePill } from './RephrasePill'

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

// jsdom has no layout: the frame, the textarea, the pill and the character box are all stated here.
const FRAME = box(100, 50, 400, 300)
const TEXTAREA = box(100, 50, 400, 200)

function placeAt(end: DOMRect) {
  vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue([end] as unknown as DOMRectList)
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(32)
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.tagName === 'TEXTAREA' ? TEXTAREA : FRAME
  })
  render(
    <div>
      <div data-backdrop="">Hola mundo feliz</div>
      <textarea />
      <RephrasePill offset={5} onOpen={() => undefined} />
    </div>,
  )
  // By tag: a hidden button has no accessible name to query by.
  return document.querySelector('button') as HTMLButtonElement
}

beforeEach(() => vi.stubGlobal('requestAnimationFrame', (callback: () => void) => callback()))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('RephrasePill geometry', () => {
  it('sits above the end of the selection, centred on it', () => {
    // Arrange + Act
    const pill = placeAt(box(250, 100, 50, 20))
    // Assert
    expect(pill.style.left).toBe('160px') // 300 - 100 - 80 / 2
    expect(pill.style.top).toBe('12px') // 100 - 50 - 32 - 6
    expect(pill).toHaveStyle({ visibility: 'visible' })
  })

  it('drops below the line when there is no room above', () => {
    // Arrange + Act
    const pill = placeAt(box(250, 55, 50, 20))
    // Assert
    expect(pill.style.top).toBe('31px') // 75 - 50 + 6
  })

  it.each([
    ['left', box(100, 100, 10, 20), '0px'],
    ['right', box(450, 100, 50, 20), '320px'],
  ])('stays inside the frame at the %s edge', (_edge, end, left) => {
    // Arrange + Act
    const pill = placeAt(end)
    // Assert
    expect(pill.style.left).toBe(left)
  })

  it('hides when the end of the selection has scrolled out of the textarea', () => {
    // Arrange + Act
    const pill = placeAt(box(250, 400, 50, 20))
    // Assert
    expect(pill).toHaveStyle({ visibility: 'hidden' })
  })
})
