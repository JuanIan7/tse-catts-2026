# Media, persona voice, and competency scoring

## Objective

Remove misleading provisional media, make the opening narration dependable and character-appropriate, and make the final score reflect demonstrated skills rather than an arbitrary starting score.

## Scope

- This applies only to the deployed training application.
- Cases remain fictional and adult-only.
- The character portrait is not shown until its generated asset is available.
- The narrator remains a feminine voice; the character is voiced by a case-specific adult persona.

## Media state

`ScenarioMedia` will render a neutral loading panel (question mark and hourglass) while `location_image_path` is absent or generation is pending. It will not render `fallback-character.png` during that state. The generated image replaces the panel atomically once its URL is available.

## Opening audio

The initial sequence has two independently generated, preloaded audio tracks:

1. the occurrence description, voiced by the feminine narrator;
2. the opening line from the character, voiced with the case persona.

One explicit start action unlocks playback and begins the sequence. The client plays the prepared narration, then the prepared character line in the same audio flow. Delivery is confirmed only after the character track ends. Playback has terminal event handling for `ended`, `error`, and stalled playback, with one controlled retry before a visible recovery state. The browser speech-synthesis fallback is not used for this primary flow, preventing it from replacing the selected TTS voice.

## Character persona

Each generated case has a structured adult voice persona: presentation (`masculina` or `feminina`), age band (`jovem adulta`, `adulta`, or `madura`), and delivery state (for example, steady, irritated, tearful, fearful, or mildly intoxicated). The server maps that persona to a supported TTS voice and focused delivery instructions. Persona metadata is internal case data and is used both for the opening and every later character response.

## Competency score

The score is a 0–10 competency total, not a 10-point base with only a few deductions.

- Demonstrated observable skills earn their item value.
- Undemonstrated skills earn zero.
- Deductions for explicit harmful conduct apply after points are earned, never allowing a score below zero.
- A manual end with no demonstrated competencies results in zero.
- Severe-occurrence termination remains zero.
- The item cards remain the source of truth: their values must sum to the displayed final score.

## Validation

- Unit tests cover neutral media state, persona selection, sequential audio handling, and a no-evidence score of zero.
- Existing good-performance test data must still be able to reach ten.
- The production build must complete successfully before release.
