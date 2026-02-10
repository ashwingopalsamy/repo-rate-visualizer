import { macroEvents } from '../data/dataLoader.js';

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
  });
};

export default function EventsList({ dateRange }) {
  let events = macroEvents;

  if (dateRange.start) {
    const start = new Date(dateRange.start);
    events = events.filter(e => e.dateObj >= start);
  }
  if (dateRange.end) {
    const end = new Date(dateRange.end);
    events = events.filter(e => e.dateObj <= end);
  }

  if (events.length === 0) {
    return (
      <div className="events-panel__list">
        <div className="event-item">
          <span className="event-item__desc">No macro events in this range</span>
        </div>
      </div>
    );
  }

  return (
    <div className="events-panel__list" role="list">
        {events.map((evt, i) => (
          <a
            key={i}
            className="event-item"
            href={evt.citation}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${evt.label}: ${evt.description}`}
            role="listitem"
          >
            <span className="event-item__date">{formatDate(evt.date)}</span>
            <div className="event-item__content">
              <span className="event-item__label">{evt.label}</span>
              <span className="event-item__desc">{evt.description}</span>
              <span className={`event-item__type event-item__type--${evt.type}`}>
                {evt.type}
              </span>
            </div>
          </a>
        ))}
    </div>
  );
}
