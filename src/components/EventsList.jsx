import { ExternalLink } from 'lucide-react';
import { macroEvents } from '../data/dataLoader.js';

const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-IN', {
  year: 'numeric',
  month: 'short',
});

function getCategoryBadgeClass(type) {
  const normalized = (type || '').toLowerCase();
  if (normalized.includes('structural') || normalized.includes('fiscal') || normalized.includes('reform')) {
    return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20';
  }
  if (normalized.includes('shock') || normalized.includes('crisis') || normalized.includes('pandemic') || normalized.includes('war')) {
    return 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20';
  }
  if (normalized.includes('policy') || normalized.includes('monetary') || normalized.includes('framework')) {
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
  }
  return 'bg-muted/80 text-muted-foreground border-border/70';
}

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
    <div className="event-records grid gap-3 sm:gap-3.5 sm:grid-cols-2" role="list">
      {events.map((event, index) => (
        <a
          key={`${event.date}-${index}`}
          className="event-record group flex flex-col justify-between min-w-0 rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 transition-all duration-200 ease-out hover:border-border-strong hover:shadow-xs hover:scale-[1.01] focus-visible:outline-none active:scale-[0.99]"
          href={event.citation}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${event.label}: ${event.description}`}
          role="listitem"
        >
          <div>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <time className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap" dateTime={event.date}>
                  {formatDate(event.date)}
                </time>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${getCategoryBadgeClass(event.type)}`}>
                  {event.type}
                </span>
              </div>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground mt-0.5" aria-hidden="true" />
            </div>

            <span className="block text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              {event.label}
            </span>

            <p className="mt-1 mb-0 text-xs leading-relaxed text-muted-foreground">
              {event.description}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}
