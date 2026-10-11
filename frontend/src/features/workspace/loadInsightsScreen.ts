// Its own module so a failed chunk load can be retried with a fresh import (and simulated in tests).
export const loadInsightsScreen = () => import('@/features/insights/InsightsScreen').then((module) => ({ default: module.InsightsScreen }))
