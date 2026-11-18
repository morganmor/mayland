---
name: "Mayland"
description: "Mobile-first personal AI workbench uniting calm nocturnal reading with live parameter transparency and encrypted local key hygiene."
colors:
  terracotta-accent: "oklch(67% 0.145 36)"
  terracotta-glow: "oklch(71% 0.15 36)"
  terracotta-wash: "oklch(28% 0.055 36)"
  espresso-on-accent: "oklch(15% 0.012 36)"
  periwinkle-thought: "oklch(76% 0.115 255)"
  periwinkle-wash: "oklch(24% 0.042 255)"
  sage-success: "oklch(73% 0.125 152)"
  sage-wash: "oklch(24% 0.045 152)"
  ochre-warn: "oklch(79% 0.135 80)"
  cinnabar-danger: "oklch(67% 0.165 25)"
  cinnabar-wash: "oklch(25% 0.065 25)"
  amber-focus: "oklch(75% 0.14 42)"
  charcoal-paper: "oklch(14% 0.002 65)"
  stone-clay: "oklch(18.5% 0.003 65)"
  kiln-slate: "oklch(23% 0.003 65)"
  ash-clay: "oklch(28.5% 0.004 65)"
  obsidian-scrim: "oklch(8% 0.002 65 / 0.72)"
  hairline-rule: "oklch(31% 0.004 65)"
  soft-rule: "oklch(25.5% 0.003 65)"
  porcelain-ink: "oklch(94.5% 0.004 75)"
  parchment-ink: "oklch(78% 0.005 65)"
  warm-stone-muted: "oklch(61% 0.005 65)"
typography:
  display:
    fontFamily: "'Spectral', Georgia, serif"
    fontSize: "clamp(1.55rem, 4.8vw, 2.15rem)"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "'Geist Variable', system-ui, -apple-system, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 600
    lineHeight: 1.28
    letterSpacing: "-0.02em"
  title:
    fontFamily: "'Geist Variable', system-ui, -apple-system, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "'Spectral', Georgia, serif"
    fontSize: "1.03rem"
    fontWeight: 400
    lineHeight: 1.66
    letterSpacing: "normal"
  label:
    fontFamily: "'Geist Variable', system-ui, -apple-system, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "0.83rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
rounded:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "14px"
  xl: "16px"
  composer: "18px"
  modal: "16px"
  pill: "999px"
spacing:
  2xs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "22px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta-accent}"
    textColor: "{colors.espresso-on-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-glow}"
  button-tonal:
    backgroundColor: "{colors.stone-clay}"
    textColor: "{colors.porcelain-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "40px"
  button-tonal-hover:
    backgroundColor: "{colors.kiln-slate}"
  button-ghost-icon:
    backgroundColor: "transparent"
    textColor: "{colors.parchment-ink}"
    rounded: "{rounded.pill}"
    width: "44px"
    height: "44px"
  topbar-nav:
    backgroundColor: "{colors.charcoal-paper}"
    textColor: "{colors.porcelain-ink}"
    typography: "{typography.title}"
    padding: "8px 12px"
  composer-dock:
    backgroundColor: "{colors.stone-clay}"
    textColor: "{colors.porcelain-ink}"
    rounded: "{rounded.composer}"
    padding: "12px 12px 10px 16px"
  chip-starter:
    backgroundColor: "{colors.stone-clay}"
    textColor: "{colors.porcelain-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
    height: "44px"
  card-thoughts:
    backgroundColor: "{colors.stone-clay}"
    textColor: "{colors.porcelain-ink}"
    rounded: "{rounded.lg}"
    padding: "10px 14px"
  card-settings:
    backgroundColor: "{colors.kiln-slate}"
    textColor: "{colors.porcelain-ink}"
    rounded: "{rounded.xl}"
    padding: "14px 16px"
  maybot-live-dock:
    backgroundColor: "{colors.stone-clay}"
    textColor: "{colors.porcelain-ink}"
    rounded: "{rounded.pill}"
    padding: "8px 14px 8px 10px"
