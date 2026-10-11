// Its own module so a failed chunk load can be retried with a fresh import (and simulated in tests).
export const loadRephraseResults = () => import('./RephraseResults').then((module) => ({ default: module.RephraseResults }))
