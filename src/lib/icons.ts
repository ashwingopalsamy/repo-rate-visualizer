/* Lucide icons used on the site, imported one by one so the bundle carries only these. */
import {
  createIcons, Activity, ArrowDownUp, ArrowLeftRight, ArrowRight, ArrowUpRight, CalendarClock, ChartLine, ChevronsUpDown, Gauge, Globe,
  History, Landmark, ListOrdered, Moon, PanelLeft, Palette, Play, Repeat, Route, ShieldCheck, Square, Sun, Table2, Type, Wallet, X,
} from 'lucide';

const ICONS = { Activity, ArrowDownUp, ArrowLeftRight, ArrowRight, ArrowUpRight, CalendarClock, ChartLine, ChevronsUpDown, Gauge, Globe, History, Landmark, ListOrdered, Moon, PanelLeft, Palette, Play, Repeat, Route, ShieldCheck, Square, Sun, Table2, Type, Wallet, X };

/** Replaces every <i data-lucide="name"> with its SVG. Created SVGs drop the attribute so a later call never redraws them. */
export function makeIcons(root: ParentNode = document): void {
  if (!root.querySelector('i[data-lucide]')) return;
  createIcons({ icons: ICONS, nameAttr: 'data-lucide', root: root as Element });
  root.querySelectorAll('svg[data-lucide]').forEach(n => n.removeAttribute('data-lucide'));
}
