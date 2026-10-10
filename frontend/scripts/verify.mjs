// Quality gate in testing-pyramid order: cheapest checks first, stop at the first failure
// so an expensive e2e run never happens on code that doesn't typecheck.
import { spawnSync } from 'node:child_process'

const skipE2e = process.argv.includes('--no-e2e')
const skipLh = process.argv.includes('--no-lighthouse')
const stages = [
  ['typecheck', 'pnpm typecheck'],
  ['lint', 'pnpm lint'],
  ['analyze', 'pnpm analyze'],
  ['unit+component (coverage band)', 'pnpm coverage'],
  ...(skipE2e ? [] : [['e2e (+axe, desktop+mobile)', 'pnpm e2e']]),
  ...(skipLh ? [] : [['lighthouse (desktop 100s, mobile perf ≥90)', 'pnpm lighthouse']]),
]

for (const [name, cmd] of stages) {
  const started = Date.now()
  const { status } = spawnSync(cmd, { shell: true, stdio: 'inherit' })
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  if (status !== 0) {
    console.error(`\n✘ ${name} failed (${secs}s) — fix this before running later stages.`)
    process.exit(status ?? 1)
  }
  console.log(`✔ ${name} (${secs}s)`)
}
console.log('\nALL GATES GREEN')
