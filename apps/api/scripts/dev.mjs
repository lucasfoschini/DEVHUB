// Dev loop without @nestjs/cli (its schematics need a newer Node): tsc rebuilds dist/,
// node --watch restarts the server when dist/ changes.
import { spawn } from 'node:child_process'

const run = (cmd, args) =>
  spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' })

const tsc = run('tsc', ['-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'])
const server = run('node', [
  '--env-file=.env',
  '--watch-path=dist',
  '--enable-source-maps',
  'dist/main.js',
])
const stop = () => [tsc, server].forEach((p) => p.kill())
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
