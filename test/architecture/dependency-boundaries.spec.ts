import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';

const SRC_DIR = join(__dirname, '..', '..', 'src');

// Domain code must not depend on frameworks, drivers or HTTP.
const FORBIDDEN_DOMAIN_PACKAGES = ['@nestjs/', 'pg', 'express', 'helmet'];
const FORBIDDEN_FROM_DOMAIN = ['adapters', 'database'];
const FORBIDDEN_FROM_APPLICATION = ['adapters', 'database'];

function listTypeScriptFiles(): string[] {
  return readdirSync(SRC_DIR, { recursive: true })
    .map(String)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => join(SRC_DIR, name));
}

function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function layerOf(file: string): 'domain' | 'application' | 'other' {
  const segments = file.split(sep);
  if (segments.includes('domain')) return 'domain';
  if (segments.includes('application')) return 'application';
  return 'other';
}

function reachesForbiddenSegment(file: string, specifier: string, segments: string[]): boolean {
  const resolved = resolve(dirname(file), specifier).split(sep);
  return segments.some((segment) => resolved.includes(segment));
}

function isForbiddenPackage(specifier: string): boolean {
  return FORBIDDEN_DOMAIN_PACKAGES.some((forbidden) =>
    forbidden.endsWith('/') ? specifier.startsWith(forbidden) : specifier === forbidden,
  );
}

describe('dependency boundaries (architecture)', () => {
  const files = listTypeScriptFiles();
  const domainFiles = files.filter((file) => layerOf(file) === 'domain');
  const applicationFiles = files.filter((file) => layerOf(file) === 'application');

  it('the domain layer exists, so the rules below are not passing on an empty set', () => {
    assert.ok(domainFiles.length > 0);
    assert.ok(applicationFiles.length > 0);
  });

  it('domain code imports no framework, driver or HTTP package', () => {
    for (const file of domainFiles) {
      for (const specifier of importSpecifiers(file)) {
        assert.equal(
          isForbiddenPackage(specifier),
          false,
          `${file} imports "${specifier}", which the domain must not depend on`,
        );
      }
    }
  });

  it('domain code never reaches into adapters or database wiring', () => {
    for (const file of domainFiles) {
      for (const specifier of importSpecifiers(file).filter((s) => s.startsWith('.'))) {
        assert.equal(
          reachesForbiddenSegment(file, specifier, FORBIDDEN_FROM_DOMAIN),
          false,
          `${file} imports "${specifier}", which reaches into an adapter or the database layer`,
        );
      }
    }
  });

  it('application code does not reach into adapters or database wiring', () => {
    for (const file of applicationFiles) {
      for (const specifier of importSpecifiers(file).filter((s) => s.startsWith('.'))) {
        assert.equal(
          reachesForbiddenSegment(file, specifier, FORBIDDEN_FROM_APPLICATION),
          false,
          `${file} imports "${specifier}", which reaches into an adapter or the database layer`,
        );
      }
    }
  });
});
