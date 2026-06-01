import React from 'react';
import { Box, Text } from 'ink';
import { parseMarkdown, type InlineSpan, type MdBlock } from '../markdown.js';
import { colors } from '../theme.js';

function Inline({ spans }: { spans: InlineSpan[] }): React.ReactElement {
  return (
    <Text>
      {spans.map((s, i) => (
        <Text key={i} bold={s.bold} italic={s.italic} color={s.code ? colors.accent : undefined}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

function Block({ block }: { block: MdBlock }): React.ReactElement {
  switch (block.type) {
    case 'blank':
      return <Text> </Text>;
    case 'rule':
      return <Text color={colors.dim}>{'─'.repeat(40)}</Text>;
    case 'heading':
      return (
        <Text bold color={block.level <= 1 ? colors.accent : colors.info}>
          <Inline spans={block.spans} />
        </Text>
      );
    case 'quote':
      return (
        <Text color={colors.dim}>
          {'│ '}
          <Inline spans={block.spans} />
        </Text>
      );
    case 'bullet':
      return (
        <Text>
          {'  '.repeat(block.indent)}
          <Text color={colors.accent}>• </Text>
          <Inline spans={block.spans} />
        </Text>
      );
    case 'ordered':
      return (
        <Text>
          {'  '.repeat(block.indent)}
          <Text color={colors.accent}>{block.number}. </Text>
          <Inline spans={block.spans} />
        </Text>
      );
    case 'code':
      return (
        <Box flexDirection="column">
          {block.lang ? <Text color={colors.dim}>{block.lang}</Text> : null}
          {block.lines.map((line, i) => (
            <Text key={i} color={colors.info}>
              {'  '}
              {line || ' '}
            </Text>
          ))}
        </Box>
      );
    case 'paragraph':
      return <Inline spans={block.spans} />;
  }
}

export function Markdown({ text }: { text: string }): React.ReactElement {
  const blocks = parseMarkdown(text);
  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </Box>
  );
}
