#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { runPreflight } from './cli'

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options: {
    fork: { type: 'string' },
    live: { type: 'string' },
  },
  allowPositionals: true,
})

const [command, ...files] = positionals

if (command === 'test') {
  runPreflight(files, { fork: values.fork, live: values.live })
    .then((result) => {
      process.exit(result.exitCode)
    })
    .catch((err: Error) => {
      console.error(err.message)
      process.exit(1)
    })
} else {
  console.log('Usage: preflight test <files...> [--fork <rpc>] [--live <network>]')
  process.exit(0)
}
