import { describe, expect, it } from 'vitest'
import { rectAtOffset, textOffsetOf } from './textNodes'

function paragraph() {
  const root = document.createElement('p')
  root.innerHTML = '<span>Hoy </span><button>yo es</button><span> feliz.</span>'
  document.body.append(root)
  return root
}

describe('textNodes', () => {
  it('counts UTF-16 units across the text nodes of the root', () => {
    // Arrange
    const root = paragraph()
    const lastSpan = root.lastChild?.firstChild as Node
    // Act + Assert
    expect(textOffsetOf(root, lastSpan, 2)).toBe(11)
    expect(textOffsetOf(root, root.firstChild?.firstChild as Node, 0)).toBe(0)
  })

  it('answers null for a node outside the root', () => {
    // Arrange
    const root = paragraph()
    const elsewhere = document.createTextNode('x')
    document.body.append(elsewhere)
    // Act + Assert
    expect(textOffsetOf(root, elsewhere, 0)).toBeNull()
  })

  it('maps an element boundary to the text before it', () => {
    // Arrange
    const root = paragraph()
    // Act + Assert
    expect(textOffsetOf(root, root, 0)).toBe(0)
  })

  it('finds a box for an offset inside the text and none past the end', () => {
    // Arrange
    const root = paragraph()
    // Act + Assert
    expect(rectAtOffset(root, 6)).not.toBeNull()
    expect(rectAtOffset(root, 100)).toBeNull()
    expect(rectAtOffset(root, 0)).toBeNull()
  })
})