---

# Design System: Mayland

## Overview

**Creative North Star: "Nocturnal Ceramic & Fieldbook Desk"**

Mayland is a mobile-first personal AI workbench built to feel like an unhurried evening desk rather than a rigid developer console. It joins the calm editorial reading surface and floating thumb-reach composer of a modern mobile chat client with live parameter transparency: tabular token counters, expandable reasoning traces, a right-edge turn timeline rail, and a slide-over Run Settings drawer.

The built world trades crisp boxed button grids and hairline chrome for stacked warm-clay tonal layers, generous negative space, and pill silhouettes softened by continuous exponential and spring physics. Where early surface-brief hex approximations served as conceptual anchors (`#151413` ground, `#E07855` accent, `#8AB4F8` thought), the shipped CSS token layer resolves the entire palette in perceptual OKLCH across three live-switchable themes—Clay Dark (default), Obsidian, and Daylight—while Maybot, an animated SVG chibi companion, turns cryptographic decryption, connection handshakes, and token streaming into tactile, readable feedback.

**Key Characteristics:**
- Warm charcoal-ceramic base ground paired with four stepped tonal surfaces instead of structural borders.
- Single warm terracotta primary accent reserved for primary actions and active selections, balanced by a cool periwinkle secondary reserved exclusively for reasoning and thinking depth.
- Editorial reading serif (`Spectral`) for model prose and empty-state greetings paired with crisp geometric UI sans (`Geist Variable`) and tabular monospace (`JetBrains Mono`) for telemetry, code, and encrypted key metadata.
- Unboxed `999px` ghost and tonal pill controls with tactile scale feedback, native/Web Vibration haptics, and `prefers-reduced-motion` safety.
- Portrait-first `100dvh` mobile shell anchored by a top gradient bar, internal scrolling canvas with right-edge jump rail, and floating bottom composer.

## Colors

The normative palette in `src/styles/tokens.css` uses perceptual OKLCH values anchored in Clay Dark (`:root, [data-theme='dark']`) with warm stone undertones (`hue 55–75`), paired with an intense terracotta primary and cool periwinkle thinking accent.

### Primary
- **Terracotta Accent** (`oklch(67% 0.145 36)`, `--color-accent`): Primary CTAs (`Run`, `New chat`, `Encrypt & Save`, `Apply`, `Save Endpoint`), active toggle switches, active timeline marker, caret color, prose links, blockquote left stroke, and warm upper-right ambient radial glow (`9%` mix).
- **Terracotta Glow** (`oklch(71% 0.15 36)`, `--color-accent-hover`): Hover state for primary accent pill buttons, shifting lightness upward without hue drift.
- **Terracotta Wash** (`oklch(28% 0.055 36)`, `--color-accent-soft`): Soft tinted fill for active JSON mode pills, selected model/provider/theme choices, active feedback vote buttons, and text selection background.
- **Espresso on Accent** (`oklch(15% 0.012 36)`, `--color-accent-ink`): High-contrast dark ink set inside solid terracotta primary buttons and active toggle switch knobs.

### Secondary
- **Periwinkle Thought** (`oklch(76% 0.115 255)`, `--color-thought`): Dedicated reasoning signal for the `Thoughts` sparkles icon, active `EffortSlider` track/thumb (`low` through `high`), thinking effort badge text, Maybot thinking antenna/orbiting sparks, and lower-left ambient radial glow (`6%` mix).
- **Periwinkle Wash** (`oklch(24% 0.042 255)`, `--color-thought-soft`): Tinted pill surface when thinking effort is active on the composer bar or inside the `EffortSlider` status badge.

