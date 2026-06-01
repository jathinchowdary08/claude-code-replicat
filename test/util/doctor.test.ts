import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isBuildStale } from '../../src/util/doctor.js';

describe('isBuildStale', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'doctor-'));
    mkdirSync(join(dir, 'src'), { recursive: true });
    mkdirSync(join(dir, 'dist'), { recursive: true });
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('is true when a src file is newer than dist', () => {
    const distFile = join(dir, 'dist', 'index.js');
    const srcFile = join(dir, 'src', 'a.ts');
    writeFileSync(distFile, 'x');
    writeFileSync(srcFile, 'y');
    utimesSync(distFile, new Date(1_000_000), new Date(1_000_000));
    utimesSync(srcFile, new Date(2_000_000), new Date(2_000_000));
    expect(isBuildStale(join(dir, 'src'), distFile)).toBe(true);
  });

  it('is false when dist is newer than all src', () => {
    const distFile = join(dir, 'dist', 'index.js');
    const srcFile = join(dir, 'src', 'a.ts');
    writeFileSync(distFile, 'x');
    writeFileSync(srcFile, 'y');
    utimesSync(srcFile, new Date(1_000_000), new Date(1_000_000));
    utimesSync(distFile, new Date(2_000_000), new Date(2_000_000));
    expect(isBuildStale(join(dir, 'src'), distFile)).toBe(false);
  });

  it('is true when dist is missing', () => {
    expect(isBuildStale(join(dir, 'src'), join(dir, 'dist', 'missing.js'))).toBe(true);
  });
});
