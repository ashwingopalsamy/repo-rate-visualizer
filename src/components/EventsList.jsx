import { ExternalLink } from 'lucide-react';
import { macroEvents } from '../data/dataLoader.js';
import { Badge } from './ui/badge.jsx';

const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
});

export default function EventsList({ dateRange }) {
  let events = macroEvents;

  if (dateRange.start) {
    const start = new Date(dateRange.start);
    events = events.filter(event => event.dateObj >= start);
  }
  if (dateRange.end) {
    const end = new Date(dateRange.end);
    events = events.filter(event => event.dateObj <= end);
  }

  if (events.length === 0) {
    return <p className="m-0 py-2 text-sm leading-6 text-muted-foreground">No macro events in this range.</p>;
  }

  return (
    <div className="event-records grid gap-x-8 md:grid-cols-2" role="list">
      {events.map((event, index) => (
        <a
          key={`${event.date}-${index}`}
          className="event-record group grid min-w-0 grid-cols-[64px_minmax(0,1fr)] gap-x-4 gap-y-2 border-b border-border/70 py-4 transition-[background-color,border-color] duration-150 ease-out hover:bg-muted/45 focus-visible:bg-muted/45 focus-visible:outline-none"
          href={event.citation}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${event.label}: ${event.description}`}
          role="listitem"
        >
          <time className="row-span-3 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground" dateTime={event.date}>{formatDate(event.date)}</time>
          <span className="flex min-w-0 items-start gap-2 text-sm font-semibold tracking-[-0.015em] text-foreground">
            <span className="min-w-0">{event.label}</span>
            <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0 max-w-[34rem] text-xs leading-5 text-muted-foreground">{event.description}</span>
          <Badge className="w-fit px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em]" variant="outline">{event.type}</Badge>
        </a>
      ))}
    </div>
  );
}
