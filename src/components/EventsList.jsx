import { macroEvents } from '../data/dataLoader.js';
import Icon from './ui/icon.jsx';

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
    <div className="grid gap-x-8 md:grid-cols-2" role="list">
      {events.map((event, index) => (
        <a
          key={`${event.date}-${index}`}
          className="event-record group grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-border/60 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40"
          href={event.citation}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${event.label}: ${event.description}`}
          role="listitem"
        >
          <time className="row-span-4 pt-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground" dateTime={event.date}>{formatDate(event.date)}</time>
          <span className="flex min-w-0 items-start gap-2 text-sm font-medium text-foreground">
            <span className="min-w-0">{event.label}</span>
            <Icon name="external" size={12} className="mt-0.5 shrink-0 text-muted-foreground transition-colors group-hover:text-source" />
          </span>
          <span className="min-w-0 max-w-[34rem] text-xs leading-5 text-muted-foreground">{event.description}</span>
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{event.type}</span>
        </a>
      ))}
    </div>
  );
}
