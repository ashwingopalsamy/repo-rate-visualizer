/* A local guess at the visitor's central bank, from the browser's time zone and languages. Computed on the device and
   never sent anywhere; it only chooses which bank the country prompt suggests. */
import type { Code } from './types.ts';

/** Euro area members (21 from 1 Jan 2026, when Bulgaria joined). */
const EURO = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES']);
const EURO_ZONES = /^(Europe\/(Vienna|Brussels|Sofia|Zagreb|Nicosia|Tallinn|Helsinki|Mariehamn|Paris|Berlin|Busingen|Athens|Dublin|Rome|Riga|Vilnius|Luxembourg|Malta|Amsterdam|Lisbon|Bratislava|Ljubljana|Madrid)|Asia\/(Nicosia|Famagusta)|Atlantic\/(Canary|Madeira|Azores)|Africa\/Ceuta)$/;
const ZONES: [RegExp, Code][] = [
  [/^Asia\/(Kolkata|Calcutta)$/, 'IN'],
  [/^Europe\/(London|Belfast)$/, 'GB'],
  [/^America\/(Sao_Paulo|Bahia|Fortaleza|Recife|Maceio|Belem|Araguaina|Santarem|Manaus|Boa_Vista|Porto_Velho|Rio_Branco|Eirunepe|Cuiaba|Campo_Grande|Noronha)$/, 'BR'],
  [/^Australia\//, 'AU'],
  [/^America\/(Toronto|Montreal|Vancouver|Edmonton|Calgary|Winnipeg|Regina|Swift_Current|Halifax|Glace_Bay|Moncton|Goose_Bay|St_Johns|Whitehorse|Dawson|Dawson_Creek|Fort_Nelson|Creston|Yellowknife|Inuvik|Cambridge_Bay|Rankin_Inlet|Resolute|Iqaluit|Atikokan|Blanc-Sablon)$/, 'CA'],
  [/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak|Boise|Detroit|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu)$/, 'US'],
  [EURO_ZONES, 'EA'],
];
const REGIONS: Record<string, Code> = { IN: 'IN', US: 'US', GB: 'GB', CA: 'CA', AU: 'AU', BR: 'BR' };
const INDIAN_LANGUAGES = new Set(['hi', 'mr', 'ta', 'te', 'kn', 'ml', 'gu']);

export function guessCountry(timeZone: string | undefined, languages: readonly string[]): Code | null {
  if (timeZone) for (const [rx, cc] of ZONES) if (rx.test(timeZone)) return cc;
  for (const tag of languages) {
    const [lang, ...rest] = tag.split('-'), region = rest.find(p => /^[A-Za-z]{2}$/.test(p))?.toUpperCase();
    if (region && REGIONS[region]) return REGIONS[region];
    if (region && EURO.has(region)) return 'EA';
    if (!region && INDIAN_LANGUAGES.has(lang.toLowerCase())) return 'IN';
  }
  return null;
}
