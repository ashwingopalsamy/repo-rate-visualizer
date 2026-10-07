/* /privacy: what this site measures, in plain words. Every claim here must stay true of src/analytics and worker/site. */
import { card, footerHTML, kick } from './templates.ts';

const P = (s: string) => `<p>${s}</p>`;

export function privacyHTML(): string {
  return `
  <div class="page-head"><div><h1>Privacy</h1><p data-prose>No cookies, no accounts and no personal data. Here is exactly what is counted, and how to switch it off.</p></div></div>
  <div class="row">
    ${card('counted', 'span-12', 'What is counted', 'activity',
      `${kick('activity', 'What is counted')}<p class="finding" data-prose>Two counters, both without cookies</p>`,
      `<div class="prose-block" data-prose>
        ${P('<b>Page traffic.</b> Cloudflare Web Analytics counts page views, referrers, the visitor’s country and page-load speed. It sets no cookies and does not fingerprint visitors.')}
        ${P('<b>Product events.</b> This site sends a short list of anonymous events to its own server: which page was opened, which country was switched to and how (the switcher, a link or the dock), whether the loan calculator was used, and whether a chart replay or decision-day preview was played. Loan amounts, rates and dates you type never leave your browser.')}
        ${P('<b>Daily visitor count.</b> To count unique visitors without a cookie, the server combines the day’s date, your IP address and your browser’s user agent with a secret key, and keeps only a short one-way hash of the result. The key makes the hash impossible to reverse, and the date makes it change every day, so a visitor cannot be followed from one day to the next. The IP address and user agent themselves are discarded and never stored.')}
        ${P('Requests from known crawlers and bots are dropped before anything is counted.')}
      </div>`)}
  </div>
  <div class="row">
    ${card('kept', 'span-12', 'How long it is kept', 'history',
      `${kick('history', 'How long it is kept')}<p class="finding" data-prose>Three months in detail, then daily totals only</p>`,
      `<div class="prose-block" data-prose>
        ${P('Individual events are kept for three months, then deleted automatically.')}
        ${P('Before that, they are added up into daily totals per page, event and country. Only those totals are kept longer.')}
        ${P('Nothing is sold, shared or used for advertising.')}
      </div>`)}
  </div>
  <div class="row">
    ${card('off', 'span-12', 'Switching it off', 'shield-check',
      `${kick('shield-check', 'Switching it off')}<p class="finding" data-prose>Global Privacy Control or Do Not Track turns off all counting</p>`,
      `<div class="prose-block" data-prose>
        ${P('If your browser sends Global Privacy Control or Do Not Track, this site loads no analytics script and sends no events at all. Everything else works the same.')}
        ${P('Your browser’s local storage holds three conveniences for you alone: your theme, your colour palette and the last country you viewed. They never leave your device, and the site works without them.')}
      </div>`)}
  </div>
  ${footerHTML()}`;
}

export function renderPrivacy(): void {
  document.title = 'Privacy · Policy Rate Atlas';
}
