#!/usr/bin/env node
import { main } from '../src/cli.js';

// `heaven get ... | head` closes our stdout early: exit quietly instead of dumping a stack trace.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (e) => {
    if (e.code === 'EPIPE') process.exit(0);
    throw e;
  });
}

process.exitCode = await main(process.argv.slice(2));
