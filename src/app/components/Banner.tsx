import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolveModel } from '../../llm/models.js';

// Anthropic's signature mark, rendered with half-block glyphs.
const LOGO = ['▐▛███▜▌', '▝▜█████▛▘', '  ▘▘ ▝▝'];
const ORANGE = '#d97757';

const TIPS = [
  'Ask Agent to edit files or run commands',
  'Use /help to see slash commands',
  'Type @ to mention a file',
  'Run /init to generate an AGENTS.md',
];

function tilde(p: string): string {
  const home = homedir();
  return p.startsWith(home) ? `~${p.slice(home.length)}` : p;
}

/** Best-effort account label (git email); the clone authenticates by API key only. */
function gitEmail(cwd: string): string | undefined {
  try {
    return (
      execFileSync('git', ['config', 'user.email'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

export function Banner({
  model,
  cwd,
  version,
}: {
  model: string;
  cwd: string;
  version: string;
}): React.ReactElement {
  const m = resolveModel(model);
  // Loaded after first paint so the git lookup never delays the banner.
  const [account, setAccount] = useState<string | undefined>(undefined);
  useEffect(() => {
    setAccount(gitEmail(cwd));
  }, [cwd]);
  const ctx = `${Math.round(m.contextWindow / 1000)}K context`;

  return (
    <Box borderStyle="round" borderColor="gray" paddingX={1}>
      {/* Left column: logo + identity */}
      <Box flexDirection="column" marginRight={3} paddingY={1}>
        <Box flexDirection="column" marginBottom={1}>
          {LOGO.map((line, i) => (
            <Text key={i} color={ORANGE}>
              {line}
            </Text>
          ))}
        </Box>
        <Text>
          <Text bold color={ORANGE}>
            ✻ Agent Code{' '}
          </Text>
          <Text color="gray">v{version}</Text>
        </Text>
        <Text color="gray">
          {m.label} · {ctx}
          {account ? ` · ${account}` : ''}
        </Text>
        <Text color="gray">{tilde(cwd)}</Text>
      </Box>

      {/* Right column: tips, separated by a vertical rule */}
      <Box
        flexDirection="column"
        paddingX={2}
        paddingY={1}
        borderStyle="round"
        borderColor="gray"
        borderTop={false}
        borderRight={false}
        borderBottom={false}
      >
        <Text bold>Tips for getting started</Text>
        <Text color="gray">{'─'.repeat(30)}</Text>
        {TIPS.map((t, i) => (
          <Text key={i} color="gray">
            • {t}
          </Text>
        ))}
      </Box>
    </Box>
  );
}
