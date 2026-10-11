import type { RatePointOut } from '@/types/insights'
import { areaPoints, plotRuns, polylinePoints } from './chartGeometry'

// A null rate breaks the line (see plotRuns), so a run of one point has nothing to draw. `filled` adds the soft area
// under each run on the full chart; the sidebar sparkline stays a bare line.
export function RateLines({ points, filled = false }: { points: RatePointOut[]; filled?: boolean }) {
  const runs = plotRuns(points).filter((run) => run.length > 1)
  return (
    <>
      {filled && runs.map((run) => <polygon key={`area-${run[0]?.id}`} points={areaPoints(run)} className="fill-primary-soft" />)}
      {runs.map((run) => (
        <polyline key={run[0]?.id} points={polylinePoints(run)} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="fill-none stroke-primary stroke-2" />
      ))}
    </>
  )
}
