import { createHash } from 'node:crypto';

export const RBI_SOURCE_URLS = {
  currentRates: 'https://www.rbi.org.in/',
  policyArchive: 'https://www.rbi.org.in/scripts/Annualpolicy.aspx',
  dbieKeyRates: 'https://data.rbi.org.in/DBIE/#/dbie/home',
};

const MONTHS = new Map([
  ['jan', 0], ['january', 0],
  ['feb', 1], ['february', 1],
  ['mar', 2], ['march', 2],
  ['apr', 3], ['april', 3],
  ['may', 4],
  ['jun', 5], ['june', 5],
  ['jul', 6], ['july', 6],
  ['aug', 7], ['august', 7],
  ['sep', 8], ['september', 8],
  ['oct', 9], ['october', 9],
  ['nov', 10], ['november', 10],
  ['dec', 11], ['december', 11],
]);

export class SourceFetchError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'SourceFetchError';
  }
}

export class SourceParseError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'SourceParseError';
  }
}

export function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function decodeHtml(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&rsquo;|&lsquo;|&apos;/gi, "'")
    .replace(/&rdquo;|&ldquo;/gi, '"')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—');
}

export function stripHtml(value) {
  return decodeHtml(String(value))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRbiDate(value) {
  const normalized = stripHtml(value).replace(/\s+/g, ' ').trim();
  const match = normalized.match(/([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})/);
  if (!match) throw new SourceParseError(`Cannot parse RBI date: ${normalized}`);
  const month = MONTHS.get(match[1].toLowerCase());
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (month === undefined) throw new SourceParseError(`Unknown RBI month: ${match[1]}`);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    throw new SourceParseError(`Invalid RBI date: ${normalized}`);
  }
  return date.toISOString().slice(0, 10);
}

export function dateOnlyToTimestamp(date) {
  return `${date}T00:00:00.000Z`;
}

export function parseFlexibleDate(value) {
  const normalized = stripHtml(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10);
  let match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) {
    const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  match = normalized.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (match) return parseRbiDate(`${match[2]} ${match[1]}, ${match[3]}`);
  throw new SourceParseError(`Cannot parse DBIE date: ${normalized}`);
}

