# CLAUDE.md — Sound Machine PWA

## Project
Minimal sleep-sound PWA. Full requirements live in SPEC.md — read it before any work. SPEC.md is the source of truth; if a request conflicts with it, flag the conflict instead of silently deviating.

## Token & workflow discipline (important)
- **Do NOT spawn subagents or use the Task tool.** This codebase is small; explore directly with targeted reads.
- Do not re-read the whole repo each session. Read STATE.md first, then only the files relevant to the current phase.
- Keep responses concise. No long summaries of unchanged code.
- Prefer editing existing files over rewriting them.
- No new dependencies, frameworks, or build tooling without asking first. Target: vanilla JS/HTML/CSS, zero npm packages if possible.

## Phase-gated build order (one phase per session; stop at each gate)
- **Phase 1 — Audio engine:** noise generators + file loop player, routed per SPEC architecture through `<audio>` element. Gate: sounds play and loop seamlessly on iPhone Safari.
- **Phase 2 — Media Session:** lock-screen metadata + play/pause handlers. Gate: acceptance tests 1–2 pass on iPhone.
- **Phase 3 — Timer:** presets + 15 s master-gain fade-out. Gate: acceptance test 4 passes.
- **Phase 4 — PWA + deploy:** manifest, service worker (cache-first for static assets + sound files), icons, Vercel deploy. Gate: acceptance tests 5–6 pass.

Do not start the next phase without explicit go-ahead. At the end of each phase, update STATE.md.

## STATE.md protocol
Maintain a STATE.md at repo root with: current phase, what's done, what's verified on-device vs untested, known issues, and any decisions made that aren't in SPEC.md. Keep it under ~40 lines. This file is how context survives /clear between sessions.

## iOS-specific gotchas (do not "simplify" these away)
- Audio must start from a user gesture (tap) — never autoplay on load.
- Route ALL audio through the `<audio>` element via MediaStreamAudioDestinationNode, or lock-screen controls will not appear for generated noise.
- Use GainNode ramps for volume/fade; iOS ignores programmatic `audio.volume`.
- Test loop seamlessness with real playback, not by reading code.

## Definition of done per phase
Code runs, relevant SPEC.md acceptance tests pass **on an actual iPhone**, STATE.md updated. Desktop-only verification does not count as done.
