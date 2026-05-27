# ReVISit reproducibility and upstream resync plan

This document outlines how to keep `to-link-or-not` reproducible while still tracking the upstream ReVISit framework.

The immediate goal is **not** to implement the resync. The goal is to define a safe plan so that, later, the paper can link from specific observations to reproducible study states without exposing participant audio/video.

## Current baseline

- Study repo: `https://github.com/velitchko/to-link-or-not`
- Upstream ReVISit repo: `https://github.com/revisit-studies/study`
- Upstream version inspected for this plan: `v2.4.2` / commit `1342408885dd25e64fbef15c6478d0a8d7cedb45`
- Current repo already includes a manual upstream sync workflow:
  - `.github/workflows/sync_from_upstream.yaml`
  - `.github/workflows/sync_from_upstream_test.yaml`
- Study-specific public assets live mainly under:
  - `public/to-link-or-not/`
  - `src/public/to-link-or-not/`
  - `scripts/generate-config.ts`
  - `scripts/lfr/`
- Active graph stimuli are generated/static JSON under:
  - `public/to-link-or-not/graphs/lfr/condition_1..condition_4/`
- Runtime backend is selected by `VITE_STORAGE_ENGINE` in `.env`.

## What has to be reproducible

A future reader should be able to reproduce the exact study state used for a paper observation, minus private participant media.

That means preserving:

1. **Framework version**
   - exact ReVISit upstream commit/tag used;
   - local patches on top of that upstream version.
2. **Study configuration**
   - `public/to-link-or-not/config.json`;
   - `scripts/generate-config.ts` and generator inputs so the config can be regenerated;
   - recording-permission component wiring. Upstream examples import the `screen-recording` library and reference `$screen-recording.components.screenRecordingPermission`; the current study generator instead defines a local `screen-recording-permission` component pointing at `libraries/screen-recording/assets/ScreenRecording.tsx`. A resync must either preserve and verify that local component or migrate to the upstream imported-library form.
3. **Stimuli**
   - all graph JSON files;
   - LFR generation/conversion scripts;
   - generated layout metadata and parameters;
   - any ground-truth metadata used for scoring.
4. **Custom study code**
   - `src/public/to-link-or-not/assets/**`;
   - response/interaction logging fields emitted by `NodeLinkDiagram`;
   - hidden response declarations needed for analysis exports.
5. **Analysis-relevant exports**
   - de-identified participant answers;
   - trial timing, selected nodes, accuracy/metrics, condition/task/graph ids;
   - optional screen/session replay artifacts if consent and anonymization allow it.
6. **Environment shape, not secrets**
   - storage engine choice;
   - public base path;
   - Firebase/Supabase setup requirements;
   - CORS/auth/domain setup notes;
   - never committed API keys, tokens, private bucket URLs, or participant identifiers when not needed.

## What must be omitted or sanitized

Do **not** publish raw private data by accident.

Omit or sanitize:

- audio recordings;
- screen recordings unless explicitly consented and redacted;
- raw transcripts if they can identify participants;
- participant IDs, Prolific IDs, names, emails, IPs, user-agent strings if not needed;
- Firebase/Supabase credentials and private bucket paths;
- any full participant JSON export before running a de-identification pass.

For paper-linked observations, prefer publishing a small derived artifact:

```text
observation id -> participant pseudonym -> condition/task/graph id -> timestamp range -> coded excerpt/summary -> supporting metrics
```

Store the private mapping and original audio/video separately, outside the public repo.

## Upstream resync strategy

### Recommendation

Use an **upstream-vendor branch plus protected study overlay** strategy.

The repo is already a fork/customization of `revisit-studies/study`, so a blind upstream merge will be noisy and risky. The existing sync workflow currently resets to upstream and restores only a small template subset. For this study, that is too destructive unless expanded: it would need to protect all `to-link-or-not` study files and local docs/scripts.

Recommended branches:

- `main`: current production study branch.
- `upstream/revisit-vX.Y.Z`: exact upstream ReVISit snapshot, no study-specific changes.
- `resync/revisit-vX.Y.Z`: integration branch where upstream changes and study overlay are reconciled.
- paper/archive tags: immutable tags for publication states.