export async function fetchText(url, { fetchImpl = globalThis.fetch, timeoutMs = 30000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new SourceFetchError('No fetch implementation is available');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html, text/csv, application/json;q=0.9, */*;q=0.8',
        'user-agent': 'RBI-Repo-Rate-Visualizer/1.0 (+https://github.com/ashwingopalsamy/repo-rate-visualizer)',
      },
    });
    if (!response.ok) throw new SourceFetchError(`RBI source returned HTTP ${response.status}: ${url}`);
    const body = await response.text();
    if (body.trim().length < 80) throw new SourceFetchError(`RBI source returned an unexpectedly short body: ${url}`);
    return {
      url,
      body,
      retrievedAt: new Date().toISOString(),
      checksum: sha256(body),
      contentType: response.headers?.get?.('content-type') || '',
    };
  } catch (error) {
    if (error instanceof SourceFetchError) throw error;
    throw new SourceFetchError(`Could not fetch RBI source ${url}: ${error.message}`, { cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

function sourceTitleFromHtml(html, fallback) {
  const tableHeadings = [...html.matchAll(/<td\b[^>]*class=['"][^'"]*tableheader[^'"]*['"][^>]*>\s*<b>([\s\S]*?)<\/b>/gi)]
    .map(match => stripHtml(match[1]))
    .filter(value => value && !/^date\s*:/i.test(value) && !/^\d+\s*kb$/i.test(value));
  const documentHeading = tableHeadings.find(value => /Monetary\s+Policy|Minutes\s+of\s+the\s+Monetary/i.test(value));
  if (documentHeading) return documentHeading;
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripHtml(match[1]).replace(/\s*\|\s*Official Website.*$/i, '').trim() : fallback;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return null;
}

export function parseCurrentPolicyRates(html, { url = RBI_SOURCE_URLS.currentRates } = {}) {
  const sectionMatch = html.match(/CURRENT\s+RATES\s+START([\s\S]*?)CURRENT\s+RATES\s+END/i);
  if (!sectionMatch) throw new SourceParseError('RBI current-rates section was not found');
  const text = stripHtml(sectionMatch[1]);
  const repoMatch = firstMatch(text, [
    /Policy\s+Repo\s+Rate\s*:?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i,
    /Policy\s+Repo\s+Rate[\s\S]{0,80}?([0-9]+(?:\.[0-9]+)?)\s*per\s*cent/i,
  ]);
  if (!repoMatch) throw new SourceParseError('RBI current-rates page has no Policy Repo Rate value');

  const values = {};
  const rowPattern = /([A-Za-z][A-Za-z ]+Rate)\s*:?\s*([0-9]+(?:\.[0-9]+)?)\s*%/gi;
  for (const match of text.matchAll(rowPattern)) values[match[1].trim()] = Number(match[2]);

  const observationMatch = text.match(/As\s+at\s+([^()]+?\d{4})/i);
  const pageTitle = sourceTitleFromHtml(html, 'RBI Current Policy Rates');
  return {
    repoRate: Number(repoMatch[1]),
    rates: values,
    observedAt: observationMatch ? parseRbiDate(observationMatch[1]) : null,
    source: {
      type: 'current-policy-rates',
      title: /^home$/i.test(pageTitle) ? 'RBI Current Policy Rates' : pageTitle,
      url,
      publishedAt: null,
    },
  };
}

function lastArchiveDateBefore(html, index) {
  const before = html.slice(0, index);
  const matches = [...before.matchAll(/<td\b[^>]*class=['"][^'"]*tableheader[^'"]*['"][^>]*>\s*<b>\s*([^<]+?)\s*<\/b>/gi)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    try {
      return parseRbiDate(matches[index][1]);
    } catch {
      // Archive sections also use tableheader for non-date titles.
    }
  }
  return null;
}

export function parsePolicyArchive(html, { url = RBI_SOURCE_URLS.policyArchive } = {}) {
  const entries = [];
  const lowerHtml = html.toLowerCase();
  const linkPattern = /<a\b[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const anchorText = stripHtml(match[2]);
    const cellStart = lowerHtml.lastIndexOf('<td', match.index);
    const cellEnd = lowerHtml.indexOf('</td>', match.index);
    const cellContext = stripHtml(html.slice(Math.max(cellStart, 0), cellEnd >= 0 ? cellEnd : match.index));
    const isResolution = /Resolution\s+of\s+the\s+Monetary\s+Policy\s+Committee/i.test(cellContext);
    const isMinutes = /Minutes\s+of\s+the\s+Monetary\s+Policy\s+Committee/i.test(`${cellContext} ${anchorText}`);
    const isFullDocument = /full\s+document/i.test(anchorText);
    if ((!isResolution && !isMinutes) || (!isFullDocument && !isMinutes)) continue;

    const publicationDate = lastArchiveDateBefore(html, match.index);
    if (!publicationDate) throw new SourceParseError(`No publication date found for RBI archive link ${match[1]}`);
    const resolvedUrl = new URL(decodeHtml(match[1]), url).href;
    const type = isResolution ? 'policy-resolution' : 'policy-minutes';
    const duplicate = entries.some(entry => entry.url === resolvedUrl);
    if (duplicate) continue;
    entries.push({
      type,
      title: type === 'policy-resolution'
        ? `Monetary Policy Committee resolution — ${publicationDate}`
        : `Monetary Policy Committee minutes — ${publicationDate}`,
      url: resolvedUrl,
      publicationDate,
    });
  }
  if (entries.length === 0) throw new SourceParseError('RBI policy archive contained no resolution or minutes links');
  return entries.sort((a, b) => a.publicationDate.localeCompare(b.publicationDate));
}

function policyDecisionText(html) {
  const text = stripHtml(html);
  const marker = text.search(/Monetary\s+Policy\s+Decisions?/i);
  return marker >= 0 ? text.slice(marker, marker + 2600) : text.slice(0, 2600);
}

function parsePolicyRate(text) {
  return firstMatch(text, [
    /policy\s+repo\s+rate[\s\S]{0,260}?\b(?:to|at)\s+([0-9]+(?:\.[0-9]+)?)\s*per\s*cent/i,
    /repo\s+rate[\s\S]{0,180}?\b(?:to|at)\s+([0-9]+(?:\.[0-9]+)?)\s*per\s*cent/i,
    /policy\s+repo\s+rate[\s\S]{0,260}?([0-9]+(?:\.[0-9]+)?)\s*%/i,
  ]);
  
}

function parseStance(text) {
  const match = firstMatch(text, [
    /(?:continue|retain|maintain)\s+(?:with\s+)?the\s+([a-z][a-z -]{2,40}?)\s+stance/i,
    /stance\s+(?:of|remains?)\s+([a-z][a-z -]{2,40}?)(?:\.|,|\s+to\s+respond)/i,
  ]);
  return match ? match[1].trim().replace(/\s+/g, ' ') : null;
}

function parseActionHint(text) {
  if (/unchanged|keep\s+the?\s+policy\s+repo\s+rate|maintain(?:ed)?\s+the?\s+policy\s+repo\s+rate/i.test(text)) return 'hold';
  if (/increase|increased|raise|raised|hike|hiked/i.test(text)) return 'hike';
  if (/reduce|reduced|cut|lower|lowered/i.test(text)) return 'cut';
  return null;
}

export function parsePolicyDocument(html, entry, { url = entry.url } = {}) {
  const text = policyDecisionText(html);
  const dateMatch = html.match(/Date\s*:\s*([^<]+)/i);
  const publicationDate = entry.publicationDate || (dateMatch ? parseRbiDate(dateMatch[1]) : null);
  if (!publicationDate) throw new SourceParseError(`RBI policy document has no publication date: ${url}`);
  const rateMatch = parsePolicyRate(text);
  const title = sourceTitleFromHtml(html, entry.title);
  const source = {
    type: entry.type,
    title,
    url,
    publishedAt: dateOnlyToTimestamp(publicationDate),
  };

  if (!rateMatch) {
    return {
      source,
      decision: null,
      text,
    };
  }

  return {
    source,
    decision: {
      date: publicationDate,
      repoRate: Number(rateMatch[1]),
      actionHint: parseActionHint(text),
      stance: parseStance(text),
      summary: text.slice(0, 520).trim(),
    },
    text,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.trim());
    if (row.some(value => value !== '')) rows.push(row);
  }
  return rows;
}

function parseNumber(value) {
  const match = String(value).replace(/,/g, '').match(/-?[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : null;
}

function findColumn(headers, pattern) {
  return headers.findIndex(header => pattern.test(String(header).toLowerCase()));
}

function rowsFromJson(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['data', 'rows', 'results', 'records', 'items', 'observations']) {
    if (Array.isArray(value[key])) return value[key];
    if (value[key] && typeof value[key] === 'object') {
      const nested = rowsFromJson(value[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

function normalizeDbieRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new SourceParseError('DBIE Key Rates export has no rows');
  const first = rows[0];
  let normalized;
  if (Array.isArray(first)) {
    const headers = first.map(value => String(value).trim());
    const dateIndex = findColumn(headers, /date|period|time/);
    const rateIndex = findColumn(headers, /repo|policy.*rate/);
    if (dateIndex < 0 || rateIndex < 0) throw new SourceParseError('DBIE CSV has no date and repo-rate columns');
    normalized = rows.slice(1).map(row => ({ date: row[dateIndex], repoRate: parseNumber(row[rateIndex]) }));
  } else {
    const keys = Object.keys(first);
    const dateKey = keys.find(key => /date|period|time/i.test(key));
    const rateKey = keys.find(key => /policy.?repo|repo.?rate|repo/i.test(key));
    if (!dateKey || !rateKey) throw new SourceParseError('DBIE JSON has no date and repo-rate fields');
    normalized = rows.map(row => ({ date: row[dateKey], repoRate: parseNumber(row[rateKey]) }));
  }

  const result = normalized
    .filter(row => row.date !== undefined && row.repoRate !== null)
    .map(row => ({ date: parseFlexibleDate(row.date), repoRate: row.repoRate }));
  if (result.length === 0) throw new SourceParseError('DBIE Key Rates export contains no usable repo-rate rows');
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

function rowsFromHtmlTable(html) {
  const rows = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const cells = [...rowMatch[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)]
      .map(cell => stripHtml(cell[1]));
    if (cells.length) rows.push(cells);
  }
  return rows;
}

export function parseDbieKeyRates(payload, { contentType = '', url = RBI_SOURCE_URLS.dbieKeyRates } = {}) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let rows;
  if (/json/i.test(contentType) || /^[\s\[{]/.test(text.trim())) {
    try {
      rows = normalizeDbieRows(rowsFromJson(JSON.parse(text)));
    } catch (error) {
      if (error instanceof SourceParseError) throw error;
      throw new SourceParseError(`DBIE JSON could not be parsed: ${error.message}`, { cause: error });
    }
  } else if (/<table\b/i.test(text)) {
    rows = normalizeDbieRows(rowsFromHtmlTable(text));
  } else {
    rows = normalizeDbieRows(parseCsv(text));
  }
  return {
    rows,
    source: {
      type: 'dbie-key-rates',
      title: 'RBI DBIE Key Rates — Policy Repo Rate',
      url,
      publishedAt: null,
    },
  };
}
