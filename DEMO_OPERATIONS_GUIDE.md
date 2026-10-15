# SwasthSetu Demonstration and Operations Guide

This is the presentation runbook for the complete local SwasthSetu workflow:
patient, doctor, laboratory, extraction, voice intake, report review, and
publication.

> **Safety:** Every account and PDF in this guide is synthetic. Demo PDFs are
> visibly marked **SYNTHETIC DEMONSTRATION REPORT - NOT FOR CLINICAL USE**.
> Never present them as real medical records.

## 1. Canonical applications

| Application | Directory | Local URL | Purpose |
|---|---|---:|---|
| API/server | `lab/server` | `http://localhost:5000` | Auth and all workflow APIs |
| Public landing | `landing/ui` | `http://localhost:5174` | VaaniDoc overview and workspace entry points |
| Patient UI | `patient/ui` | `http://localhost:5176` | Patient login, intake, consent, reports |
| Doctor UI | `doctor/ui` | `http://localhost:5175` | Queue, intake review, notes, orders |
| Laboratory UI | `lab/ui` | `http://localhost:3000` | Upload, extraction review, publication |

The active source folders are `patient/ui`, `doctor/ui`, `lab/ui`, `lab/server`,
and `extraction`. Do not use the legacy folders for the live workflow.

The public VaaniDoc introduction page is available at `/welcome` in the patient
application. The canonical standalone landing application is `landing/ui` on
port `5174`; doctor and laboratory login screens link to that standalone app. For separate
deployed origins, set these frontend build variables:

```env
VITE_PATIENT_APP_URL=https://patient.example.com
VITE_DOCTOR_APP_URL=https://doctor.example.com
VITE_LAB_APP_URL=https://lab.example.com
VITE_LANDING_APP_URL=https://www.example.com
```

`VITE_PATIENT_APP_URL` is embedded into doctor and laboratory QR codes. Do not
use a localhost fallback in a production build.

## 2. One-time setup

Requirements:

- Node.js and npm
- MongoDB Atlas or the configured development MongoDB instance
- Windows Python with `numpy` and `PyMuPDF` for PDF extraction

Create the private file `lab/server/.env`:

```env
MONGO_URI=<your-development-mongodb-uri>
PORT=5000
VAANIDOC_TOKEN_SECRET=<long-local-development-secret>
PYTHON_EXECUTABLE=C:\path\to\python.exe
EXTRACTION_TIMEOUT_MS=180000
# Optional; leave empty for deterministic fallback/review behavior.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
```

Never commit `.env`, API keys, passwords, or OTPs.

Install dependencies if needed:

```powershell
cd lab/server; npm install
cd ../../patient/ui; npm install
cd ../../doctor/ui; npm install
cd ../../lab/ui; npm install
```

Generate all twelve synthetic PDFs, including a corrected companion for every patient:

```powershell
cd <repository-root>
python demo/generate_demo_reports.py
python demo/generate_demo_reports.py --verify
```

## 3. Reset and seed a fresh presentation

Use this before a clean demonstration:

```powershell
cd lab/server
npm run demo:reset
```

The reset removes only reports, observations, original PDFs, and lifecycle
state belonging to the exact six synthetic patient/order/grant chains. It does
not delete unrelated data.

For an empty development database, seed the synthetic accounts and grants:

```powershell
npm run demo:seed -- --confirm-demo
```

Seeding creates accounts and grants. Reports are created only by the real lab
upload endpoint.

## 4. Start the system

Open four terminals.

### API — Terminal A

```powershell
cd lab/server
npm start
```

Health check: `http://localhost:5000/api/health`

### Patient UI — Terminal B

```powershell
cd patient/ui
npm run dev
```

Open `http://localhost:5176`.

### Doctor UI — Terminal C

```powershell
cd doctor/ui
npm run dev
```

Open `http://localhost:5175`.

### Laboratory UI — Terminal D

Set `VITE_ENABLE_DEMO_REPORT_SELECTOR=true` in the local laboratory UI
environment, then run:

```powershell
cd lab/ui
npm run dev
```

Open `http://localhost:3000`.

## 5. Synthetic login credentials

### Doctor

```text
Provider code: DOC-DEMO01
Phone:        +919900000010
Name:         Dr. Demo Mehta
```

### Laboratory

```text
Provider code: LAB-DEMO01
Phone:        +919900000020
Name:         VaaniDoc Demo Diagnostics
```

### Patients

| Patient ID | Name | Phone | Demonstration purpose |
|---|---|---|---|
| `PXDEMO001` | Demo Normal Patient | `+919900000001` | Complete normal CBC |
| `PXDEMO002` | Demo Review Patient | `+919900000002` | Platelet review/correction |
| `PXDEMO003` | Demo Incomplete Patient | `+919900000003` | Coverage block |
| `PXDEMO004` | Demo Asha Rao | `+919900000004` | Second normal CBC |
| `PXDEMO005` | Demo Kabir Shah | `+919900000005` | Plausible HIGH/LOW flags |
| `PXDEMO006` | Demo Meera Sen | `+919900000006` | Missing-reference block |

Patients use phone + terminal OTP. There is intentionally no fixed OTP. The
short-lived development OTP is printed by the API terminal. A new phone shows
the registration form after OTP verification.

## 6. Complete presentation flow

### Patient → doctor

