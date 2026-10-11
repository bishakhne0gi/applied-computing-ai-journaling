import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { chartAnimation } from '@/components/ui/Chart'
import type { RatePointOut } from '@/types/insights'
import { RateChart } from './RateChart'

// motion caches the OS preference at module load; mocking the hook is the only way to flip it per file.
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

// Spy on the helper so the test fails if the chart stops asking it (a hardcoded chartAnimation(false) would pass the d-check).
vi.mock('@/components/ui/Chart', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/Chart')>()
  return { ...actual, chartAnimation: vi.fn(actual.chartAnimation) }
})

const points: RatePointOut[] = [
  { entry_id: 'a', created_at: '2026-10-01T09:00:00Z', word_count: 10, error_count: 2, rate: 20 },
  { entry_id: 'b', created_at: '2026-10-02T09:00:00Z', word_count: 8, error_count: 0, rate: 0 },
]

describe('RateChart with reduced motion', () => {
  it('asks for animation off, so the curve is never drawn in', () => {
    // Arrange / Act
    render(<RateChart points={points} trend="improving" />)
    // Assert
    expect(chartAnimation).toHaveBeenCalledWith(true)
    expect(vi.mocked(chartAnimation).mock.results[0]?.value).toMatchObject({ isAnimationActive: false })
  })

  it('renders the finished curve at once when the OS asks for reduced motion', () => {
    // Arrange / Act
    const { container } = render(<RateChart points={points} trend="improving" />)
    // Assert
    expect(container.querySelector('.recharts-area-curve')?.getAttribute('d')).toMatch(/^M/)
  })
})