### Tertiary
- **Amber Focus** (`oklch(75% 0.14 42)`, `--color-focus`): Universal `2px` `:focus-visible` keyboard focus outline and `.drawer-field:focus` ring.
- **Sage Success** (`oklch(73% 0.125 152)`, `--color-success`): Active unlocked API key vault icon, copied confirmation checks, crypto self-test readout, and Maybot `decrypting` state.
- **Sage Wash** (`oklch(24% 0.045 152)`, `--color-success-soft`): Soft container background for AES-256 encrypted status badges and Maybot's decryption lock halo.
- **Ochre Warn** (`oklch(79% 0.135 80)`, `--color-warn`): Locked-vault indicator icon and missing-API-key provider warning in the top bar subtitle.
- **Cinnabar Danger** (`oklch(67% 0.165 25)`, `--color-danger`): Destructive actions (`Clear conversation`, `Remove key`, `Delete` endpoint), request error icons, PIN error copy, and Maybot `error` expression.
- **Cinnabar Wash** (`oklch(25% 0.065 25)`, `--color-danger-soft`): Surface container for failed assistant response error cards and error-tone floating toasts.

### Neutral
- **Charcoal Paper** (`oklch(16.5% 0.008 55)`, `--color-paper`): Root application canvas, top/bottom gradient edge fades, PIN unlock backdrop, and Maybot's recessed visor faceplate.
- **Stone Clay** (`oklch(20.5% 0.009 55)`, `--color-paper-2`): First elevated surface step used for the floating composer card, user chat bubbles, collapsible `Thoughts` shell, code block body, live Maybot dock, drawers, bottom sheets, and drawer input wells.
- **Kiln Slate** (`oklch(25% 0.011 55)`, `--color-paper-3`): Second elevated surface step used for drawer section cards, code block headers, inline code pills, floating scroll-to-bottom button, toast pills, overflow menu, inactive tonal buttons, and active list rows.
- **Ash Clay** (`oklch(30.5% 0.012 55)`, `--color-paper-4`): Highest neutral control step for scrollbar thumbs, bottom sheet drag grabbers, inactive toggle switch tracks, and `Off` effort track fill.
- **Obsidian Scrim** (`oklch(11% 0.006 55 / 0.68)`, `--color-scrim`): Translucent modal backdrop paired with `backdrop-filter: blur(4px)` behind drawers and bottom sheets.
- **Hairline Rule** (`oklch(28.5% 0.009 55)`, `--color-rule`): Defined structural border token reserved for rare hard dividers.
- **Soft Rule** (`oklch(24% 0.008 55)`, `--color-rule-soft`): Subtle horizontal divider beneath Markdown table cells and vertical track line in the right-edge turn timeline rail.
- **Porcelain Ink** (`oklch(93.5% 0.008 75)`, `--color-ink`): Primary readable text for conversation titles, prose paragraphs, headings, button labels, and Maybot's primary vector outlines.
- **Parchment Ink** (`oklch(77% 0.010 65)`, `--color-ink-2`): Secondary text for timestamps, drawer labels, blockquotes, reasoning body copy, ghost icons, and active-card secondary copy.
- **Warm Stone Muted** (`oklch(61.5% 0.010 60)`, `--color-muted`): Low-emphasis metadata, input placeholders, footer token/status hints, disclaimer copy, and inactive timeline dots.

### Theme Variants
- **Clay Dark (`dark`, default)**: Uses the normative values above (`#151413` native status bar and PWA `theme_color`).
- **Obsidian (`[data-theme='obsidian']`)**: Deepens the base ground to `oklch(14% 0.005 50)` (`#121211` native status bar) with elevated steps `oklch(18% 0.007 50)`, `oklch(22.5% 0.009 50)`, `oklch(28% 0.010 50)` and inks `oklch(92.5% 0.007 72)` / `oklch(74% 0.009 62)` / `oklch(59% 0.009 58)`, shifting terracotta slightly warmer (`hue 34`).
- **Daylight (`[data-theme='light']`)**: Flips polarity to warm archival paper `oklch(96.5% 0.010 75)` (`#F6F3EE` native status bar) with stepped stone containers `oklch(93.5% 0.012 75)`, `oklch(89.5% 0.014 75)`, `oklch(85% 0.014 75)`, deep sepia ink `oklch(19% 0.012 55)`, higher-chroma terracotta `oklch(56% 0.155 34)` with pale ink `oklch(97.5% 0.006 75)`, and deeper periwinkle `oklch(51% 0.148 258)`.

