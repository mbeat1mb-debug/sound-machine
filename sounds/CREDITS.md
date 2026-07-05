# Sound file provenance

**All four files are PLACEHOLDERS, synthesized from scratch for this project**
(procedural noise/oscillator synthesis, no recordings or third-party material
used). They carry no third-party license obligations.

Why: SPEC.md calls for CC0 field recordings (Freesound). Freesound requires an
account to download, and this build environment's network policy blocks all
CC0 archives (Wikimedia Commons, archive.org, etc.), so verifiable CC0
recordings could not be sourced here. See STATE.md.

| File | Content | Source |
|---|---|---|
| rain.mp3 | Filtered noise bed + random droplet transients | Synthesized (scripts kept in session scratchpad, regenerable) |
| ocean.mp3 | Noise with slow swell envelopes + surf band | Synthesized |
| fan.mp3 | Low-passed noise, box resonances, motor-hum harmonics | Synthesized |
| crickets.mp3 | AM sine chirps (4 "crickets") over quiet night bed | Synthesized |

All: 72 s, stereo, MP3 128 kbps, ~1.2 MB each (< 2 MB budget). MP3 rather
than AAC so that both iOS Safari and the open-source Chromium used for
automated testing can decode them. Loop
seamlessness is handled at runtime by the engine's decode-time crossfade, so
replacement files need no special loop editing — any clean ~60–90 s recording
works.

**To replace with real CC0 recordings:** drop in same-named .mp3 files
(< 2 MB) and update this table with source URL + license evidence per file.
