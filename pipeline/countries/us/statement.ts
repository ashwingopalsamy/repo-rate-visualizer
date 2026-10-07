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

/** Dissenting members named in "Voting against ... action was/were ...", with each "who preferred ..." reason removed. */
function parseDissents(text: string): { mentioned: boolean; names: string[] } {
  const mentioned = /Voting against\b/.test(text);
  const against = /Voting against (?:this|the(?: monetary policy)?) action (?:was|were) (.+?)\.\s+(?=Absent|For media|Implementation|Last Update)/.exec(text);
  if (!against) return { mentioned, names: [] };
  const withoutReasons = against[1].replace(/,\s*who\b[\s\S]*?(?=(?:;\s*(?:and\s+)?|,\s*and\s+)[A-Z]|$)/g, '');
  return { mentioned, names: withoutReasons.split(/\s*;\s*(?:and\s+)?|\s*,\s*(?:and\s+)?|\s+and\s+/).map(n => n.trim()).filter(Boolean) };
}

/** The vote, failing closed: a dissent that is mentioned but cannot be read gives null rather than a false unanimous vote. */
function parseVote(text: string): Decision['vote'] {
  const dissent = parseDissents(text);
  const tally = /by an? (\d+)\s*[–-]\s*(\d+) vote/i.exec(text);
  if (tally) {
    const against = Number(tally[2]);
    return { for: Number(tally[1]), against, dissents: dissent.names.length === against ? dissent.names : [] };
  }
  const forList = /Voting for the monetary policy action were (.+?)\.\s+(?=Voting against|Absent|For media|Implementation)/.exec(text);
  if (!forList) return null;
  if (dissent.mentioned && dissent.names.length === 0) return null;
  const voters = forList[1].split(/;\s*(?:and\s+)?/).map(n => n.replace(/,\s*(?:Vice\s+)?Chair\b.*$/, '').trim()).filter(Boolean);
  return { for: voters.length, against: dissent.names.length, dissents: dissent.names };
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
