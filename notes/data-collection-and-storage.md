# Data collection and storage notes for `to-link-or-not`

## What ReVISit records already

ReVISit stores one `ParticipantData` JSON object per participant. Each trial answer lives under `participantData.answers[trialIdentifier]` as a `StoredAnswer` with:

- `answer`: response values collected from questionnaire/response blocks and reactive React components;
- `startTime` and `endTime`: epoch milliseconds for the trial;
- `windowEvents`: browser focus/input/key/mouse/resize/scroll/visibility events captured during the trial;
- `provenanceGraph`: available only for React components that explicitly use Trrack;
- `parameters`: the component parameters, which for this study include the graph object, condition, task, prompt, and ground truth;
- `correctAnswer`, option/question/form order metadata, timeout flag, help-count, etc.

Storage is selected by `VITE_STORAGE_ENGINE` in `src/storage/initialize.ts`: exactly one primary storage engine is created for participant data (`supabase`, `firebase`, or `localStorage`). Answers are saved through `storageEngine.saveAnswers(...)`, which uploads the participant JSON as `participants/<participantId>_participantData` in the selected backend.

## Study-specific fields now emitted by `NodeLinkDiagram`

The graph task component writes these values into its reactive answer payload, so they appear in `StoredAnswer.answer` and in downloaded participant data:

- `task-answer`: legacy answer value; string for T1, JSON array string for T2/T3;
- `isCorrect`;
- `responseTimeMs`;
- `condition`;
- `task`;
- `graphId`;
- `selectedNodes`: sorted unique selected node ids as a JSON array string;
- `selectedNodeCount`;
- `groundTruthSnapshot`: task-specific ground-truth object as a JSON string;
- `metrics`: task-specific scoring details as a JSON string;
- `interactionsUsed`: counts for selection actions, completed lasso gestures, mode changes, and reset actions as a JSON string. ReVISit's default `windowEvents` still contains lower-level mouse/wheel/visibility events for pan/zoom inspection.

Task metrics:

- T1: expected node, selected node, exact-match flag.
- T2: expected common neighbors, anchor pair, true/false positives, false negatives, precision, recall, exact-match flag.
- T3: overlap for each ground-truth community and best-community Jaccard. T3 remains non-exact unless the study design defines a target community.

This intentionally logs compact identifiers and task-level ground truth, not a duplicated full graph payload. The full graph remains available from `StoredAnswer.parameters.graph` and the versioned study config.

## Supabase + Firebase coexistence

Current ReVISit architecture supports one primary `StorageEngine` at runtime. The selected engine owns:

- participant JSON saves;
- study modes and sequence assignment/progress state;
- audio/screen-recording asset uploads via the common `saveAudioRecording` and `saveScreenRecording` methods;
- analysis downloads/replay lookups.

Both Supabase and Firebase engine implementations can save audio and screen-recording blobs through the common storage-engine API. Firebase additionally implements transcript URL/transcription helpers used by the think-aloud analysis path; Supabase currently returns audio/screen object URLs but does not provide Firebase-style transcript retrieval.

Running Supabase as the primary participant-data backend while also using Firebase only for audio/session replay is possible, but not supported by the current single-engine initialization. It would require a small architectural extension, not just environment variables:

1. Keep `VITE_STORAGE_ENGINE=supabase` for participant data and assignments.
2. Add a secondary recording storage engine, e.g. `VITE_RECORDING_STORAGE_ENGINE=firebase`.
3. Initialize Firebase separately for recording/transcript APIs without replacing the primary storage context.
4. Route `useRecording` uploads and analysis replay/transcript reads to that secondary engine.
5. Store or derive a stable cross-backend key: same `studyId`, `participantId`, and trial name in both Supabase participant data and Firebase Storage paths.
6. Configure Firebase public/runtime env only (`VITE_FIREBASE_CONFIG`, app-check token if used); no credentials/secrets in repo.

Recommendation: for the pilot, prefer **Firebase-only** if Firebase transcription/session replay is required in ReVISit's existing analysis UI. Use **Supabase-only** if the priority is simpler participant-data storage and recordings without Firebase transcription. Use a hybrid only after adding an explicit secondary recording engine; otherwise the analysis UI will look in the wrong backend for recordings/transcripts.
