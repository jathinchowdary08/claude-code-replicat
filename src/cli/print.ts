/** Non-interactive print mode: run one prompt, stream output, exit. */
import chalk from 'chalk';
import type Anthropic from '@anthropic-ai/sdk';
import { createRuntime } from '../runtime.js';
import { runAgent } from '../agent/loop.js';
import { createCancelScope } from '../util/cancel.js';
import { formatError } from '../util/errors.js';
import { addUsage, emptyUsage, totalTokens, type UsageTotals } from '../llm/tokens.js';
import type { ConfirmPermission } from '../agent/events.js';
import type { CliArgs } from './args.js';

export async function runPrint(args: CliArgs, prompt: string): Promise<number> {
  const rt = createRuntime({
    cwd: args.cwd,
    addDirs: args.addDirs,
    model: args.model,
    permissionMode: args.permissionMode,
  });

  const scope = createCancelScope();
  const onSigint = () => scope.cancel();
  process.on('SIGINT', onSigint);

  // Non-interactive: anything that would prompt is denied with a helpful reason.
  const confirmPermission: ConfirmPermission = async ({ tool }) => ({
    behavior: 'deny',
    message: `Permission required to run ${tool.name}, but this session is non-interactive. Re-run with --permission-mode acceptEdits or bypassPermissions, or add an allow rule in .agent/settings.json.`,
  });

  const json = args.outputFormat === 'json';
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt }];
  let usage: UsageTotals = emptyUsage();
  let cost = 0;
  let result = '';
  let errored = false;

  try {
    for await (const ev of runAgent({
      client: rt.client,
      model: rt.model,
      system: rt.system,
      registry: rt.registry,
      messages,
      signal: scope.signal,
      permissions: rt.permissions,
      hooks: rt.hooks,
      ctx: rt.ctx,
      confirmPermission,
      enableCompaction: true,
    })) {
      switch (ev.type) {
        case 'assistant_text':
          result += ev.delta;
          if (!json) process.stdout.write(ev.delta);
          break;
        case 'tool_request':
          result = ''; // prior text was interim; keep only the final answer for JSON
          if (!json) process.stderr.write(chalk.dim(`\n● ${ev.title}\n`));
          break;
        case 'tool_result':
          if (!json && ev.result.isError) process.stderr.write(chalk.yellow(`  ↳ ${ev.result.title ?? 'error'}\n`));
          break;
        case 'tool_denied':
          if (!json) process.stderr.write(chalk.yellow(`\n⨯ ${ev.name} denied: ${ev.reason}\n`));
          break;
        case 'usage':
          usage = addUsage(usage, ev.usage);
          cost += ev.cost;
          break;
        case 'error':
          errored = true;
          process.stderr.write(chalk.red(`\n${formatError(ev.error)}\n`));
          break;
        case 'turn_end':
          break;
      }
    }
  } finally {
    process.off('SIGINT', onSigint);
    rt.ctx.shells.killAll();
  }

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ result: result.trim(), is_error: errored, usage, total_tokens: totalTokens(usage), cost_usd: Number(cost.toFixed(4)) }, null, 2)}\n`,
    );
  } else {
    process.stdout.write('\n');
    if (args.verbose) {
      process.stderr.write(chalk.dim(`\n[${totalTokens(usage)} tokens · $${cost.toFixed(4)}]\n`));
    }
  }
  return errored ? 1 : 0;
}
