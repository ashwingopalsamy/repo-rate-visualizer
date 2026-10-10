/* Page skeletons shared by the client and the prerenderer. Content is filled by the page modules. */
import { CODES, GENERATED, fmtD } from '../lib/atlas.ts';

export const card = (id: string, span: string, name: string, icon: string, head: string, body: string, foot = '') => `
  <section class="card ${span}" id="${id}" data-name="${name}" data-icon="${icon}">
    <div class="card-head">${head}</div>
    <div class="card-body">${body}</div>${foot ? `<div class="card-foot" data-prose>${foot}</div>` : ''}
  </section>`;
export const kick = (icon: string, text: string, id = '') => `<p class="kick"><i data-lucide="${icon}"></i><span${id ? ` id="${id}"` : ''}>${text}</span></p>`;

export function footerHTML(): string {
  return `<footer class="site-foot" data-prose>
    <div><b>Policy Rate Atlas</b><p>Policy rates for ${CODES.length} central banks, checked against each bank’s own releases. Every finding is computed from the record on the page. Nothing here is a forecast.</p></div>
    <div><b>Sources</b><p>RBI resolutions and press releases, Federal Reserve statements and FRED, the ECB Data Portal, the Bank of England database, Bank of Canada Valet, RBA table F1 and BCB series 432.</p></div>
    <div><b>Data</b><p>As of ${fmtD(GENERATED, 'GB')}. Every release is content-addressed and published as open JSON at <a href="/api/v1/countries.json">/api/v1</a>. <a href="/privacy/">Privacy</a>: no cookies, no personal data. <a href="/design/">Design system</a>.</p></div>
  </footer>`;
}
