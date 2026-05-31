import dotenv from 'dotenv';
import chalk from 'chalk';
import { parseArgs } from './cli/args.js';
import { HELP_TEXT } from './cli/help.js';
import { runPrint } from './cli/print.js';
import { startInteractive } from './app/start.js';
import { configureLogger } from './util/logger.js';
import { logsDir } from './config/paths.js';
import { join } from 'node:path';
import { formatError } from './util/errors.js';

const VERSION = '0.1.0';

dotenv.config({ quiet: true });

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main(): Promise<number> {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(chalk.red(`${formatError(err)}\n\n`));
    process.stderr.write(HELP_TEXT);
    return 2;
  }

  if (args.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  configureLogger({
    level: args.verbose ? 'debug' : 'warn',
    file: join(logsDir(), 'agent.log'),
  });

  const interactiveTTY = process.stdin.isTTY && process.stdout.isTTY;

  // Print mode (explicit, or non-interactive stdin/pipe).
  if (args.print || !interactiveTTY) {
    const prompt = args.prompt ?? (await readStdin());
    if (!prompt) {
      process.stderr.write(chalk.red('No prompt provided. Pass a prompt or pipe one via stdin.\n\n'));
      process.stderr.write(HELP_TEXT);
      return 2;
    }
    return runPrint(args, prompt);
  }

  // Interactive TUI.
  return startInteractive(args);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(chalk.red(`\nFatal: ${formatError(err)}\n`));
    process.exit(1);
  });
