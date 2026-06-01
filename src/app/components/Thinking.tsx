import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import InkSpinner from 'ink-spinner';
import { totalTokens, type UsageTotals } from '../../llm/tokens.js';
import { fmtTokens, fmtElapsed } from '../format.js';

const ORANGE = '#d97757';

const WORDS = [
  'Forging',
  'Cogitating',
  'Catapulting',
  'Conjuring',
  'Processing',
  'Herding',
  'Synthesizing',
  'Pondering',
  'Computing',
  'Manifesting',
  'Noodling',
  'Percolating',
  'Spelunking',
  'Wrangling',
  'Tinkering',
  'Simmering',
  'Vibing',
  'Baking',
];

function pick(): string {
  return WORDS[Math.floor(Math.random() * WORDS.length)]!;
}

export function Thinking({ usage, cost }: { usage: UsageTotals; cost: number }): React.ReactElement {
  const [elapsed, setElapsed] = useState(0);
  const [word, setWord] = useState(pick);

  useEffect(() => {
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    const swap = setInterval(() => setWord(pick()), 3000);
    return () => {
      clearInterval(tick);
      clearInterval(swap);
    };
  }, []);

  const tok = totalTokens(usage);
  const meta = [
    fmtElapsed(elapsed),
    ...(tok > 0 ? [`↑ ${fmtTokens(tok)} tokens`] : []),
    ...(cost > 0 ? [`$${cost.toFixed(4)}`] : []),
    'esc to interrupt',
  ].join(' · ');

  return (
    <Box>
      <Text color={ORANGE}>
        <InkSpinner type="dots" />
      </Text>
      <Text color={ORANGE} bold>
        {' '}
        {word}…{' '}
      </Text>
      <Text color="gray">({meta})</Text>
    </Box>
  );
}
