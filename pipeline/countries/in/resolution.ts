import type { Decision } from '../../../schema/release.ts';
import { SourceParseError } from '../../lib/errors.ts';
import { htmlText } from '../../lib/html.ts';

export type MpcResolution = { date: string; rateBps: number; direction: 'hike' | 'cut' | 'hold'; vote: Decision['vote']; excerpt: string; url: string };

const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const COUNT: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const MPC_SIZE = 6;
const RATE_VERB = /(reduce|cut|lower|increase|raise|hike|keep|maintain|retain|leave)\w*\s+the policy repo rate[\s\S]*?(?:unchanged at|to|at)\s+(\d+(?:\.\d+)?)\s*per\s?cent/i;

/** Sentences of the visible text, with honorifics and initials protected so "Dr. Jayanth R. Varma" stays one name. */
function sentences(text: string): string[] {
  return text
    .replace(/\b(Dr|Prof|Smt|Mr|Ms|Mrs|Shri)\./g, '$1§')
    .replace(/\b([A-Z])\./g, '$1§')
    .split(/(?<=\.)\s+/)
    .map(s => s.replace(/§/g, '.').trim());
}

const namesBefore = (sentence: string, marker: RegExp) =>
  sentence.split(marker)[0].replace(/^\d+\.\s*/, '').split(/,\s*|\s+and\s+/).map(n => n.trim()).filter(n => /^(Dr|Prof|Smt|Mr|Ms|Mrs|Shri)\b/.test(n));

const TITLED = /^(?:\d+\.\s*)?(?:Dr|Prof|Smt|Shri)\b/;
const RATE_VOTE = /voted (?:in favour of the (?:monetary policy )?decision|to (?:increase|raise|reduce|cut|lower|keep|maintain|retain|leave|hike)[\s\S]*?(?:policy )?(?:repo )?rate|for (?:a |an )?(?:reduction|increase|cut|hike)[\s\S]*?(?:policy )?(?:repo )?rate)/i;

/** The committee vote stated in resolution text, failing closed: a named vote that does not account for all six members gives null. */
export function parseVote(text: string): Decision['vote'] {
  const all = sentences(text);
  const majority = all.findIndex(s => TITLED.test(s) && RATE_VOTE.test(s));
  if (majority >= 0) {
    const [majorityPart, whilePart] = all[majority].split(/,\s*while\s+/i);
    const voters = namesBefore(majorityPart, /\s+voted\b/);
    let dissents = whilePart ? namesBefore(whilePart, /\s+voted\b/) : [];
    if (!whilePart) {
      const next = all[majority + 1] ?? '';
      if (/voted (?:against|to|for)/i.test(next) && !/stance|accommodation/i.test(next)) dissents = namesBefore(next, /\s+voted\b/);
    }
    return voters.length + dissents.length === MPC_SIZE ? { for: voters.length, against: dissents.length, dissents } : null;
  }
  // "Four members (Dr. A, ...) voted to reduce ... by 35 basis points, while two members (Dr. B and Dr. C) voted ... 25 basis points."
  const grouped = /\b(one|two|three|four|five|six|\d) members? \(([^)]*)\) voted [^.]*?,\s*while (one|two|three|four|five|\d) members? \(([^)]*)\) voted/i.exec(text);
  if (grouped) {
    const inFavour = COUNT[grouped[1].toLowerCase()] ?? Number(grouped[1]);
    const against = COUNT[grouped[3].toLowerCase()] ?? Number(grouped[3]);
    const dissents = grouped[4].split(/,\s*|\s+and\s+/).map(n => n.trim()).filter(Boolean);
    return inFavour + against === MPC_SIZE && dissents.length === against ? { for: inFavour, against, dissents } : null;
  }
  if (/,\s*while\b[^.]*\bvoted\b/i.test(text)) return null;
  const counted = /\b(one|two|three|four|five|six|\d) members (?:of the MPC )?voted in favour/i.exec(text);
  if (counted) {
    const inFavour = COUNT[counted[1].toLowerCase()] ?? Number(counted[1]);
    if (inFavour === MPC_SIZE) return { for: MPC_SIZE, against: 0, dissents: [] };
    const against = all.find(s => /voted against/i.test(s) && !/stance|accommodation/i.test(s));
    const dissents = against ? namesBefore(against, /\s+voted\b/) : [];
    return dissents.length === MPC_SIZE - inFavour ? { for: inFavour, against: dissents.length, dissents } : null;
  }
  // "All members voted" counts only when no member is named voting separately on the rate.
  if (all.some(s => TITLED.test(s) && /\bvoted\b/.test(s) && !/stance|accommodation/i.test(s))) return null;
  if (/voted unanimously|unanimously voted|all (?:the )?members(?: of the MPC)?(?: \([^)]*\))? (?:unanimously )?voted/i.test(text)) return { for: MPC_SIZE, against: 0, dissents: [] };
  return null;
}

const SUBJECTS = ['the monetary policy committee (mpc)', 'the monetary policy committee', 'the mpc'];
const EXCERPT_MAX = 400;

/** The committee's own decision clause ("The MPC decided to ... per cent ..."), never the page chrome before it. */
function decisionClause(sentence: string): string {
  const verbAt = sentence.search(/(reduce|cut|lower|increase|raise|hike|keep|maintain|retain|leave)\w*\s+the policy repo rate/i);
  const head = sentence.slice(0, verbAt).toLowerCase();
  const subjectAt = Math.max(...SUBJECTS.map(s => head.lastIndexOf(s)));
  const start = subjectAt >= 0 && verbAt - subjectAt <= 200 ? subjectAt : verbAt;
  let clause = sentence.slice(start).replace(/\s*•\s*/g, ' ').replace(/\s+/g, ' ').trim();
  if (clause.length > EXCERPT_MAX) clause = sentence.slice(verbAt).trim();
  if (clause.length > EXCERPT_MAX) clause = `${clause.slice(0, EXCERPT_MAX - 1).replace(/\s+\S*$/, '')}…`;
  return clause[0].toUpperCase() + clause.slice(1);
}

/** One RBI MPC resolution press release to its decision facts. Throws SourceParseError when no repo-rate decision is found. */
export function parseMpcResolution(html: string, url: string): MpcResolution {
  const text = htmlText(html);
  const dated = /Date\s*:\s*([A-Z][a-z]{2})\s+(\d{1,2}),\s*(\d{4})/.exec(text);
  if (!dated || !MONTHS[dated[1]]) throw new SourceParseError(`No release date on ${url}`);
  const date = `${dated[3]}-${MONTHS[dated[1]]}-${dated[2].padStart(2, '0')}`;
  const sentence = sentences(text).find(s => RATE_VERB.test(s));
  if (!sentence) throw new SourceParseError(`No policy repo rate decision on ${url}`);
  const match = RATE_VERB.exec(sentence)!;
  const verb = match[1].toLowerCase();
  const direction = /reduce|cut|lower/.test(verb) ? 'cut' : /increase|raise|hike/.test(verb) ? 'hike' : 'hold';
  return {
    date,
    rateBps: Math.round(Number(match[2]) * 100),
    direction,
    vote: parseVote(text),
    excerpt: decisionClause(sentence),
    url,
  };
}