### Step 1 — Record exact upstream base

For every resync, record:

```bash
git ls-remote https://github.com/revisit-studies/study.git refs/tags/v2.4.2
git ls-remote https://github.com/revisit-studies/study.git HEAD
```

Then create/update a local upstream remote:

```bash
git remote add upstream https://github.com/revisit-studies/study.git # if absent
git fetch upstream --tags
```

Create a snapshot branch for the upstream version:

```bash
git switch --detach v2.4.2
git switch -c upstream/revisit-v2.4.2
```

Do not add study files on this branch. It should stay a clean reference.

### Step 2 — Inventory local study overlay

Before resyncing, generate a machine-readable overlay manifest. At minimum include:

```text
public/to-link-or-not/**
src/public/to-link-or-not/**
scripts/generate-config.ts
scripts/generate-lfr-graphs.sh
scripts/lfr/**
docs/**
notes/**
.env.example or docs describing env variables
README.md
.github/workflows/deploy*.yaml
.github/workflows/sync_from_upstream*.yaml
```

Also identify local framework patches outside the study overlay, for example:

- storage engine fixes;
- analysis table/export changes;
- screen-recording import/config changes;
- deployment/base-path changes.

Those framework patches need explicit review on every upstream update because upstream may have changed the same files.

Useful command:

```bash
git diff --name-status upstream/revisit-v2.4.2...main
```

### Step 3 — Update the sync workflow before relying on it

The existing `.github/workflows/sync_from_upstream.yaml` restores only a template-oriented subset after resetting to upstream. For this study, extend or replace it so it preserves the study overlay.

Protected paths should include at least:

```text
README.md
docs/**
notes/**
public/to-link-or-not/**
src/public/to-link-or-not/**
scripts/generate-config.ts
scripts/generate-lfr-graphs.sh
scripts/lfr/**
.github/workflows/**
```

The workflow should also preserve or regenerate:

- `public/global.json` entries for `to-link-or-not`;
- deployment base path settings;
- package changes required by custom study code;
- schema URLs after upstream updates.

Do this in a test branch first. Do **not** force-push `main` until the output has been reviewed.

### Step 4 — Resync in an integration branch

Create an integration branch from current `main`:

```bash
git switch main
git pull --ff-only origin main
git switch -c resync/revisit-v2.4.2
```

Then either:

1. run the updated workflow manually against this branch; or
2. perform a local scripted sync:
   - checkout upstream into a temporary directory;
   - copy framework files into the integration branch;
   - restore protected study overlay;
   - resolve package/schema/config conflicts;
   - run verification.

Avoid manually cherry-picking dozens of unrelated upstream commits unless a clean merge is obviously smaller. This repo is study-specific; reproducibility matters more than preserving pretty upstream history.

### Step 5 — Revalidate study config and generated assets

Run:

```bash
npx tsx scripts/generate-config.ts
git diff --exit-code -- public/to-link-or-not/config.json
python -m json.tool public/to-link-or-not/config.json >/dev/null
```

Validate active graph JSON:

```bash
python - <<'PY'
import json
from pathlib import Path
for path in Path('public/to-link-or-not/graphs/lfr').glob('condition_*/*.json'):
    data = json.loads(path.read_text())
    assert data.get('nodes'), path
    assert data.get('edges'), path
    assert data.get('groundTruth'), path
    assert data.get('communities'), path
    assert data.get('memberships'), path
print('validated active LFR graph JSON')
PY
```

Run app-level checks:

```bash
npm run typecheck
npm run build
```

If production builds are unstable on the machine doing the check, record that explicitly and run the smallest reliable substitute.

### Step 6 — Verify recording/data behavior after resync

ReVISit `v2.4.2` supports `recordAudio`, `recordScreen`, and `recordScreenFPS` in the schema. The schema also documents that screen recording requires `$screen-recording.components.screenRecordingPermission` before any screen-recorded component.

After resync:

