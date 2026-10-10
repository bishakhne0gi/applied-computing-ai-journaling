// Lighthouse gate: desktop perf/a11y/best-practices/seo = 100, mobile perf ≥ 90, median of 3.
// Audits `vite build --mode mock` (mocks on, so data pages render) served by `vite preview`.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { chromium } from '@playwright/test'

const PORT = 4173
const URL = `http://localhost:${PORT}/`
const RUNS = 3
const BARS = { desktop: { performance: 100, accessibility: 100, 'best-practices': 100, seo: 100 }, mobile: { performance: 90 } }
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const fail = (msg) => {
  console.error(`\nLighthouse gate failed: ${msg}`)
  process.exit(1)
}
const reachable = () => fetch(URL).then(() => true, () => false)

if (await reachable()) fail(`port ${PORT} is already serving something — stop it (another preview/app?) and rerun.`)
if (spawnSync('pnpm', ['exec', 'vite', 'build', '--mode', 'mock'], { stdio: 'inherit' }).status !== 0) fail('build failed')

const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
let serverDied = false
server.on('exit', () => (serverDied = true))
for (let i = 0; i < 60 && !(await reachable()); i++) {
  if (serverDied) fail(`vite preview exited — is port ${PORT} taken?`)
  await new Promise((r) => setTimeout(r, 250))
}
const served = await fetch(URL).then((r) => r.text(), () => '')
if (served !== readFileSync('dist/index.html', 'utf8')) {
  server.kill()
  fail(`port ${PORT} is not serving this build`)
}

rmSync('.lighthouse', { recursive: true, force: true })
mkdirSync('.lighthouse', { recursive: true })
const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath() }

function run(preset, i) {
  const out = `.lighthouse/${preset}-${i}.json`
  const args = ['exec', 'lighthouse', URL, '--quiet', '--chrome-flags=--headless=new', '--output=json', `--output-path=${out}`]
  if (preset === 'desktop') args.push('--preset=desktop')
  const res = spawnSync('pnpm', args, { encoding: 'utf8', env })
  if (!existsSync(out)) throw new Error(`no report (${preset} run ${i}). Lighthouse said:\n${(res.stderr || '').slice(-800)}`)
  return JSON.parse(readFileSync(out, 'utf8')).categories
}

const failed = []
try {
  for (const [preset, bars] of Object.entries(BARS)) {
    const runs = Array.from({ length: RUNS }, (_, i) => run(preset, i))
    for (const [cat, bar] of Object.entries(bars)) {
      const score = median(runs.map((c) => Math.round(c[cat].score * 100)))
      console.log(`${score >= bar ? '✔' : '✘'} ${preset.padEnd(7)} ${cat.padEnd(15)} ${score} (bar ${bar})`)
      if (score < bar) failed.push(`${preset} ${cat} ${score} < ${bar}`)
    }
  }
} catch (e) {
  failed.push(e.message)
} finally {
  server.kill()
}
if (failed.length) fail(failed.join('; '))
console.log('\nLighthouse gate green')
