# Firebase setup for `to-link-or-not`

This study is configured to use ReVISit's Firebase storage engine for participant data, audio, and screen/session recordings.

## Repository configuration

- `.env` uses `VITE_STORAGE_ENGINE="firebase"`.
- `.env` must contain this project's Firebase web-app config in `VITE_FIREBASE_CONFIG`.
- `.env` must contain the reCAPTCHA v3 **site key** in `VITE_RECAPTCHAV3TOKEN`.
- `public/to-link-or-not/config.json` enables audio and screen recording in `uiConfig` and includes the screen-recording permission component before training/trials.

Do not commit private Google/Firebase service-account credentials. The Firebase web-app config and reCAPTCHA site key are public runtime config, not admin secrets.

## Firebase console checklist

1. Create a Firebase project.
   - Gemini/Google Analytics are optional.
2. Create a Firestore database.
   - ReVISit docs suggest these rules for study collection access:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

3. Enable Firebase Storage.
   - ReVISit docs currently suggest permissive storage rules:

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

   - For a public pilot, revisit these rules before launch. They are convenient for setup but intentionally permissive.
4. Enable Authentication providers:
   - Anonymous sign-in for participants.
   - Google sign-in for admins/analysis access.
5. Register a Web app and copy the Firebase config object into `.env` as `VITE_FIREBASE_CONFIG`.
6. Set up App Check with reCAPTCHA v3.
   - Add local dev domains: `localhost`, `127.0.0.1`.
   - Add deployment domain: `velitchko.github.io` and/or the final custom domain.
   - Copy the reCAPTCHA v3 site key into `.env` as `VITE_RECAPTCHAV3TOKEN`.
7. Add the local App Check debug token after first local run with Firebase enabled.
8. Configure CORS for the Firebase Storage bucket:

```json
[
  {
    "origin": ["*"],
    "method": ["GET"],
    "maxAgeSeconds": 3600
  }
]
```

Then apply it with:

```bash
gsutil cors set cors.json gs://<your-cloud-storage-bucket>
```

9. Optional, for automatic transcripts: install the Google Cloud Speech-to-Text Firebase Extension.

## What C-3PO/R2-D2 still needs from Velitchko

- Firebase project ID/name, or confirmation to create/use a specific project.
- Firebase web-app config object for `VITE_FIREBASE_CONFIG`.
- reCAPTCHA v3 site key for `VITE_RECAPTCHAV3TOKEN`.
- Storage bucket name for CORS setup.
- Whether automatic transcription is required now or later.
- Whether the pilot will run on `https://velitchko.github.io/to-link-or-not/` or another domain, so App Check domains can be registered correctly.