1. Log in to the patient UI with a synthetic patient phone and terminal OTP.
2. Enter or scan `DOC-DEMO01`.
3. Choose a new or revisiting visit.
4. Use text intake or voice intake.
5. Show the multilingual typewriter guidance under **Tap to Speak Symptoms**.
6. Submit, review, correct if needed, and confirm the structured intake.

### Doctor

1. Log in with `DOC-DEMO01` and `+919900000010`.
2. Open the waiting queue and review the patient-confirmed intake.
3. Start/call the consultation.
4. Add a consultation note.
5. Order CBC and complete the consultation.

### Patient → laboratory consent

1. Return to the patient UI.
2. Enter `LAB-DEMO01` in the laboratory consent flow.
3. Show the four shared identity fields: name, age/date of birth, gender, and
   phone.
4. Approve the laboratory grant.

### Laboratory → patient report

1. Log in with `LAB-DEMO01` and `+919900000020`.
2. Open the active patient visit.
3. Upload the matching PDF from `demo/reports/`, or use the synthetic selector.
4. Review extraction and observations.
5. Publish after all gates are clear.
6. Show that publication expires that grant automatically.
7. Reopen the patient UI and show the published report, original PDF receipt,
   and timeline order linkage.

## 7. Report scenarios

| File | Expected result |
|---|---|
| `demo-cbc-normal.pdf` | 14 observations; complete and publishable |
| `demo-cbc-needs-review.pdf` | Platelets `15`; `NEEDS_REVIEW`; blocked |
| `demo-cbc-needs-review-corrected.pdf` | Same PXDEMO002 identity; complete corrected panel; publishable |
| `demo-cbc-incomplete.pdf` | Incomplete marker coverage; blocked |
| `demo-cbc-high-low.pdf` | Complete panel with plausible HIGH/LOW flags; publishable |
| `demo-cbc-missing-reference.pdf` | Partial validation; blocked |

Every scenario has an upload-ready companion in `demo/reports/`:

| Patient | Corrected upload file |
|---|---|
| PXDEMO001 | `demo-cbc-normal-corrected.pdf` |
| PXDEMO002 | `demo-cbc-needs-review-corrected.pdf` |
| PXDEMO003 | `demo-cbc-incomplete-corrected.pdf` |
| PXDEMO004 | `demo-cbc-normal-asha-corrected.pdf` |
| PXDEMO005 | `demo-cbc-high-low-corrected.pdf` |
| PXDEMO006 | `demo-cbc-missing-reference-corrected.pdf` |

Each corrected companion contains 14 validated observations, complete coverage,
all reference intervals, and no extraction review blockers. They remain visibly
labelled synthetic and are not clinical reports. The same files are served from
`lab/ui/public/demo-reports/` for the development selector.

## 8. Review and corrected-report demonstrations

The review PDF is intentionally incorrect. Platelets `15 /cmm` is an
implausible synthetic value, so the system correctly marks it `NEEDS_REVIEW`.

### Preferred workflow: Fix & Verify

1. Upload `demo-cbc-needs-review.pdf`.
2. Click **Fix & Verify** on platelets.
3. Enter value `250000`, unit `/cmm`, reference range `150000`–`400000`, and
   reason `Synthetic analyzer rerun confirms the platelet value.`
4. Save, then publish.

The original PDF remains preserved and the correction is audited.

### Alternative workflow: upload the corrected PDF

The server intentionally allows one report per grant. To demonstrate a
corrected PDF upload:

1. Run `npm run demo:reset` first.
2. Open the matching patient again.
3. Choose that patient's **Corrected** report in the synthetic selector, or
   choose the corresponding `demo/reports/*-corrected.pdf` in the file picker.
4. Upload and publish.

Do not upload the corrected PDF after the original already exists on that
grant. `REPORT_ALREADY_UPLOADED` is the expected immutable-audit response.

## 9. Troubleshooting

| Symptom | Resolution |
|---|---|
| Patient shows login instead of registration | Existing seeded patients use OTP login. Use a new phone for registration. |
| Doctor login fails | Use exactly `DOC-DEMO01` and `+919900000010`; seed first. |
| Laboratory login fails | Use exactly `LAB-DEMO01` and `+919900000020`; seed first. |
| `REPORT_ALREADY_UPLOADED` | Run `npm run demo:reset`, or use a fresh order/grant. |
| `NEEDS_REVIEW` remains | Check whether the blocker is observation-level or structural validation/coverage. Structural blockers require a new complete report. |
| `LAB_WORKFLOW_FAILED` | Use the latest pushed code and inspect the API terminal. The correction path now returns bounded error codes. |
| `EXTRACTION_RUNTIME_UNAVAILABLE` | Set `PYTHON_EXECUTABLE` to Windows Python with numpy/PyMuPDF. |
| Voice provider unavailable | Use browser speech or typed intake; optional cloud transcription is not required for the deterministic demo. |

## 10. Automated proof

From `lab/server`:

```powershell
npm test
npm run demo:smoke -- --confirm-demo
```

The isolated smoke test uses temporary database/storage and covers auth,
ownership, intake confirmation, repeated-confirmation protection, PDF upload,
extraction, correction, corrected publication, structural blocking, duplicate
upload rejection, original PDF preservation, access expiry, patient download,
and fixture lifecycle reset.

## 11. Rules for a safe demonstration

- Use only the canonical active application directories.
- Never commit `.env`, tokens, keys, passwords, or OTPs.
- Never present synthetic PDFs as clinical records.
- Never insert observations directly from the UI; use the real upload endpoint.
- Never silently replace a report under an existing grant.
- Use `npm run demo:reset` to repeat the demo safely.