### Named Rules
**The Tonal Layering Rule.** Convey container hierarchy by stepping between `--color-paper`, `--color-paper-2`, `--color-paper-3`, and `--color-paper-4` rather than drawing bordered rectangles around controls.

**The Semantic Polarity Rule.** Reserve Terracotta (`--color-accent`) for user actions, primary confirmations, and `xhigh` maximum effort; reserve Periwinkle (`--color-thought`) strictly for reasoning traces and active `low`–`high` thinking depth so cognitive state reads at a glance.

**The Ambient Restraint Rule.** Keep background atmosphere nearly imperceptible (`9%` accent upper-right and `6%` thought lower-left radial mixes in `.app-ambient-glow`) so long-form dark reading never fights luminous gradients.

## Typography

**Display Font:** `'Spectral', Georgia, serif` (bundled weights 400, 500, 600 via `@fontsource/spectral`)
**Body Font:** `'Spectral', Georgia, serif` (default editorial reading mode) or `'Geist Variable', system-ui, -apple-system, sans-serif` (optional Clean Sans mode)
**UI & Heading Font:** `'Geist Variable', system-ui, -apple-system, sans-serif` (bundled variable font via `@fontsource-variable/geist`)
**Label/Mono Font:** `'JetBrains Mono', ui-monospace, monospace` (bundled weights 400, 500 via `@fontsource/jetbrains-mono`)

**Character:** Mayland pairs the calm literary warmth of `Spectral` for welcoming display moments and long-form model answers with `Geist Variable`'s calibrated intermediate weights (`540`, `550`, `560`, `650`) across chrome and `JetBrains Mono` for transparent technical telemetry.

### Hierarchy
- **Display** (500 weight, `clamp(1.55rem, 4.8vw, 2.15rem)`, `1.22` line-height, `-0.02em` tracking): `Spectral` centered empty-stage prompt (`max-width: 18ch`) and `1.55rem` weight 600 PIN lock screen heading.
- **Headline** (600 weight, `1.35rem`, `1.28` line-height, `-0.02em` tracking): `Geist Variable` top-level headings inside rendered Markdown (`h1`, stepping to `1.18rem` for `h2` and `1.05rem` for `h3`) plus `1.18rem` `Spectral` for the `MaylandLogo` wordmark.
- **Title** (550 weight, `1.02rem`–`1.05rem`, `1.3` line-height, `-0.015em` tracking): `Geist Variable` conversation header title (`.topbar-title-text`) and drawer/sheet headers (`.drawer-title`).
- **Body** (400 weight, `1.03rem`, `1.66` line-height, `68ch` max measure): `Spectral` editorial assistant prose (`data-prose-font='editorial'`); switches to `Geist Variable` at `0.99rem` in Clean Sans mode (`data-prose-font='clean'`), `0.98rem` (`1.55` line-height) in `.user-bubble`, and `1rem` (`1.48` line-height) inside `.composer-textarea`.
- **Label** (500–550 weight, `0.72rem`–`0.9rem`, `1.25` line-height): `Geist Variable` pill labels (`0.8rem` toggles, `0.875rem` tonal pills, `0.9rem` weight `600` primary pills), `0.78rem` drawer labels, and `0.74rem`–`0.78rem` metadata subtitles.
- **Mono** (400–500 weight, `0.73rem`–`0.84rem`, `1.55` line-height): `JetBrains Mono` fenced code blocks (`0.83rem`), inline code pills (`0.84em`), model slugs, base URLs, and cryptographic envelope readouts (`0.74rem`).

