# RBI Repo Rate Visualizer — design constitution

## Intent

This is a source-led public policy chartbook for journalists, researchers, students,
analysts, developers, and curious readers. The first question is always “what is the
repo rate now?” The second is “which official decisions produced this history?”

The interface should feel like a carefully typeset RBI policy register: calm, exact,
neutral, and quietly technical. It borrows the compositional discipline of the
`emailcn` reference and uses the actual shadcn/ui New York foundation without copying
the reference code or turning this into a generic SaaS dashboard.

## Domain language

- Current repo rate
- Effective date
- Official decision
- Cut, hike, or hold
- Basis-point change
- Stance
- RBI bulletin / policy statement
- Source publication date
- Retrieval check
- Decision spine

## Visual direction

- Dominant surfaces are paper white or graphite-neutral.
- A single focal current-rate value leads each view.
- One focal overview leads into one chart workspace; the ledger and sources remain
  open, ruled sections rather than a stack of nested cards.
- Source provenance is visible, compact, and never treated as decoration.
- Semantic color is reserved for cuts, hikes, holds, focus, and explicit status.
- Rounded shadcn surfaces and hairline separators carry structure; only drawers,
  dialogs, and popovers may use a quiet shadow.
- No glass, blur, gradients, fake live pulses, or entrance-stagger animation.

## System

- Base spacing unit: 4px.
- Component rhythm: 8px, 12px, 16px, 24px, 32px.
- shadcn base radius: `0.625rem`, with derived `sm`, `md`, `lg`, and `xl` scales.
- Controls use rounded-md; grouped controls use rounded-lg; cards and drawers use
  rounded-xl. Full pills are reserved for compact semantic badges and dots.
- Geist is the interface and current-rate face. Geist Mono is restricted to
  checksums, snapshot IDs, and data labels where alignment earns its use. Inter is
  available for reference-compatible reading content.
- Body text: 14–15px with a restrained 1.5 line-height.
- Labels/meta: 11–12px, medium weight, tracked when uppercase.
- Headings: weight and color create hierarchy before size does.
- Rates, dates, basis points, checksums, and IDs use tabular numerals without making
  the hero rate look like code.
- Interactive targets are at least 40px, with 44px touch targets where needed.

## Component contracts

- `Button`: `default`, `outline`, `secondary`, `ghost`, and `link` variants;
  `sm`, `default`, `lg`, and `icon` sizes.
- `Badge`: `cut`, `hike`, `hold`, `neutral`, and `source` variants.
- `Tabs`: controlled `value`/`onValueChange`, keyboard navigation, and URL state
  remains owned by the application.
- `CommandDialog`: commands expose `id`, `label`, `group`, optional `shortcut`,
  and `execute` behavior.
- `Card`: header, content, and footer slots own padding and surface rhythm.
- `Drawer`: the mobile command surface owns view, range, layer, theme, share, and
  export actions; opening it replaces the fixed four-tab dock.
- `Table`, `Input`, `Select`, `ToggleGroup`, `DropdownMenu`, `Tooltip`, and
  `Separator` are generated shadcn primitives rather than bespoke control shells.

## Responsive contract

The app renders one React tree at every width. Desktop uses a centered chartbook
workspace. Mobile uses normal page flow, compact toolbar controls, readable ledger
rows, and one header menu that opens a rounded, focus-trapped Drawer. There is no
fixed bottom dock and no layout choice is made once from `window.innerWidth`.

## Evidence contract

The latest official decision, latest source publication, and last successful check
are separate facts. Every decision marker and ledger row must be source-backed,
including holds. The interface never invents calendar-month decisions.

## V4 visual reset — rounded shadcn policy register

The page uses an open policy-register canvas with two focal bounded surfaces:
`SnapshotBand` and `ChartWorkspace`. Ledger rows and evidence rows remain open,
ruled by hairlines rather than wrapped in cards. No content surface may contain a
second card surface.

- The snapshot is the first-viewport focal point: `5.25` is a calm Geist display
  value with a separately optically sized `%`, comfortable tracking, and no mono
  styling. The label is sentence case: `Repo rate`.
- The latest official decision defines the current trend: cut/easing is green,
  hold/steady is blue, hike/tightening is red, and initial records are blue.
  Semantic backgrounds stay faint; text, dots, markers, and focus states carry the
  signal.
- Rounded controls use full or large radii; the snapshot and workspace use a
  large consistent radius; rows stay open. Only overlays, drawers, dialogs, and
  popovers receive elevation.
- The workspace owns the one canonical decision spine. Selecting a chart marker
  highlights the matching row; selecting a row focuses the matching marker. The
  selected record exposes its official source without relying on hover.
- The visual rhythm is 4px-based but intentionally uneven: compact control bands,
  generous section breaks, and dense register rows. Color, borders, and motion
  remain restrained so the RBI source trail stays primary.

## Calm analytical workspace — current redesign

The rounded V4 surface model is superseded by a flatter analytical workspace. The
page is a single policy register: an open current-rate summary, one hairline-bounded
repo-rate explorer, one canonical decision spine, and a compact evidence disclosure.
Large rounded page cards, repeated source metadata, and pill-shaped control groups
are not part of this direction.

- The current-rate summary answers rate, effective date, latest decision, source,
  and verification status without repeating the same source facts in the footer.
- Timeline, rate changes, and cycles are local analytical views inside one workspace;
  the URL remains the shareable source of truth for the active view and range.
- The default timeline is the effective repo-rate line plus every official decision
  marker, regime bands, and macro-event context. The Layers menu keeps both context
  layers removable without changing the URL contract.
- The decision spine is the product signature: a selected marker, selected row, and
  official source action refer to the same decision record.
- Chart readouts are compact, collision-aware, and shared across visualizations.
  They show only date, value, change, and one useful context line; provenance stays
  in the source trail.
- PNG is the primary chart image export. SVG remains a secondary format only when
  the cleaned, computed-style clone serializes successfully.
- Controls use semantic default, hover, active, selected, focus, and disabled tokens.
  Borders provide structure; popovers and dialogs are the only elevated surfaces.
- The implementation keeps React, Vite, D3, shadcn primitives, the existing URL
  contract, and the source-backed snapshot/data pipeline unchanged.

## Calm workspace refinement — current control and evidence system

- The chart controls live in one bounded rail with explicit View, Range, and Actions
  zones. Desktop uses a single grid row; tablet and mobile use intentional semantic
  rows rather than flex-wrap side effects.
- View and range choices use quiet line-style shadcn Tabs. Custom ranges display a
  compact year label while the complete dates remain available to assistive
  technology and in the transactional Popover.
- Layers is always discoverable, starts with regime bands and macro events enabled,
  and uses checkbox menu rows on desktop and mobile rather than pill toggles.
- Data & evidence is one dataset masthead with counts, coverage, latest publication,
  and CSV access. Source records use a bounded identity/publication/linked/integrity
  grid; checksum and retrieval details live in anchored integrity popovers.
