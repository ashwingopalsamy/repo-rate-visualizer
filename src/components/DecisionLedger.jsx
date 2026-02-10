import { decisions, sources } from '../data/dataLoader.js';
import { ExternalLink } from 'lucide-react';
import { Badge } from './ui/badge.jsx';
import { Button } from './ui/button.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.jsx';

const sourceById = new Map(sources.map(source => [source.id, source]));

const actionLabel = {
  initial: 'Initial',
  cut: 'Cut',
  hike: 'Hike',
  hold: 'Hold',
};

const actionVariant = (action) => action === 'cut' ? 'cut' : action === 'hike' ? 'hike' : 'hold';

const formatDate = (value) => new Date(`${value}T00:00:00.000Z`).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const formatChange = (changeBps) => {
  if (changeBps > 0) return `+${changeBps} bps`;
  return `${changeBps} bps`;
};

export default function DecisionLedger({ limit = 8 }) {
  const recentDecisions = [...decisions].reverse().slice(0, limit);

  return (
    <section className="decision-ledger space-y-5" aria-labelledby="decision-register-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Decision spine</p>
          <h2 id="decision-register-title" className="m-0 text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl">Recent policy decisions</h2>
          <p className="mt-2 mb-0 max-w-2xl text-sm leading-6 text-muted-foreground">Official RBI records, including unchanged repo-rate decisions.</p>
        </div>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{recentDecisions.length} of {decisions.length}</span>
      </div>

      <div className="decision-ledger-table overflow-hidden rounded-2xl border border-border/80 bg-card">
        <Table aria-label="Recent official policy decisions">
          <TableHeader>
            <TableRow className="border-border/70 hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Stance</TableHead>
              <TableHead className="text-right">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentDecisions.map(decision => {
              const source = decision.sourceIds.map(sourceId => sourceById.get(sourceId)).find(Boolean);
              const variant = actionVariant(decision.action);
              return (
                <TableRow className="border-border/70" data-action={decision.action} data-decision-id={decision.id} key={decision.id}>
                  <TableCell data-label="Date" className="whitespace-nowrap text-muted-foreground">{formatDate(decision.date)}</TableCell>
                  <TableCell data-label="Decision"><Badge variant={variant}>{actionLabel[decision.action] || decision.action}</Badge></TableCell>
                  <TableCell data-label="Rate" className="font-semibold tabular-nums">{decision.repoRate.toFixed(2)}%</TableCell>
                  <TableCell data-label="Change" className={`font-medium tabular-nums ${variant === 'cut' ? 'text-cut' : variant === 'hike' ? 'text-hike' : 'text-hold'}`}>{formatChange(decision.changeBps)}</TableCell>
                  <TableCell data-label="Stance" className="text-muted-foreground">{decision.stance || 'Not reported'}</TableCell>
                  <TableCell data-label="Source" className="text-right">
                    {source ? (
                      <Button asChild className="h-8 px-2 text-xs" size="sm" variant="ghost">
                        <a href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`Open source for ${formatDate(decision.date)}`}>
                          <span>Open source</span>
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      </Button>
                    ) : <span className="text-sm text-muted-foreground">Unavailable</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
