# STATE — Sound Machine PWA

## Current phase
Phase 1 (audio engine) — complete; user confirmed working on iPhone ("looks
good") via https://raw.githack.com/mbeat1mb-debug/sound-machine/main/index.html
(repo made public by user; githack CDN is interim hosting until Phase 4's
proper deploy). Extended 5-min loop listening not explicitly confirmed.
User re-confirmed timer requirements (Phase 3): Off default + 15/30/60/90.

## Done
- Audio graph per SPEC: source → per-sound gain → master gain → MediaStreamAudioDestinationNode → `<audio>` element. AudioContext + `audio.play()` only from user tap.
- White/pink/brown noise via AudioWorklet (`js/noise-worklet.js`) — continuous synthesis, no loop point.
- File loop player: fetch → decodeAudioData → silence-trim edges → 1.5 s equal-power crossfade of tail into head at load time → `AudioBufferSourceNode.loop`. Seamless regardless of codec padding.
- Single-sound rule, play/pause, volume slider driving master gain via ramps (v² curve). Basic dark one-screen UI. Timer UI deferred to Phase 3.
- 4 file sounds in `sounds/` (see Known issues), `sounds/CREDITS.md`.

## Verified (desktop Chromium via Playwright — NOT on-device)
- All 7 sounds produce audible output; element playing; ctx running.
- Loop-wrap sample continuity + real playback across each loop boundary (no dropouts; crickets' dips are natural chirp gaps — mid-buffer dips lower than at the wrap).
- Single active source after switching; pause/resume; volume→gain.

## Untested (needs iPhone Safari)
- Everything in SPEC acceptance test 3 (5+ min loop on device); screen-locked playback; worklet performance on iOS. Tests 1–2 are Phase 2 scope but routing is in place.

## Known issues / flags
- **Sound files are synthesized placeholders, not CC0 field recordings.** This env's network policy blocks all CC0 archives (only npm/pypi reachable), and Freesound needs an account. Self-authored = no license risk, but rain/ocean/fan/crickets are approximations. Swap in real CC0 recordings later (same filenames; engine loop-edits at load, so no pre-editing needed). See sounds/CREDITS.md.

## Decisions not in SPEC.md
- Project lives in its own repo, mbeat1mb-debug/sound-machine (user wants zero
  overlap with the Soma app; originally built on a side branch of Soma's repo).
- MP3 not AAC: open Chromium (test env) can't decode AAC; iOS decodes both.
- Loop crossfade done at runtime on decoded PCM instead of offline editing — immune to encoder gap/padding.
- Tapping the active sound toggles pause/resume (in addition to Play/Pause button).
- `window.__engine` debug hook exposed for automated tests.
