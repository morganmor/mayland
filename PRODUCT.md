# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite + TypeScript + Motion + Capacitor (Frontend-First mobile web app, PWA-installable on Android and pre-configured for Android APK wrapping via Capacitor).

## Users

Primary user: an individual mobile/Android power user chatting daily with AI models from their phone, switching across OpenAI-compatible providers (Fireworks AI, OpenRouter, Vercel AI Gateway, and custom endpoints) without relying on a single vendor app.

## Product Purpose

Mayland is a mobile-first Personal AI Workbench that combines the fluid reading and floating composer ergonomics of Claude mobile with the live parameter control, thinking-trace inspection, and token awareness of Google AI Studio—backed by a single flexible OpenAI-compatible custom endpoint adapter and locally encrypted API key storage.

## Positioning

Unlike single-provider mobile chat apps or stiff developer wrappers, Mayland puts full OpenAI-compatible endpoint control (provider presets + custom base URL + model ID + Run Settings drawer + thinking trace expansion) inside an animated, unboxed mobile-first interface where API keys are cryptographically encrypted locally (Hybrid AES-256-GCM with optional PBKDF2 Master PIN) and a custom chibi bot mascot keeps latency and processing states expressive and alive.

## Operating Context

- Used primarily portrait-first on Android smartphones (one-handed thumb reach at the bottom composer, frequent virtual keyboard open/close, dark ambient reading, quick drawer swipes/toggles for Run Settings and conversation history).
- Connects directly from client over HTTPS to user-configured OpenAI-compatible `/chat/completions` (and `/models`) endpoints with SSE streaming (`stream: true`), reasoning/thinking extraction (`reasoning_content`, `reasoning`, `<think>` tags), and AbortController cancellation.
- Works offline for reading saved local conversations, configuring settings, and managing encrypted keys; requires network only when calling external AI endpoints.

## Capabilities and Constraints

- **Single OpenAI-Compatible Adapter**: One unified adapter supporting custom Base URL, custom API path override if needed, model slug, custom headers, and one-tap provider presets (OpenRouter, Fireworks AI, Vercel AI Gateway, Groq, Together AI, Ollama/Local, Custom).
- **Hybrid Local API Key Encryption**:
  - Default layer: WebCrypto `AES-256-GCM` with random 12-byte IV per record and local device-key material stored separately in IndexedDB, ensuring plaintext keys never touch `localStorage`.
  - Optional upgrade layer: User-configured Master PIN in Vault/Settings that derives a 256-bit key via `PBKDF2` (`SHA-256`, 310,000 iterations, 16-byte random salt) and re-encrypts all saved API keys; keys are decrypted in-memory only at request dispatch time.
- **Mobile UI & Button Layout (AI Studio + Claude Reference)**:
  - Warm-charcoal dark-first canvas (with optional warm light reading theme toggle), non-boxed ghost/pill actions instead of rigid grid borders.
  - Top bar blending Claude's title/history ergonomics and AI Studio's token counter + Run Settings trigger.
  - Scrollable editorial conversation canvas with full-width model prose, collapsible `Thoughts` accordion (for reasoning tokens/traces), right-edge subtle turn timeline markers, floating scroll-to-bottom button, and fluid floating bottom composer (`+` attachments/prompt presets, tools/quick toggles, voice dictation / mic stub or Web Speech API where supported, animated Run/Send button, and active model/effort summary).
  - Slide-over Run Settings drawer (Model & Provider switcher, System instructions, Thinking/Reasoning effort level, Temperature / Top-P / Max tokens, Stream toggle, Response format / JSON mode toggle, `Get code` curl/fetch generator, Reset defaults).
- **Chibi Bot Logo & Animated Mascot**:
  - Bespoke Mayland logo mark and animated SVG chibi bot mascot (`Maybot`) that reacts to user input, bounces/types/thinks/breathes while the client encrypts/decrypts credentials, opens the request, awaits first token, and streams responses, plus reacts playfully on tap/idle.
- **Rich, Non-Rigid Motion**:
  - Smooth spring/exponential transitions across drawers, composer expansion, bottom sheets, button tactile feedback (and Capacitor Haptics on Android), scroll-to-bottom pill, and chibi mascot state choreography, honoring `prefers-reduced-motion`.
- **Android / Mobile Delivery**:
  - Installable PWA (`manifest.webmanifest`, service worker, adaptive-ready PNG icons) AND Capacitor Android project configuration (`capacitor.config.ts`, `@capacitor/android`, `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/status-bar`, `@capacitor/app` predictive/hardware back button support).

## Brand Commitments

- **Name**: Mayland
- **Mascot & Logo**: Chibi bot mascot & logo integrated into brand identity, empty state, and live request-processing indicator.
- **Visual References (User-supplied screenshots)**:
  - Google AI Studio mobile playground & Run Settings drawer (`Run settings`, `Get code`, model card, `System instructions`, `Thinking level`, `Tools` toggles, `Thoughts` collapsible panel, right-edge turn timeline track, bottom prompt box with `+`, quick toggles, `Run`).
  - Claude mobile chat (`#141413`-register warm dark canvas, borderless editorial prose with crisp inline code styling, floating scroll-to-bottom pill, floating rounded composer with `+` and voice/send controls, subtle disclaimer + model/effort status line underneath).
- **Anti-Rigidity Constraint**: Avoid boxing every button inside stiff bordered squares; prefer breathable spacing, borderless ghost icon buttons, soft tonal pills, and fluid spring motion.

## Evidence on Hand

- Three user-uploaded mobile UI screenshots showing the exact Google AI Studio mobile Run Settings drawer, Claude mobile chat screen, and Google AI Studio mobile Playground screen.
- Verified local machine tooling: Node.js v22.22.0, npm 10.9.4, JDK 21, `adb` platform-tools, and `<ANDROID_HOME>/cmdline-tools`.

## Product Principles

1. **Thumb-First Mobile Ergonomics**: Primary controls (composer, model/effort switcher, settings drawer trigger, stop/run) live comfortably in mobile reach with >= 44–48px hit targets and clean keyboard/safe-area handling.
2. **Fluidity Over Rigidity**: Controls float cleanly on tonal surfaces and open negative space with responsive spring motion rather than heavy boxed borders.
3. **Zero-Plaintext Local Secret Hygiene**: API keys stay encrypted at rest via WebCrypto AES-256-GCM (and optional PBKDF2 Master PIN) and are decrypted strictly transiently when building outbound provider headers.
4. **Transparent AI Execution**: Surface token estimates, streaming progress, thinking traces, and copyable request code (`Get code`) without cluttering the reading flow.
5. **Alive Waiting Experience**: The Mayland chibi bot turns network/TTFT wait time into an expressive, responsive state indicator rather than a sterile spinner.

## Accessibility & Inclusion

- Minimum 44x44px touch targets on interactive controls, clear `:focus-visible` outlines, WCAG AA text contrast on dark and light surfaces, semantic ARIA labels on icon buttons/drawers, and `prefers-reduced-motion` motion fallbacks.