### Named Rules
**The Reading-UI Split Rule.** Assistant prose defaults to `Spectral` (`--font-reading`) for sustained mobile reading while Markdown headings (`h1`–`h4`), tables, controls, and metadata stay in `Geist Variable` (`--font-ui`) so structural hierarchy never blurs into prose.

**The Tabular Telemetry Rule.** Apply `.tabular-nums` (`font-variant-numeric: tabular-nums`) to every changing numeric readout—token counts, timestamps, `tok/s` streaming rates, and Run Settings slider values—to prevent horizontal jitter during live updates.

## Layout

Mayland runs inside a full-bleed `100dvh` vertical flex shell (`.app-shell`, `overflow: hidden`) designed portrait-first for one-handed smartphone ergonomics with keyboard resize compatibility (`interactive-widget=resizes-content`) and Capacitor safe-area padding (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`).

- **Spatial Cadence & Column Geometry:** Both the scrollable chat stream (`.chat-column`) and floating composer (`.composer-inner`) lock to `max-width: 720px` centered inside the viewport. Conversation turns stack with a `22px` (`xl`) vertical gap; turn elements nest at `8px` (`sm`) and composer inner gaps at `7px`–`8px`.
- **Responsive Viewport Breakpoint (`720px`):** Below `720px`, `.chat-scroll` uses asymmetric horizontal padding (`8px 26px 28px 16px`), deliberately reserving `26px` on the right margin so the floating `TurnTimelineRail` clears prose and code blocks. At `@media (min-width: 720px)`, padding expands symmetrically to `16px 40px 36px`.
- **Overlay Geometry:** Slide-over drawers (`.drawer-panel`, left History Vault and right Run Settings) clamp to `width: min(90vw, 390px)` with `16px` scroll gutters and `14px` section spacing. Centered modal panels (`.center-modal`, Provider Vault, Model Picker, Attachments, Get Code) float inside `.center-modal-wrap` up to `width: min(94vw, 560px)` and `max-height: min(86dvh, 740px)`, with `16px` restrained corners and persistent docked `.modal-footer-bar` actions pinned outside `.sheet-scroll`.
- **Z-Index Ladder:** `--z-base: 1` (viewport) -> `--z-rail: 15` (turn timeline) -> `--z-sticky: 25` (top bar, scroll-to-bottom pill, live Maybot dock) -> `--z-composer: 30` (bottom dock) -> `--z-scrim: 45` (blur backdrop) -> `--z-drawer: 55` (side drawers) -> `--z-sheet: 65` (centered modal panels) -> `--z-toast: 80` (top toast stack).

## Elevation & Depth

Mayland relies primarily on tonal stepping across flat surfaces rather than structural drop shadows. Rested cards, user bubbles, collapsible thoughts panels, code shells, and drawer cards sit flush on stepped paper tones with zero border strokes, while `--shadow-float` and `--shadow-pill` appear exclusively on layers detached above the reading canvas.

### Shadow Vocabulary
- **Floating Surface (`--shadow-float`)** (`box-shadow: 0 12px 32px oklch(8% 0.008 55 / 0.46), 0 2px 8px oklch(8% 0.008 55 / 0.32)`): Dual-layer diffuse ambient + tight contact shadow used on the floating `.composer-card`, slide-over `.drawer-panel`, `.center-modal`, `.toast-pill`, and top bar overflow menu.
- **Floating Pill (`--shadow-pill`)** (`box-shadow: 0 6px 18px oklch(8% 0.008 55 / 0.38)`): Compact elevation shadow reserved for detached floating capsules: `.scroll-bottom-btn`, `.maybot-live-dock`, Maybot's hover speech pill, and the `EffortSlider` thumb (augmented on drag by a `6px` `24%` `--color-thought` translucent halo).
- **Scrim Backdrop (`.scrim-backdrop`)**: Dark translucent veil (`--color-scrim`) combined with `backdrop-filter: blur(4px)` to separate drawers and sheets from the underlying chat thread.

### Named Rules
**The Step-Before-Shadow Rule.** Use `--color-paper-2` and `--color-paper-3` background shifts to group inline content; apply `--shadow-float` or `--shadow-pill` only to elements that genuinely float over scrolling text or modal scrims.

**The No-Boxed-Borders Rule.** Interactive controls, composer containers, and cards omit perimeter `1px` borders; only prose `blockquote` (`1px solid var(--color-accent)` left accent line) and Markdown table rows (`1px solid var(--color-rule-soft)` bottom separator) use thin rules.

## Shapes

The shape system expresses soft ceramic pebbles and rounded fieldbook tabs, completely avoiding `0px` right-angle containers and stiff square icon tiles.

- **True Capsules (`999px`):** All primary buttons, tonal buttons, circular icon triggers, starter prompt pills, status badges, composer quick toggles, scroll-to-bottom pill, live Maybot dock, toggle switch tracks/knobs, and sheet grabbers use full `999px` pill rounding.
- **Graduated Container Radii:** Form inputs and compact title plates use `10px` (`.drawer-field`, `.topbar-title-input`); thoughts accordions, code shells, and grouped settings cards use `12px` (`.thoughts-shell`, `.code-block-shell`, `.drawer-section-card`); inline error banners and toast pills use `14px` (`.error-inline-card`, `.toast-pill`); slide-over drawers (`16px 0 0 16px` / `0 16px 16px 0`) and centered modals (`.center-modal`) use a restrained `16px`; and the outer floating `.composer-card` uses `18px`. Inline code chips and attachment thumbnails tighten to `6px`.
- **Directional Speech Tail:** User messages (`.user-bubble`) use asymmetric corner radii (`16px 16px 4px 16px`) to anchor right-aligned prompts visually toward the user edge while keeping assistant prose unboxed and full-width.

## Components

Every interactive surface favors generous touch targets (`44px` minimum on primary icon/starter controls), tactile scale press feedback (`0.90`–`0.97` via CSS `:active` and Motion `whileTap`), and crisp `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) micro-transitions (`120ms`–`340ms`).

