/**
 * Builds the bundle the Hugging Face datasets are written from: for each dataset, its tables (columns and rows), its
 * README and NOTICE text, its rights block and the releases it was built from. scripts/build-hf-datasets.py turns the
 * bundle into Parquet, CSV, JSONL, schemas, a manifest and checksums.
 * Usage: node scripts/build-hf-tables.ts [--out .out/hf/bundle.json]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildTables, loadCountries } from './hf/tables.ts';
import type { CountryInput, Table } from './hf/tables.ts';
import { DATASETS, notice, readme, rightsFor } from './hf/cards.ts';
import type { DatasetSpec } from './hf/cards.ts';

export type BundleDataset = {
  repo_id: string; dir: string; version: string; generated_at: string; country_codes: string[];
  default_config: string; jsonl_configs: string[]; rights: Record<string, unknown>;
  releases: { country_code: string; hash: string; file: string; sha256: string; observed_through: string }[];
  files: Record<string, string>; configs: Table[];
};
export type Bundle = { bundle_version: 1; datasets: BundleDataset[] };

const JSONL = ['rates', 'decisions'];

function dataset(spec: DatasetSpec, xs: CountryInput[]): BundleDataset {
  const configs = buildTables(xs).filter(t => t.rows.length);
  const generated = xs.map(x => x.release.release.observedThrough).sort().at(-1)!;
  return {
    repo_id: `ashwingopalsamy/${spec.repo}`, dir: `hf/${spec.repo}`, version: spec.version, generated_at: generated, country_codes: xs.map(x => x.cc),
    default_config: 'rates', jsonl_configs: JSONL.filter(n => configs.some(t => t.name === n)), rights: rightsFor(spec, xs),
    releases: xs.map(x => ({ country_code: x.cc, hash: x.release.release.hash, file: `data/${x.releaseFile}`, sha256: x.releaseSha256, observed_through: x.release.release.observedThrough })),
    files: { 'README.md': readme(spec, xs, configs), 'NOTICE.md': notice(spec, xs) }, configs,
  };
}

export function buildBundle(): Bundle {
  const all = loadCountries();
  return { bundle_version: 1, datasets: DATASETS.map(spec => dataset(spec, spec.codes ? all.filter(x => spec.codes!.includes(x.cc)) : all)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--out'), out = i > 0 ? process.argv[i + 1] : '.out/hf/bundle.json';
  const bundle = buildBundle();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(bundle));
  console.log(`hf bundle: ${bundle.datasets.length} datasets → ${out}`);
}
