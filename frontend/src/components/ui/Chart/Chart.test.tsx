import { render, screen } from '@testing-library/react'
import { Area, AreaChart } from 'recharts'
import { describe, expect, it } from 'vitest'
import { ChartContainer, chartAnimation } from '.'

describe('ChartContainer', () => {
  it('is one labelled image and hides the drawing from screen readers', () => {
    // Arrange / Act
    render(
      <ChartContainer label="Errors per 100 words">
        <AreaChart data={[{ x: 1, y: 2 }, { x: 2, y: 1 }]}>
          <Area dataKey="y" />
        </AreaChart>
      </ChartContainer>,
    )
    // Assert
    const image = screen.getByRole('img', { name: 'Errors per 100 words' })
    expect(image.querySelector('[aria-hidden="true"] .recharts-surface')).not.toBeNull()
  })
})

describe('chartAnimation', () => {
  it.each([
    [false, { isAnimationActive: true, animationDuration: 300, animationEasing: 'ease-out' }],
    [true, { isAnimationActive: false, animationDuration: 300, animationEasing: 'ease-out' }],
  ])('reduced motion %s gives %o', (reduce, expected) => {
    expect(chartAnimation(reduce)).toEqual(expected)
  })
})