### Buttons
- **Shape:** Full capsule (`999px`) across every button variant; never square or sharp-cornered.
- **Primary (`button-primary`, `.accent-pill-btn`):** Solid Terracotta Accent (`--color-accent`) with Espresso on Accent (`--color-accent-ink`), `42px` minimum height, `0 18px` padding, `0.9rem` weight `600`. Used for `Run`, `New chat`, `Encrypt & Save`, `Apply`, `Save Endpoint`, and `Unlock Vault`.
- **Hover / Focus:** Primary shifts to Terracotta Glow (`--color-accent-hover`) on hover, scales to `0.95` on press, switches to opaque `--color-paper-3` fill with `--color-muted` ink when disabled, and displays a `2px` `--color-focus` outline (`2px` offset) on `:focus-visible`.
- **Tonal (`button-tonal`, `.tonal-pill-btn` & `.tonal-circle-btn`):** Stone Clay (`--color-paper-2`) or Kiln Slate (`--color-paper-3`) fill with Porcelain Ink (`--color-ink`), `40px` minimum pill height (`0 14px` padding) or `44px × 44px` circle; shifts one paper step lighter on hover and scales `0.96` (`0.92` circle) on active press.
- **Ghost Icon (`button-ghost-icon`, `.ghost-icon-btn` & `.turn-action-btn`):** Transparent at rest with `44px × 44px` minimum hit target on both header ghost icons and turn action bars, revealing `--color-paper-2` pill hover fill and `scale(0.92)` tap compression. Selected feedback actions toggle to `--color-accent-soft` fill with `--color-accent` ink.

