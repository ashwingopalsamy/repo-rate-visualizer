import type { Decision, Meeting } from '../../../schema/release.ts';
import { SourceParseError } from '../../lib/errors.ts';
import { htmlText } from '../../lib/html.ts';
import { addDays } from '../../lib/time.ts';

/** "4" -> 400, "3-3/4" -> 375, "1/4" -> 25 (percent written as a whole number, fraction or mixed fraction). */
export function parseFraction(text: string): number {
  const t = text.trim();
  const mixed = /^(\d+)(?:-(\d+)\/(\d+))?$/.exec(t);
  if (mixed) return Math.round((Number(mixed[1]) + (mixed[2] ? Number(mixed[2]) / Number(mixed[3]) : 0)) * 100);
  const fraction = /^(\d+)\/(\d+)$/.exec(t);
  if (fraction) return Math.round((Number(fraction[1]) / Number(fraction[2])) * 100);
  throw new SourceParseError(`Unreadable rate "${text}"`);
}

export const statementId = (meeting: Meeting) => meeting.date.replaceAll('-', '');
export const statementUrl = (meeting: Meeting) => `https://www.federalreserve.gov/newsevents/pressreleases/monetary${statementId(meeting)}a.htm`;

const longDate = (date: string) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const names = (list: string) => list.split(/\s*,\s*|\s+and\s+/).map(n => n.replace(/^and\s+/, '').trim()).filter(Boolean);

function parseDissents(text: string): string[] {
  const against = /Voting against (?:this|the monetary policy) action (?:was|were) (.+?)\.\s+(?=Absent|For media|Implementation|Last Update)/.exec(text);
  return against ? against[1].split(/;\s*(?:and\s+)?/).flatMap(clause => names(clause.split(/,\s*who\b/)[0])) : [];
}

function parseVote(text: string): Decision['vote'] {
  const dissents = parseDissents(text);
  const tally = /by an? (\d+)\s*[–-]\s*(\d+) vote/i.exec(text);
  if (tally) return { for: Number(tally[1]), against: Number(tally[2]), dissents };
  const forList = /Voting for the monetary policy action were (.+?)\.\s+(?=Voting against|Absent|For media|Implementation)/.exec(text);
  if (!forList) return null;
  const voters = forList[1].split(/;\s*(?:and\s+)?/).map(n => n.replace(/,\s*(?:Vice\s+)?Chair\b.*$/, '').trim()).filter(Boolean);
  return { for: voters.length, against: dissents.length, dissents };
}

/** One FOMC statement page to a decision record. Throws SourceParseError when the page is not the expected statement. */
export function parseFomcStatement(html: string, meeting: Meeting, previousUpperBps?: number): Decision {
  const text = htmlText(html);
  if (!text.includes(longDate(meeting.date))) throw new SourceParseError(`Statement page does not carry the date ${longDate(meeting.date)}`);
  const sentence = /((?:In support of[^.]*?,\s*)?the Committee decided to (raise|increase|lower|reduce|maintain|keep|leave)[^.]*?target range for the federal funds rate[^.]*?\.)/i.exec(text);
  if (!sentence) throw new SourceParseError(`No target-range decision sentence for ${meeting.id}`);
  const range = /target range for the federal funds rate (?:by ([\d/-]+) percentage points? )?(?:at|to) ([\d/-]+) to ([\d/-]+) percent/i.exec(sentence[1]);
  if (!range) throw new SourceParseError(`Unreadable target range for ${meeting.id}`);
  const verb = sentence[2].toLowerCase();
  const direction = verb === 'raise' || verb === 'increase' ? 'hike' : verb === 'lower' || verb === 'reduce' ? 'cut' : 'hold';
  const lowBps = parseFraction(range[2]);
  const highBps = parseFraction(range[3]);
  let step = range[1] ? parseFraction(range[1]) : 0;
  if (!range[1] && direction !== 'hold') {
    if (previousUpperBps === undefined) throw new SourceParseError(`${meeting.id} moves the range without stating the step, and no previous level was given`);
    step = Math.abs(highBps - previousUpperBps);
  }
  const excerpt = sentence[1].trim();
  return {
    id: meeting.id,
    meetingId: meeting.id,
    announcedAt: meeting.announceAt,
    effectiveDate: addDays(meeting.date, meeting.effectiveLagDays),
    level: { kind: 'range', lowBps, highBps },
    direction,
    changeBps: direction === 'hike' ? step : direction === 'cut' ? -step : 0,
    eraChange: false,
    offCycle: false,
    evidence: 'statement',
    vote: parseVote(text),
    stance: null,
    statementUrl: statementUrl(meeting),
    excerpt: excerpt[0].toUpperCase() + excerpt.slice(1),
    sourceIds: [`us-statement-${statementId(meeting)}`],
  };
}
