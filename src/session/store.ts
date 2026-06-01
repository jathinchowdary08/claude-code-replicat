/**
 * Append-only JSONL session transcripts. Each session is one file under
 * `~/.agent/projects/<projectKey>/<id>.jsonl`. The first line is a `meta` record;
 * every subsequent line is a `message` record holding one Anthropic message param,
 * appended as the conversation progresses. Secrets are redacted before write.
 *
 * `--resume <id>` reopens a specific transcript; `--continue` reopens the latest.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { sessionsDir } from '../config/paths.js';
import { redact } from '../util/redact.js';
import { ConfigError } from '../util/errors.js';

export const SESSION_VERSION = 1;

interface MetaRecord {
  type: 'meta';
  version: number;
  id: string;
  cwd: string;
  createdAt: string;
  model?: string;
}

interface MessageRecord {
  type: 'message';
  ts: string;
  message: Anthropic.MessageParam;
}

type SessionRecord = MetaRecord | MessageRecord;

export interface LoadedSession {
  id: string;
  messages: Anthropic.MessageParam[];
  meta: MetaRecord | null;
}

export interface SessionSummary {
  id: string;
  path: string;
  mtimeMs: number;
}

function fileFor(cwd: string, id: string): string {
  return join(sessionsDir(cwd), `${id}.jsonl`);
}

/** A handle to one transcript file that messages are appended to. */
export class SessionStore {
  readonly id: string;
  readonly path: string;

  private constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }

  /** Sortable, filesystem-safe id: ISO timestamp + short random suffix. */
  static newId(): string {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `${ts}-${randomBytes(3).toString('hex')}`;
  }

  /** Start a brand-new transcript and write its meta header. */
  static create(cwd: string, model?: string): SessionStore {
    const dir = sessionsDir(cwd);
    mkdirSync(dir, { recursive: true });
    const id = SessionStore.newId();
    const store = new SessionStore(id, fileFor(cwd, id));
    store.writeRecord({
      type: 'meta',
      version: SESSION_VERSION,
      id,
      cwd,
      createdAt: new Date().toISOString(),
      model,
    });
    return store;
  }

  /** Get a handle for appending to an existing transcript (no header written). */
  static at(cwd: string, id: string): SessionStore {
    return new SessionStore(id, fileFor(cwd, id));
  }

  /** Append one message to the transcript (redacted). */
  appendMessage(message: Anthropic.MessageParam): void {
    this.writeRecord({ type: 'message', ts: new Date().toISOString(), message });
  }

  private writeRecord(rec: SessionRecord): void {
    appendFileSync(this.path, `${redact(JSON.stringify(rec))}\n`, 'utf8');
  }

  /** All transcripts for this project, newest first. */
  static list(cwd: string): SessionSummary[] {
    const dir = sessionsDir(cwd);
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .filter((name) => name.endsWith('.jsonl'))
      .map((name) => {
        const path = join(dir, name);
        return { id: name.slice(0, -'.jsonl'.length), path, mtimeMs: statSync(path).mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }

  /** The id of the most recently modified transcript, if any. */
  static latestId(cwd: string): string | null {
    return SessionStore.list(cwd)[0]?.id ?? null;
  }

  /** Read and reconstruct the messages from a transcript. */
  static load(cwd: string, id: string): LoadedSession {
    const path = fileFor(cwd, id);
    if (!existsSync(path)) {
      throw new ConfigError(`No session "${id}" found for this project.`);
    }
    const messages: Anthropic.MessageParam[] = [];
    let meta: MetaRecord | null = null;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let rec: SessionRecord;
      try {
        rec = JSON.parse(line) as SessionRecord;
      } catch {
        continue; // tolerate a truncated trailing line
      }
      if (rec.type === 'meta') meta = rec;
      else if (rec.type === 'message') messages.push(rec.message);
    }
    return { id, messages, meta };
  }
}

export interface SessionInfo {
  id: string;
  mtimeMs: number;
  messageCount: number;
  firstMessage: string;
}

function contentToText(content: Anthropic.MessageParam['content']): string {
  if (typeof content === 'string') return content;
  for (const block of content) {
    const b = block as { type: string; text?: string };
    if (b.type === 'text' && b.text) return b.text;
  }
  return '';
}

/** Recent sessions with a short summary, newest first, for the resume picker. */
export function listSessionSummaries(cwd: string): SessionInfo[] {
  return SessionStore.list(cwd)
    .slice(0, 20)
    .map((s) => {
      try {
        const loaded = SessionStore.load(cwd, s.id);
        const firstUser = loaded.messages.find((m) => m.role === 'user');
        return {
          id: s.id,
          mtimeMs: s.mtimeMs,
          messageCount: loaded.messages.length,
          firstMessage: (firstUser ? contentToText(firstUser.content) : '').replace(/\s+/g, ' ').slice(0, 60),
        };
      } catch {
        return { id: s.id, mtimeMs: s.mtimeMs, messageCount: 0, firstMessage: '' };
      }
    });
}

export interface OpenSessionOptions {
  /** Resume a specific session id. */
  resume?: string;
  /** Resume the latest session for this project. */
  continueLatest?: boolean;
  /** Model id recorded in a new session's meta header. */
  model?: string;
}

export interface OpenedSession {
  store: SessionStore;
  /** Prior messages to seed the conversation (empty for a fresh session). */
  messages: Anthropic.MessageParam[];
  /** True when a prior transcript was reopened. */
  resumed: boolean;
}

/**
 * Resolve `--resume` / `--continue` into a writable {@link SessionStore} plus the
 * reconstructed prior messages. A fresh session is created when neither is set.
 */
export function openSession(cwd: string, opts: OpenSessionOptions = {}): OpenedSession {
  if (opts.resume) {
    const loaded = SessionStore.load(cwd, opts.resume);
    return { store: SessionStore.at(cwd, opts.resume), messages: loaded.messages, resumed: true };
  }
  if (opts.continueLatest) {
    const id = SessionStore.latestId(cwd);
    if (!id) throw new ConfigError('No previous session to continue for this project.');
    const loaded = SessionStore.load(cwd, id);
    return { store: SessionStore.at(cwd, id), messages: loaded.messages, resumed: true };
  }
  return { store: SessionStore.create(cwd, opts.model), messages: [], resumed: false };
}