- confirm `uiConfig.recordAudio` / `uiConfig.recordScreen` are still set as intended;
- confirm the screen-recording permission component still appears before training/trials;
- confirm recording-permission wiring matches one supported pattern:
  - upstream imported-library pattern: `importedLibraries` includes `screen-recording` and the sequence references `$screen-recording.components.screenRecordingPermission`; or
  - current local-component pattern: `components.screen-recording-permission.path` remains `libraries/screen-recording/assets/ScreenRecording.tsx` and a browser smoke test confirms screen capture starts before recorded trials;
- test one local participant flow with a throwaway study id;
- verify participant answers are written;
- verify audio/screen blobs are written only to the intended backend;
- verify analysis can load/download media where expected.

Current source reading suggests:

- Supabase can store participant/session data, audio blobs, and screen-recording blobs through the common storage API.
- Firebase remains special for built-in transcript retrieval, think-aloud coding, and live monitor UI paths in current ReVISit.

So backend choice should be documented for each reproducible release:

```text
storageEngine: firebase | supabase
recordAudio: true|false
recordScreen: true|false
transcripts: firebase-only / external / omitted
rawMediaPublication: omitted by default
```

### Step 7 — Create a reproducibility bundle per paper milestone

For any paper-linked result, create a private full bundle and a public sanitized bundle.

Private bundle, stored outside the public repo:

```text
participant raw JSON
audio/screen recordings
raw transcripts
private participant mapping
backend export/checksum log
```

Public/supplementary bundle, safe to publish:

```text
REVISIT_UPSTREAM.md
study config JSON
graph JSON stimuli
generator scripts
analysis notebook/scripts
sanitized participant table
coded observation table
checksums
instructions for replaying/inspecting observations without raw audio
```

Recommended public artifact layout:

```text
reproducibility/
  README.md
  manifest.json
  upstream.json
  config/
    public-to-link-or-not-config.json
  stimuli/
    graphs-lfr-sha256.txt
  exports/
    participant-answers-sanitized.csv
    observations-coded.csv
  scripts/
    sanitize-export.ts
    verify-bundle.sh
```

### Step 8 — Add immutable release tags

Use annotated tags for any state cited by the paper:

```bash
git tag -a paper-study-freeze-YYYY-MM-DD -m "Study freeze for paper analysis"
git push origin paper-study-freeze-YYYY-MM-DD
```

The tag message should include:

- upstream ReVISit commit/tag;
- study commit;
- storage backend;
- whether audio/screen recordings exist privately;
- path or DOI of sanitized public bundle, once available.

## Proposed immediate work items

1. **Add `REVISIT_UPSTREAM.md`**
   - Record current upstream version, local divergence policy, and sync procedure.
2. **Harden `.github/workflows/sync_from_upstream.yaml`**
   - Expand protected paths for this concrete study before using it again.
3. **Create a reproducibility manifest script**
   - Emit upstream commit, current commit, config hash, graph file hashes, generator script hashes, and package lock hash.
4. **Create a sanitizer/export plan**
   - Decide which participant fields are safe to publish.
   - Explicitly remove audio/screen/transcript fields or replace them with observation IDs and timestamp ranges.
5. **Run a dry resync against upstream `v2.4.2`**
   - Integration branch only.
   - Confirm no study overlay is lost.
   - Confirm config generation, typecheck, and build.
6. **Create a paper-freeze tag before pilot/analysis**
   - Include checksums and a short reproducibility note.

## Open decisions

- Whether the pilot should use Firebase-only or Supabase-only for final data collection.
- Whether screen recordings are only a private analysis aid or whether redacted clips may be publishable.
- Whether transcripts will be generated inside Firebase/ReVISit, externally, or omitted from the public bundle.
- Whether to keep syncing framework code in-place or eventually split the study into a smaller overlay repo on top of a pinned ReVISit release.

## Bottom line

The safest path is:

1. pin exact ReVISit upstream version;
2. keep our study overlay explicit and protected;
3. resync only through reviewed integration branches;
4. archive sanitized, checksum-backed study states for paper observations;
5. omit raw audio/screen media from public artifacts unless there is explicit consent and redaction.
