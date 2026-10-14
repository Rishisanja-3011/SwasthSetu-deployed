# VaaniDoc MongoDB foundation

The canonical database implementation for the new local version lives under
`lab/server/src/models`. The older `vaanidoc-db/` SQL folder is preserved as a
legacy reference and is not modified by this project.

## Collections

| Collection | Purpose |
|---|---|
| `users` | Role-bearing platform identities: `PATIENT`, `DOCTOR`, `LABORATORY` |
| `patients` | The central patient record and platform Patient ID |
| `doctors` | Registered doctors and doctor QR/code identities |
| `laboratories` | Active self-registered laboratory providers and lab QR/code identities |
| `encounters` | Doctor consultations with `OPEN`/`CLOSED` access boundaries |
| `symptomintakes` | Patient-confirmed transcript and structured intake |
| `consultationnotes` | Doctor notes scoped to one doctor-patient encounter |
| `diagnosticorders` | Tests ordered from a doctor encounter |
| `labaccessgrants` | Four-field laboratory permission, expired on publication |
| `diagnosticreports` | Report extraction, review, and publication state |
| `reportfiles` | Immutable original PDF metadata and storage reference |
| `labobservations` | Extracted, normalized, validated CBC observations |
| `aiartifacts` | AI-generated content with an explicit source reference |
| `auditevents` | Authentication, access, workflow, and denial traceability |
| `authchallenges` | Hashed, short-lived patient OTP challenges |
| `pendingprovidervisits` | Short-lived QR destination during OTP login |
| `notifications` | Doctor queue notifications used by the current dashboard |

## Important access invariants represented by the schema

- Laboratory grants contain no time-based expiry field. Their status changes
  from `ACTIVE` to `EXPIRED` when the associated report is published.
- OTP codes are never stored in plain text. Their challenge collection has a
  MongoDB TTL index on `expires_at`.
- Pending QR destinations are single-use and have their own TTL index.
- Original PDF metadata is separate from structured observations so the source
  file remains preservable and independently downloadable.
- Original PDF bytes are stored at runtime under `lab/server/storage/` (or the
  `REPORT_STORAGE_ROOT` environment override). The directory is ignored by git;
  MongoDB stores only its immutable storage key and hash.
- AI artifacts must reference an encounter or report source.

## Initialize a local or Atlas database

1. Copy `.env.example` to `.env` in `lab/server`.
2. Put the MongoDB Atlas connection string in `MONGO_URI`.
3. From `lab/server`, run:

   ```bash
   npm run init-db
   ```

The command creates missing collections and indexes without deleting existing
documents. It does not seed demo users or reports.

## Development authentication endpoints

The first local authentication adapter is terminal OTP. It is intentionally
replaceable later with an SMS adapter.

1. `POST /api/auth/patient/request-otp` with `{ "phone": "...", "provider_code": "DOC-..." }`.
2. Read the six-digit development OTP from the Node server terminal.
3. `POST /api/auth/patient/verify-otp` with the returned `challenge_id` and OTP.
4. If the response requires registration, call
   `POST /api/auth/patient/register` with the registration token and the
   patient's name, age/date of birth, and gender.

Provider metadata can be resolved without authentication through
`GET /api/providers/resolve/:providerCode`. It returns only public provider
metadata and never patient history.

Laboratories self-register from the laboratory portal through:

```text
POST /api/auth/laboratory/register
```

The response returns an active session and a collision-resistant `LAB-*` ID.
Returning laboratory operators sign in through `/api/auth/provider/login` with
the generated ID and registered phone. The old backend-only onboarding helper
is retained for migrations and fixtures.

The canonical Python extraction pipeline is invoked by the Node laboratory
upload route through `extraction/bridge.py`. Install the root
`requirements.txt` dependencies and set `PYTHON_EXECUTABLE` in `lab/server/.env`
if the runtime is not available as `python` on PATH. PDF uploads are stored as
immutable originals, processed by the text/OCR pipeline, and persisted as
`labobservations`; any extraction or quality-review signal keeps publication
blocked until the laboratory resolves it.

For migration fixtures, use the backend-only helper:

```text
node scripts/onboardLaboratory.js --name "Laboratory name" --phone "+919000000002" --code "LAB-102" --location "City"
```

The laboratory UI then signs in through `/api/auth/provider/login` with the
registered phone and provider code.
