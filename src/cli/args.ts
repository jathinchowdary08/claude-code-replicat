/** Minimal, dependency-free argv parser. */
import { resolve } from 'node:path';
import { isPermissionMode, type PermissionMode } from '../permissions/mode.js';

export interface CliArgs {
  prompt?: string;
  print: boolean;
  model?: string;
  permissionMode?: PermissionMode;
  addDirs: string[];
  cwd: string;
  outputFormat: 'text' | 'json';
  verbose: boolean;
  help: boolean;
  version: boolean;
  continueSession: boolean;
  resume?: string;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    print: false,
    addDirs: [],
    cwd: process.cwd(),
    outputFormat: 'text',
    verbose: false,
    help: false,
    version: false,
    continueSession: false,
  };
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = () => argv[++i];
    switch (a) {
      case '-p':
      case '--print':
        args.print = true;
        break;
      case '--model':
        args.model = next();
        break;
      case '--permission-mode': {
        const m = next();
        if (m && isPermissionMode(m)) args.permissionMode = m;
        else throw new Error(`Invalid --permission-mode: ${m}`);
        break;
      }
      case '--add-dir': {
        const d = next();
        if (d) args.addDirs.push(resolve(d));
        break;
      }
      case '--cwd': {
        const d = next();
        if (d) args.cwd = resolve(d);
        break;
      }
      case '--output-format': {
        const f = next();
        if (f === 'text' || f === 'json') args.outputFormat = f;
        else throw new Error(`Invalid --output-format: ${f}`);
        break;
      }
      case '--verbose':
        args.verbose = true;
        break;
      case '-c':
      case '--continue':
        args.continueSession = true;
        break;
      case '--resume':
        args.resume = next();
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      default:
        if (a.startsWith('-')) throw new Error(`Unknown flag: ${a}`);
        positionals.push(a);
    }
  }

  if (positionals.length > 0) args.prompt = positionals.join(' ');
  return args;
}
