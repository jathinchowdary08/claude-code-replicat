export const HELP_TEXT = `acode — a terminal AI coding agent

Usage:
  acode [prompt]                 Start interactive mode (or run a one-off prompt)
  acode -p "<prompt>"            Print mode: run once, stream the result, exit
  echo "<prompt>" | acode -p     Print mode reading the prompt from stdin

Options:
  -p, --print                    Non-interactive: run once and print the result
      --model <id>               Model to use (e.g. claude-sonnet-4-6, claude-opus-4-8)
      --permission-mode <mode>   default | acceptEdits | plan | bypassPermissions
      --add-dir <dir>            Allow file access to an additional directory (repeatable)
      --cwd <dir>                Set the working directory
      --output-format <fmt>      text | json  (print mode)
      --verbose                  Verbose logging to stderr
  -c, --continue                 Resume the most recent session for this project
      --resume <id>              Resume a specific session by id
  -h, --help                     Show this help
  -v, --version                  Show the version

Environment:
  ANTHROPIC_API_KEY              Required. Your Anthropic API key.
  ANTHROPIC_BASE_URL             Optional. Override the API base URL.
`;
