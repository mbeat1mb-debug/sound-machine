# Sound Machine PWA — Product Spec (v1)

## What this is
A minimal sleep-sound web app (PWA) for personal/family use. Plays one looping sound at a time, works with the screen locked on iOS, optional sleep timer with fade-out. No accounts, no backend, no visuals during playback beyond a simple UI.

## Non-negotiable requirements
1. **Lock-screen control (iOS Safari):** Audio must continue playing with the screen off, and play/pause must work from the iOS lock screen. This means ALL audio — including code-generated noise — must route through a real `<audio>` element so the Media Session API engages. Web Audio API output alone will NOT surface lock-screen controls.
2. **Seamless looping:** No audible gap, click, or pop at loop points for any sound.
3. **Single-sound playback:** Only one sound plays at a time. Selecting a new sound stops the current one.
4. **Timer:** Presets: Off (default, plays until stopped), 15, 30, 60, 90 minutes. When timer expires, fade volume to zero over 15 seconds, then stop.
5. **Installable PWA:** Home-screen icon, standalone display mode, works offline after first load.

## Sound library (7 sounds)
Generated in code (Web Audio, rendered/routed through the audio element):
1. Brown noise
2. White noise
3. Pink noise

CC0 loop files (source from Freesound, verify CC0 license, keep files < 2 MB each, loop-edited):
4. Rain
5. Ocean waves
6. Box fan
7. Crickets

## UI (one screen)
- App title, list/grid of 7 sound buttons, currently-playing sound visually indicated
- Play/pause button
- Timer selector (segmented control or similar: Off / 15 / 30 / 60 / 90)
- Volume slider
- Dark theme by default (this is a bedtime app)
- No animations during playback; keep it dead simple

## Media Session details
- Set metadata: title = sound name (e.g., "Brown Noise"), artist = "Sound Machine"
- Handle `play` and `pause` action handlers
- Update playbackState correctly so lock-screen UI stays in sync

## Architecture notes (build for future extensibility, do NOT build the features yet)
- Audio engine: each source (generated or file) passes through its own GainNode into a master GainNode, then to a MediaStreamAudioDestinationNode feeding the `<audio>` element. This makes a future multi-sound mixing feature (v2) an additive change, not a rewrite.
- Timer fade uses the master GainNode ramp, not element volume (iOS ignores programmatic element volume).
- Vanilla JS + HTML + CSS in a single small repo. No framework, no build step unless truly necessary.

## Explicitly OUT of scope for v1
- Multi-sound mixing / layering
- Accounts, sync, settings persistence beyond localStorage (last sound + timer choice + volume SHOULD persist in localStorage)
- Alarms, wake-up features
- Any backend or database
- Analytics

## Deployment
- Deploy to Vercel (static). No serverless functions needed.

## Acceptance tests (verify on iPhone before calling a phase done)
1. Start a sound, lock the phone → sound continues.
2. Lock screen shows the sound name with working play/pause.
3. Loop for 5+ minutes → no gaps/clicks.
4. Set 15-min timer → sound fades out over ~15 s at expiry and stops.
5. Add to Home Screen → opens standalone, works in airplane mode after first load.
6. Reopen app → last sound, volume, and timer selection are restored.