### Chips
- **Style:** Starter prompts (`.starter-pill`) use `--color-paper-2` capsules (`44px` height, `8px 16px` padding, `0.875rem`) that lift `-1px` on hover and shift to `--color-paper-3`; inline attachments (`.composer-att-chip`) compact to `--color-paper-3` (`5px 10px` padding, `0.8rem`).
- **State:** Status indicators (`.soft-badge`, `4px 10px` padding, `0.75rem`, weight `500`) default to `--color-paper-3` and switch via `data-tone` to `accent` (`--color-accent-soft` / `--color-accent`), `thought` (`--color-thought-soft` / `--color-thought`), or `success` (`--color-success-soft` / `--color-success`).

### Cards / Containers
- **Corner Style:** `12px` (`.thoughts-shell`, `.code-block-shell`, `.drawer-section-card`), `14px` (`.error-inline-card`, `.toast-pill`), `16px` (`.drawer-panel` inner edge, `.center-modal`), `18px` (`.composer-card`).
- **Background:** `--color-paper-2` for top-level cards on the canvas (`.thoughts-shell`, `.code-block-shell`, `.drawer-panel`, `.center-modal`) and `--color-paper-3` for nested cards inside drawers/modals (`.drawer-section-card`, `.code-block-head`, `.toast-pill`), plus a floating `--color-paper-2` `.modal-footer-bar` separated by `--color-rule-soft` outside scroll areas.
- **Shadow Strategy:** Flat tonal stacking for inline canvas and drawer cards; `--shadow-float` strictly on slide-over drawers, centered modals, overflow menus, and toasts.
- **Border:** None on cards; `.thoughts-shell` relies on `grid-template-rows: 0fr -> 1fr` (`260ms var(--ease-in-out)`) for borderless accordion expansion, `.code-block-shell` uses a typographic language-and-Copy strip (`--color-paper-3`) rather than synthetic macOS traffic-light dots, and `.modal-footer-bar` uses a subtle `1px solid var(--color-rule-soft)` top divider to dock persistent actions (`Delete`, `Save Endpoint`) over scrollable form fields.
- **Internal Padding:** `10px 14px` on `.thoughts-trigger` (`2px 14px 14px` body), `8px 12px` header / `12px 14px` preformatted body on code blocks, `14px 16px` on `.drawer-section-card`, and `11px 16px` on `.toast-pill`.

### Inputs / Fields
- **Style:** Unbordered fields (`border: none`) recessed by one tonal step: `.drawer-field` uses `10px` radius with `10px 12px` padding on `--color-paper-2` (or `--color-paper-3` inside modals); the floating `.composer-card` wraps a transparent auto-growing `.composer-textarea` (`28px`–`164px` height, `1rem`, `1.48` line-height) inside an `18px` `--color-paper-2` shell (`12px 12px 10px 16px` padding) with `--shadow-float`.
- **Focus:** `.composer-card:focus-within` subtly warms its fill (`color-mix(in oklch, var(--color-paper-2) 86%, var(--color-paper-3))`) without flashing harsh outline borders; `.drawer-field:focus` applies `2px solid var(--color-focus)` (`1px` offset).
- **Error / Disabled:** Validation and stream errors render inline in `--color-danger-soft` cards (`14px` radius) with `--color-danger` alert icon and tonal `Retry` / `Check API Key / Endpoint` recovery pills; disabled primary buttons transition cleanly to `--color-paper-3` with `--color-muted` ink.
- **Specialized Controls:** `.toggle-switch` (`48px × 28px`, `999px` capsule) slides a `22px` knob across `20px` with Motion spring physics (`stiffness: 460, damping: 32`), shifting track from `--color-paper-4` to `--color-accent` and knob from `--color-ink` to `--color-accent-ink`. `EffortSlider` spans a `44px`-tall `5`-step track (`Off`, `Low`, `Med`, `High`, `XHigh`) with `8px` `--color-paper-3` rail, `4px` notch dots, and a GPU `x`-transform spring-driven `24px` thumb carrying an `8px` `--color-paper` center dot.

