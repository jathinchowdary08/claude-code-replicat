import React from 'react';
import { Box, Text } from 'ink';

/** A deliberately small markdown renderer: headings, lists, and fenced code. */
export function Markdown({ text, color }: { text: string; color?: string }): React.ReactElement {
  const lines = text.split('\n');
  const out: React.ReactElement[] = [];
  let inFence = false;

  lines.forEach((line, i) => {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      out.push(
        <Text key={i} color="gray">
          {'  '}
          {line}
        </Text>,
      );
      return;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      out.push(
        <Text key={i} bold color="cyan">
          {heading[2]}
        </Text>,
      );
      return;
    }
    const bullet = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      out.push(
        <Text key={i} color={color}>
          {bullet[1]}• {stripInline(bullet[2] ?? '')}
        </Text>,
      );
      return;
    }
    out.push(
      <Text key={i} color={color}>
        {stripInline(line) || ' '}
      </Text>,
    );
  });

  return <Box flexDirection="column">{out}</Box>;
}

/** Strip the most common inline markers so they don't show as literal characters. */
function stripInline(s: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}
