#!/usr/bin/env node
import { readFileSync } from 'node:fs';

import { promote, PromoteError } from '../src/promote.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const USAGE = `kkpromote - promote an application's image tag between Kustomize environments

Usage:
  kkpromote <path> <source-env> <target-env> [options]

Arguments:
  path           directory for the application, containing an environment
                 subdirectory per overlay (e.g. <gitops-repo>/applications/hcd-search-api)
  source-env     environment subdirectory to copy the image tag from
  target-env     environment subdirectory to copy the image tag into

Options:
  -n, --dry-run       show the change without writing the file
  -h, --help          show this help
  -v, --version       show the version

Example:
  kkpromote ~/dev/hcd-tenant-config/applications/hcd-search-api dev sit`;

function parseArgs(argv) {
  const positionals = [];
  const options = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-n':
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        if (arg.startsWith('-')) throw new PromoteError(`unknown option: ${arg}`);
        positionals.push(arg);
    }
  }
  return { positionals, options };
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    if (err instanceof PromoteError) {
      process.stderr.write(`error: ${err.message}\n`);
      process.exit(2);
    }
    throw err;
  }
  const { positionals, options } = parsed;

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  if (options.version) {
    process.stdout.write(`${pkg.version}\n`);
    return;
  }
  if (positionals.length !== 3) {
    process.stderr.write(`${USAGE}\n`);
    process.exit(2);
  }

  const [path, sourceEnv, targetEnv] = positionals;
  try {
    const result = promote({ path, sourceEnv, targetEnv, dryRun: options.dryRun });
    const prefix = `${result.application} (${sourceEnv} -> ${targetEnv})`;
    if (!result.changed) {
      process.stdout.write(`${prefix} already at ${result.tag}, no change made\n`);
    } else {
      const suffix = options.dryRun ? ' (dry run, not written)' : '';
      process.stdout.write(`${prefix}: ${result.previousTag} -> ${result.tag}${suffix}\n`);
    }
  } catch (err) {
    if (err instanceof PromoteError) {
      process.stderr.write(`error: ${err.message}\n`);
      process.exit(1);
    }
    throw err;
  }
}

main();

