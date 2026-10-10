// Coverage band: floor 65% is enforced by vitest thresholds; above 85% we warn —
// high numbers usually mean filler tests. Review them, don't chase 100%.
import { readFileSync } from 'node:fs'

const { total } = JSON.parse(readFileSync('coverage/coverage-summary.json', 'utf8'))
const CEILING = 85
const high = ['lines', 'branches'].filter((k) => total[k].pct > CEILING)
for (const k of ['lines', 'branches', 'functions', 'statements']) console.log(`coverage ${k}: ${total[k].pct}%`)
if (high.length) console.warn(`WARN coverage above ${CEILING}% on ${high.join(', ')} — check for tests that assert nothing meaningful.`)
