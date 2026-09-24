import { ArrowLeft } from 'lucide-react';
import { coverage, decisions, snapshotMeta } from '../data/dataLoader.js';
import { Button } from './ui/button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card.jsx';

const items = [
  ['Record grain', 'Each row is one recorded repo-rate observation or one directly evidenced RBI policy decision. A historical observation is not presented as a resolution citation.'],
  ['Coverage boundary', 'The explorer reports only the records present in the selected immutable release. Missing meeting periods are gaps in the public record assembled here, not inferred holds.'],
  ['Evidence classes', 'Direct RBI decision evidence, official context, and historical secondary observations remain distinct. Missing stance, decision dates, and effective dates stay unknown.'],
  ['Derived values', 'Actions, basis-point changes, regimes, cycles, and comparison summaries are deterministic calculations over the released records. They describe the data and do not establish causal explanations.'],
  ['Source responsibility', 'Publisher URLs and retrieval metadata are shown for verification. RBI and other source material remains owned by its respective publisher; this project is independent and unaffiliated.'],
];

export default function DataLimitations() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[980px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <Button asChild variant="ghost" className="-ml-2 w-fit gap-1.5 px-2 text-xs"><a href="/"><ArrowLeft className="size-3.5" />Back to explorer</a></Button>
      <header>
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Research reference</p>
        <h1 className="mt-2 mb-0 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Data limitations</h1>
        <p className="mt-2 mb-0 max-w-3xl text-sm leading-6 text-muted-foreground">What this chartbook can support, what it cannot establish, and how to read its evidence boundary.</p>
      </header>
      <Card className="rounded-2xl border-border/70 shadow-2xs">
        <CardHeader><CardTitle className="text-base">Current release</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Records</span><strong className="mt-1 block tabular-nums">{coverage.totalRecords}</strong></div>
          <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Coverage</span><strong className="mt-1 block tabular-nums">{decisions[0]?.date || 'Not reported'} – {snapshotMeta.latestRecordedDate || decisions.at(-1)?.date || 'Not reported'}</strong></div>
          <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Release</span><strong className="mt-1 block break-all font-mono text-xs">{snapshotMeta.releaseId}</strong></div>
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {items.map(([title, copy]) => (
          <section key={title} className="rounded-xl border border-border/70 bg-muted/10 p-4 sm:p-5">
            <h2 className="m-0 text-base font-semibold text-foreground">{title}</h2>
            <p className="mt-2 mb-0 max-w-3xl text-sm leading-6 text-muted-foreground">{copy}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
