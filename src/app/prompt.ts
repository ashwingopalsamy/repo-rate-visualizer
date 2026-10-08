/* The first-visit country prompt. The site opens on India; a visitor who has not chosen a country yet gets a small
   floating card (bottom right on desktop, above the dock on phones) with every central bank as a flag and, when the
   browser's time zone or language points at one, a one-tap suggestion. Any answer is remembered on the device, and
   / then opens on the chosen bank (the inline script in index.html). */
import { CODES, META, esc, flag, poss } from '../lib/atlas.ts';
import type { Code } from '../lib/atlas.ts';
import { guessCountry } from '../lib/locale.ts';
import { EASE, EASE_IN, reduced, store } from '../lib/motion.ts';
import { makeIcons } from '../lib/icons.ts';
import { track } from '../analytics/track.ts';
import { $, state } from './dom.ts';
import { setCountry } from './country.ts';

const DELAY_MS = 1200;
let timer: ReturnType<typeof setTimeout> | null = null;

const chosen = () => store.get('atlas-country') != null;
function suggestion(): Code | null {
  let tz: string | undefined;
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* no Intl time zone */ }
  const g = guessCountry(tz, navigator.languages ?? [navigator.language]);
  return g && g !== state.code && CODES.includes(g) ? g : null;
}

/** Shows the prompt shortly after the first paint, unless this visitor already chose a country. */
export function schedulePrompt(): void {
  if (state.ssr || chosen() || timer || document.getElementById('cprompt')) return;
  timer = setTimeout(() => { timer = null; if (state.page === 'country' && !chosen() && $('scrim').hidden) show(); }, DELAY_MS);
}

function html(s: Code | null): string {
  const cur = state.code, label = (c: Code) => `${META[c].name} · ${META[c].bank}`;
  return `
    <button type="button" class="cp-x" aria-label="Close"><i data-lucide="x"></i></button>
    <p class="kick"><i data-lucide="globe"></i><span>Your central bank</span></p>
    <h2 id="cpTitle">${s ? `Following the ${esc(META[s].bank)}?` : 'Follow another central bank?'}</h2>
    <p class="cp-sub" data-prose>${s ? `This page shows ${esc(poss(META[cur].name))} ${esc(META[cur].short)}.` : `This page shows the ${esc(META[cur].short)}.`} Pick the bank you follow and the site opens there next time.</p>
    <div class="cp-flags" role="group" aria-label="Central banks">${CODES.map(c => `<button type="button" class="cp-flag" data-c="${c}" aria-label="${esc(label(c))}"${c === cur ? ' aria-current="true"' : ''}${c === s ? ' data-suggested' : ''}>${flag(c)}</button>`).join('')}</div>
    <p class="cp-name" aria-hidden="true">${esc(label(s ?? cur))}</p>
    <div class="cp-actions">${s ? `<button type="button" class="cp-go" data-c="${s}">Switch to ${esc(META[s].name)}</button>` : ''}<button type="button" class="cp-keep">Keep ${esc(META[cur].name)}</button></div>`;
}

function show() {
  const s = suggestion(), el = document.createElement('aside');
  el.id = 'cprompt'; el.className = 'cprompt'; el.setAttribute('aria-labelledby', 'cpTitle');
  el.innerHTML = html(s);
  document.body.appendChild(el);
  makeIcons(el);
  // Flags are untitled discs; the line under them names the one under the pointer or focus.
  const name = el.querySelector<HTMLElement>('.cp-name')!, rest = name.textContent;
  const label = (b: HTMLElement | null) => { name.textContent = b ? b.getAttribute('aria-label') : rest; };
  el.addEventListener('pointerover', e => label((e.target as Element).closest<HTMLElement>('.cp-flag')));
  el.addEventListener('focusin', e => label((e.target as Element).closest<HTMLElement>('.cp-flag')));
  el.querySelector('.cp-flags')!.addEventListener('pointerleave', () => label(null));
  el.addEventListener('click', e => {
    const t = e.target as Element, pick = t.closest<HTMLElement>('.cp-flag, .cp-go');
    if (pick) answer('pick', pick.dataset.c as Code);
    else if (t.closest('.cp-keep')) answer('keep', state.code);
    else if (t.closest('.cp-x')) answer('close', state.code);
  });
  el.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); answer('close', state.code); } });
  if (!reduced()) el.animate([{ opacity: 0, transform: 'translateY(16px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: EASE });
  track('prompt', s ? { action: 'shown', cc: s } : { action: 'shown' });
}

function answer(action: 'pick' | 'keep' | 'close', cc: Code) {
  const from = state.code;
  if (action === 'pick' && cc !== from) setCountry(cc, { via: 'prompt' });
  else store.set('atlas-country', from);
  track('prompt', { action, cc });
  closePrompt();
}

/** Removes the prompt (with its exit motion) and cancels one that has not appeared yet. */
export function closePrompt(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  const el = document.getElementById('cprompt'); if (!el) return;
  el.id = ''; el.setAttribute('aria-hidden', 'true'); el.style.pointerEvents = 'none';
  if (reduced()) { el.remove(); return; }
  el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(12px) scale(.98)' }], { duration: 200, easing: EASE_IN, fill: 'forwards' }).onfinish = () => el.remove();
}
