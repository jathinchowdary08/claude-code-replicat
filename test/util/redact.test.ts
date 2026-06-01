import { describe, it, expect, afterEach } from 'vitest';
import { redact } from '../../src/util/redact.js';

describe('redact', () => {
  afterEach(() => {
    delete process.env.MY_API_TOKEN;
  });

  it('redacts common credential shapes', () => {
    expect(redact('use sk-ant-ABCDEFGH12345678 now')).toContain('sk-ant-[REDACTED]');
    expect(redact(`AIza${'a'.repeat(35)}`)).toContain('AIza[REDACTED]');
    expect(redact('token xoxb-123456789012-abcdefABCDEF')).toContain('xox-[REDACTED]');
    expect(redact(`npm_${'a'.repeat(36)}`)).toContain('npm_[REDACTED]');
    expect(redact('pay sk_live_abcdEFGH1234 ok')).toContain('sk_live_[REDACTED]');
    const jwt = `eyJ${'a'.repeat(12)}.eyJ${'b'.repeat(12)}.${'c'.repeat(12)}`;
    expect(redact(jwt)).toContain('[REDACTED-JWT]');
  });

  it('redacts PEM private key blocks', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIBVz...secret...\n-----END PRIVATE KEY-----';
    expect(redact(pem)).toContain('[REDACTED-PRIVATE-KEY]');
    expect(redact(pem)).not.toContain('secret');
  });

  it('redacts live values of secret-looking env vars', () => {
    process.env.MY_API_TOKEN = 'supersecretvalue1234';
    const out = redact('config: supersecretvalue1234 end');
    expect(out).toContain('[MY_API_TOKEN]');
    expect(out).not.toContain('supersecretvalue1234');
  });

  it('leaves ordinary text untouched', () => {
    expect(redact('the quick brown fox')).toBe('the quick brown fox');
  });
});