### Navigation
- **Top Bar (`.topbar`, `TopBar.tsx`):** Borderless sticky header fading downward from `--color-paper` (`72%`) to transparent; houses a `44px` `.tonal-circle-btn` drawer trigger on the left, compact `20px` `MaylandLogo` + inline editable conversation title + `.tabular-nums` token and provider subtitle (`0.74rem`), and right-side `.ghost-icon-btn` new-chat/overflow triggers plus a `.tonal-circle-btn` Run Settings button.
- **Turn Timeline Rail (`.timeline-rail`, `TurnTimelineRail.tsx`):** Vertical navigation track (`1.5px` `--color-rule-soft` line) anchored at `right: 0` on compact screens and `right: max(12px, calc(50% - 418px))` beside the `720px` reading column on desktop, displaying up to the last 10 turns as `6px` user / `7px` assistant dots inside `44px × 36px` jump targets; the active turn scales `1.55x` in `--color-accent`.
- **Scroll-to-Bottom Pill (`.scroll-bottom-btn`):** `44px × 44px` `--color-paper-3` circle centered above the composer dock with `--shadow-pill`, revealed smoothly via Motion when scrolled `> 120px` above bottom.

### Maybot Companion & Live Processing Dock
Maybot (`src/components/Maybot.tsx`) is Mayland's custom animated SVG chibi bot mascot rendered across four calibrated scales (`xs: 34px`, `sm: 44px`, `md: 72px`, `lg: 118px`) using live CSS theme tokens (`--color-paper-2` body, `--color-paper` visor, `--color-ink` outline/eyes, dynamic `--color-accent` / `--color-thought` / `--color-success` / `--color-danger` antenna and ear pods). It cycles natural `3900ms` blinks and distinct motion choreography across eight moods (`idle`, `listening`, `decrypting`, `connecting`, `thinking`, `streaming`, `happy`, `error`), reveals a floating speech pill on tap in `lg` empty-stage mode, and docks at `34px` (`xs`) inside the floating `.maybot-live-dock` pill above the composer during active requests alongside real-time `tok/s` telemetry and a `Stop` action.

## Do's and Don'ts

### Do:
- **Do** step surfaces cleanly across `--color-paper`, `--color-paper-2`, `--color-paper-3`, and `--color-paper-4` instead of boxing buttons or cards in `1px` structural borders.
- **Do** preserve the typography split: keep model prose in `Spectral` (`--font-reading`, `68ch` max measure) by default while rendering Markdown headings, tables, UI chrome, and controls in `Geist Variable` (`--font-ui`) and code/keys/model IDs in `JetBrains Mono` (`--font-mono`).
- **Do** apply `.tabular-nums` to all numeric counters, timestamps, token estimates, `tok/s` readouts, and slider values so live streaming never shifts layout width.
- **Do** pair `999px` pill geometry and `>= 44px` minimum hit targets on primary interactive triggers with crisp `:focus-visible` outlines (`2px solid var(--color-focus)`) and `prefers-reduced-motion` `150ms` fallbacks.
- **Do** reserve `--color-thought` exclusively for reasoning traces and thinking depth (`off`–`high`) and `--color-accent` for primary confirmations, active toggles, and `xhigh` peak effort.

### Don't:
- **Don't** wrap toolbar icons, starter prompts, or drawer controls in stiff rectangular `0px`–`6px` bordered boxes.
- **Don't** add synthetic macOS traffic-light dots to `.code-block-shell`; keep the typographic language-and-copy strip.
- **Don't** apply `--shadow-float` or `--shadow-pill` to resting inline message cards, drawer section cards, or table rows; shadows belong strictly to floating overlays and detached pills.
- **Don't** hardcode hex colors in component styles when a CSS custom property (`--color-*`) exists, so Clay Dark, Obsidian, and Daylight theme switching stays unbroken.
- **Don't** replace Maybot's expressive phase states (`decrypting`, `connecting`, `thinking`, `streaming`) with generic circular spinner animations.
