#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './common.mjs'

const runtimeEnv = join(ROOT, '.offline', 'runtime.env')
if (!existsSync(runtimeEnv)) {
  console.error('Primero ejecuta `pnpm offline:start`.')
  process.exit(1)
}

let result = spawnSync(
  'node',
  ['scripts/generate-runtime-config.mjs', '--env-file', '.offline/runtime.env'],
  { cwd: ROOT, stdio: 'inherit' },
)
if (result.status !== 0) process.exit(result.status ?? 1)

result = spawnSync('pnpm', ['exec', 'ng', 'serve', 'pos-angular'], {
  cwd: ROOT,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
