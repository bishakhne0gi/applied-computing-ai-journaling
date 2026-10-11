import { describe, expect, it } from 'vitest'
import { placePopover, type Box } from './placePopover'

const frame: Box = { left: 16, top: 100, right: 359, bottom: 400 }
const size = { width: 288, height: 120 }
const viewport = { width: 375, height: 812 }
const mark = (left: number, top: number): Box => ({ left, top, right: left + 60, bottom: top + 24 })

describe('placePopover', () => {
  it('sits just below the words when it fits inside the editor', () => {
    // Arrange + Act
    const at = placePopover(mark(20, 150), frame, size, viewport)
    // Assert
    expect(at).toEqual({ top: 150 + 24 + 10 - 100, left: 20 - 16 })
  })

  it('flips above when below would cover what follows the editor', () => {
    // Arrange + Act
    const at = placePopover(mark(20, 340), frame, size, viewport)
    // Assert
    expect(at.top).toBe(340 - 10 - 120 - 100)
  })

  it('flips above when below runs past the viewport', () => {
    // Arrange + Act
    const at = placePopover(mark(20, 700), { ...frame, bottom: 900 }, size, viewport)
    // Assert
    expect(at.top).toBe(700 - 10 - 120 - 100)
  })

  it('stays below when there is no room above either', () => {
    // Arrange + Act
    const at = placePopover(mark(20, 120), { ...frame, bottom: 150 }, size, viewport)
    // Assert
    expect(at.top).toBe(120 + 24 + 10 - 100)
  })

  it('keeps an 8px margin from the right edge of the viewport', () => {
    // Arrange + Act
    const at = placePopover(mark(300, 150), frame, size, viewport)
    // Assert
    expect(at.left).toBe(375 - 288 - 8 - 16)
  })

  it('keeps an 8px margin from the left edge', () => {
    // Arrange + Act
    const at = placePopover(mark(2, 150), frame, size, viewport)
    // Assert
    expect(at.left).toBe(8 - 16)
  })
})
