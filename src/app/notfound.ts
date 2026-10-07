/* The not-found page: every address the site does not know lands here, with a way to every country. */
import { CODES, META, MODEL, flag, stanceOfPlay, vShort } from '../lib/atlas.ts';
import { pathFor } from './dom.ts';
import { card, footerHTML, kick } from './templates.ts';

export function notFoundHTML(): string {
  return `
  <div class="page-head"><div><h1>Page not found</h1><p data-prose>Nothing lives at this address. Every central bank on the site is below, or open the <a href="/" data-link>world view</a>.</p></div></div>
  <div class="row">
    ${card('banks', 'span-12', 'Every central bank', 'globe',
      `${kick('globe', `All ${CODES.length} central banks`)}<p class="finding" data-prose>Pick a country to see its policy rate</p>`,
      `<div class="list" data-prose>${CODES.map(c => `<a class="item link" data-c="${c}" href="${pathFor(c)}" data-link>${flag(c)}<span class="title">${META[c].name}</span><span class="fig">${vShort(MODEL[c].last)}</span><span class="sub">${META[c].bank} · ${stanceOfPlay(c).txt}</span></a>`).join('')}</div>`)}
  </div>
  ${footerHTML()}`;
}
export function renderNotFound(): void { document.title = 'Page not found · Policy Rate Atlas'; }
