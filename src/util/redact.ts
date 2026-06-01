/**
 * Secret redaction for logs and persisted transcripts. Best-effort: strips common
 * credential shapes and the live values of secret-looking environment variables.
 */

const PATTERNS: Array<{ re: RegExp; replace: string }> = [
  // Anthropic keys.
  { re: /sk-ant-[A-Za-z0-9_-]{8,}/g, replace: 'sk-ant-[REDACTED]' },
  // Generic OpenAI-style keys.
  { re: /sk-[A-Za-z0-9]{20,}/g, replace: 'sk-[REDACTED]' },
  // GitHub tokens.
  { re: /gh[posu]_[A-Za-z0-9]{20,}/g, replace: 'gh_[REDACTED]' },
  // Bearer tokens in headers.
  { re: /(Bearer\s+)[A-Za-z0-9._-]{12,}/gi, replace: '$1[REDACTED]' },
  // AWS access key ids.
  { re: /AKIA[0-9A-Z]{16}/g, replace: 'AKIA[REDACTED]' },
  // PEM private key blocks (multiline).
  {
    re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,
    replace: '[REDACTED-PRIVATE-KEY]',
  },
  // Google API keys.
  { re: /AIza[0-9A-Za-z_-]{35}/g, replace: 'AIza[REDACTED]' },
  // Slack tokens.
  { re: /xox[abprs]-[A-Za-z0-9-]{10,}/g, replace: 'xox-[REDACTED]' },
  // Slack incoming-webhook URLs.
  { re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g, replace: '[REDACTED-SLACK-WEBHOOK]' },
  // npm tokens.
  { re: /npm_[A-Za-z0-9]{36}/g, replace: 'npm_[REDACTED]' },
  // GitHub fine-grained PATs.
  { re: /github_pat_[A-Za-z0-9_]{22,}/g, replace: 'github_pat_[REDACTED]' },
  // Stripe-style secret keys.
  { re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{10,}/g, replace: '$1_$2_[REDACTED]' },
  // JSON Web Tokens.
  { re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, replace: '[REDACTED-JWT]' },
];

const SECRET_ENV_RE = /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH)/i;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Replace any occurrence of secrets found in `text`. */
export function redact(text: string): string {
  let out = text;
  for (const { re, replace } of PATTERNS) {
    out = out.replace(re, replace);
  }
  // Replace live values of secret-looking env vars (length-gated to avoid noise).
  for (const [name, value] of Object.entries(process.env)) {
    if (!value || value.length < 8) continue;
    if (!SECRET_ENV_RE.test(name)) continue;
    out = out.replace(new RegExp(escapeRegExp(value), 'g'), `[${name}]`);
  }
  return out;
}

/** Deep-redact string values in an arbitrary object (returns a copy). */
export function redactObject<T>(value: T): T {
  if (typeof value === 'string') return redact(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => redactObject(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactObject(v);
    return out as T;
  }
  return value;
}
