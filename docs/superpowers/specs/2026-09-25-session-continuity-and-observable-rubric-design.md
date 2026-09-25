# Session continuity and observable rubric

## Scope

Correct the silence action, extend the three session durations, and score dialogue evidence consistently. The maximum score remains 10. Adult fictional training remains the only scope.

## Session continuity

The initial-silence request is persisted in the background. The client replaces its button with a confirmed state and does not reload, navigate, or change scroll position.

Session limits are updated everywhere that calculates or displays them:

- Medium: 20 minutes;
- Difficult: 25 minutes;
- Very difficult: 35 minutes.

## Ten-point competency rubric

The score starts at zero and uses a ten-point maximum with visible item values:

| Area | Maximum |
| --- | ---: |
| Silence, presentation, pauses, listening, space, voice tone | 3.0 |
| Questions, paraphrase, linked memory, maieutics/induction | 2.0 |
| Dignified exit, dialogue direction, guided solution | 2.0 |
| Protection factors, risk factors, main factor | 3.0 |

Each of the six foundation items is worth 0.5. Each of the four dialogue techniques is worth 0.5. Dignified exit is worth 1.0; dialogue direction and guided solution are worth 0.5 each. Each factor area is worth 1.0. Explicit severe errors remain deductions and the result is clamped to zero through ten.

## Evidence rules

The server records or confirms an item only from text, delivery events, or explicit user actions:

- Initial silence is awarded immediately after the registered action.
- Personal presentation is awarded when the student identifies themself by name or role and links it to the Fire Department/CBMERJ.
- Respect for pauses is awarded after a delivered character turn is allowed to finish without interruption.
- Listening, space, and voice tone are awarded when the student responds coherently without a recorded interruption, hostility, belittling, or verbal aggression. Tone is never inferred from physical acoustics.
- Simple yes/no questions earn partial credit; simple and exploratory/complex questions earn full credit.
- Paraphrase requires a summary/reformulation followed by a confirming question.
- Linked memory includes invitations such as “imagine” or “você consegue se lembrar”, tied to the character's disclosed facts.
- Maieutics/induction requires positive alternatives or sequenced questions that let the character reach a conclusion.
- A dignified exit requires a concrete, voluntary, immediate safe next step.
- Dialogue direction requires at least three reciprocal turns without interruption; guided solution requires a positive, concrete plan.
- Risk, protection, and main-factor points require the student to identify or explore information disclosed by the character; the case file alone earns no credit.

## Evaluation pipeline

The character-turn evaluator receives these explicit criteria and returns structured evidence. On finalization, a second transcript review may add supported evidence but may not invent evidence or overwrite a recorded severe error. The displayed item values and their deductions sum directly to the final score.

## Validation

- Tests cover no-reload silence state, all three time limits, item scoring totals, presentation recognition, and final transcript evidence merging.
- The production build must pass before release.
