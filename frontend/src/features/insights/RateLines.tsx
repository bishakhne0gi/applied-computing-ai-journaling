import type { RatePointOut } from '@/types/insights'
import { plotRuns, polylinePoints } from './chartGeometry'

// A null rate breaks the line (see plotRuns), so a run of one point has nothing to draw.
export function RateLines({ points }: { points: RatePointOut[] }) {
  return (
    <>
      {plotRuns(points)
        .filter((run) => run.length > 1)
        .map((run) => (
          <polyline key={run[0]?.id} points={polylinePoints(run)} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="fill-none stroke-primary stroke-2" />
        ))}
    </>
  )
}
