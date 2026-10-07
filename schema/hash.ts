import { createHash } from 'node:crypto';
import type { CountryRelease } from './release.ts';

/** JSON with object keys sorted at every depth and no whitespace, so equal content always serialises to equal bytes. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.fromEntries(Object.keys(v).sort().filter(k => (v as Record<string, unknown>)[k] !== undefined)
        .map(k => [k, sort((v as Record<string, unknown>)[k])]));
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

/** SHA-256 of the release content, excluding the `release` block (its own identity and provenance). */
export function releaseHash(release: CountryRelease): string {
  const { release: _identity, ...content } = release;
  return createHash('sha256').update(canonicalJson(content)).digest('hex');
}
