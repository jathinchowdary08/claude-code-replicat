import React from 'react';
import { render } from 'ink';
import chalk from 'chalk';
import { App } from './App.js';
import { createRuntime } from '../runtime.js';
import { formatError } from '../util/errors.js';
import type { CliArgs } from '../cli/args.js';

export async function startInteractive(args: CliArgs): Promise<number> {
  let rt;
  try {
    rt = createRuntime({
      cwd: args.cwd,
      addDirs: args.addDirs,
      model: args.model,
      permissionMode: args.permissionMode,
    });
  } catch (err) {
    process.stderr.write(chalk.red(`${formatError(err)}\n`));
    return 1;
  }

  const instance = render(<App rt={rt} args={args} initialPrompt={args.prompt} />);
  try {
    await instance.waitUntilExit();
  } finally {
    rt.ctx.shells.killAll();
  }
  return 0;
}
