const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar date written in an ISO date or zoned instant, without converting time zones. */
export function plainDate(iso: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (!match) throw new RangeError(`Not an ISO date: ${iso}`);
  return match[1];
}

function offsetMinutes(utcMillis: number, timeZone: string): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(new Date(utcMillis))
    .find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
}

/** The instant at a wall-clock time on a date in an IANA time zone, as ISO with that date's offset (DST aware). */
export function zonedInstant(date: string, time: string, timeZone: string): string {
  const [y, m, d] = plainDate(date).split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  let offset = offsetMinutes(wallAsUtc, timeZone);
  offset = offsetMinutes(wallAsUtc - offset * 60_000, timeZone);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  return `${plainDate(date)}T${pad(hh)}:${pad(mm)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Whole minutes elapsed from instant `fromIso` to instant `toIso` (negative when `toIso` is earlier). */
export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000);
}

/** The plain date `days` after `date`. */
export function addDays(date: string, days: number): string {
  const t = Date.parse(`${plainDate(date)}T00:00:00Z`) + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
