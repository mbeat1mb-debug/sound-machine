# STATE — Sound Machine PWA

## Current phase
Phases 2+3 (Media Session + timer) — built together per user request; code
complete and desktop-verified. **Awaiting on-device acceptance tests 1, 2, 4.**
Phase 1 confirmed working on iPhone by user via
https://raw.githack.com/mbeat1mb-debug/sound-machine/main/index.html
(repo made public by user; githack is interim hosting until Phase 4).

## Done
- Audio graph per SPEC: source → per-sound gain → master gain → MediaStreamAudioDestinationNode → `<audio>` element. AudioContext + `audio.play()` only from user tap.
- White/pink/brown noise via AudioWorklet (`js/noise-worklet.js`) — continuous synthesis, no loop point.
- File loop player: fetch → decodeAudioData → silence-trim edges → 1.5 s equal-power crossfade of tail into head at load time → `AudioBufferSourceNode.loop`. Seamless regardless of codec padding.
- Single-sound rule, play/pause, volume slider driving master gain via ramps (v² curve). Basic dark one-screen UI.
- 4 file sounds in `sounds/` (see Known issues), `sounds/CREDITS.md`.
- Media Session: metadata (title = sound name, artist = Sound Machine, icon artwork), play/pause handlers, playbackState synced on select/pause/resume.
- Timer: Off (default) /15/30/60/90 segmented row; 15 s fade **scheduled on the audio clock at arm time** (survives iOS JS throttling when locked); wall-clock timeout cleans up; resets to Off after firing; countdown line in status.

## Verified (desktop Chromium via Playwright — NOT on-device)
- All 7 sounds audible; loop continuity at wrap; single-sound rule; pause/resume; volume→gain.
- Media Session metadata/playbackState transitions incl. sound switching.
- Timer (time-scaled): arms, mid-fade gain ramps down, stops playback at expiry, resets to Off, gain restored on next play, Off cancels pending timer, 15-min button arms ~15 min.

## Untested (needs iPhone Safari)
- Acceptance test 1 (screen locked → sound continues) and 2 (lock-screen name + play/pause) — the core Phase 2 risk: iOS may treat MediaStream-backed <audio> differently; if controls don't appear, needs iteration.
- Acceptance test 4 (real 15-min timer expiry fades over ~15 s with screen locked).
- 5+ min loop listening (test 3) not explicitly confirmed.

## Known issues / flags
- **Sound files are synthesized placeholders, not CC0 field recordings.** This env's network policy blocks all CC0 archives (only npm/pypi reachable), and Freesound needs an account. Self-authored = no license risk, but rain/ocean/fan/crickets are approximations. Swap in real CC0 recordings later (same filenames; engine loop-edits at load, so no pre-editing needed). See sounds/CREDITS.md.

## Decisions not in SPEC.md
- Project lives in its own repo, mbeat1mb-debug/sound-machine (user wants zero
  overlap with the Soma app; originally built on a side branch of Soma's repo).
- MP3 not AAC: open Chromium (test env) can't decode AAC; iOS decodes both.
- Loop crossfade done at runtime on decoded PCM instead of offline editing — immune to encoder gap/padding.
- Tapping the active sound toggles pause/resume (in addition to Play/Pause button).
- `window.__engine` debug hook exposed for automated tests.
- Timer fade uses a dedicated fade GainNode in series after the master gain
  (SPEC says "master gain ramp" — series node is equivalent, and keeps the
  volume slider's setTargetAtTime from cancelling a scheduled fade).
- Timer runs on wall clock from the moment it's set; it keeps counting across
  sound switches; pausing doesn't pause the countdown. Selecting a new
  duration restarts it; expiry resets the selector to Off.
- Phases 2 and 3 were built in one session at the user's request.
