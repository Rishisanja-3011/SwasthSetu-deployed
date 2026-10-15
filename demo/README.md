# SwasthSetu synthetic demonstration kit

This directory is a bounded, development-only fixture set. Every account,
patient, phone number, provider code, and PDF in the catalog is synthetic. Each
PDF is visibly labelled **SYNTHETIC DEMONSTRATION REPORT - NOT FOR CLINICAL
USE** and must not be used as a medical record.

## One catalog, six patients

`demo/catalog.json` is the source catalog. The generator copies the same file
to `lab/ui/public/demo-reports/catalog.json`, so a development UI can load one
contract instead of maintaining another patient/report list.

Each `patients[]` item contains:

```json
{
  "identifier": "PXDEMO001",
  "name": "Demo Normal Patient",
  "phone": "+919900000001",
  "age": 34,
  "gender": "Male",
  "report": {
    "file": "demo-cbc-normal.pdf",
    "scenario": "normal",
    "expectedOutcome": {
      "uploadStatus": "PROCESSING",
      "publishEligible": true
    }
  }
}
```

The full `expectedOutcome` object also records expected validation and coverage
status, test/observation counts, review markers, and HIGH/LOW flags. The six
scenarios are:

| Patient ID | Scenario | Report | Expected walkthrough result |
|---|---|---|---|
| `PXDEMO001` | `normal` | `demo-cbc-normal.pdf` | Complete panel; publish eligible |
| `PXDEMO002` | `plausibility-review` | `demo-cbc-needs-review.pdf` | Platelet `15`; review required; correct the existing row to synthetic analyzer evidence `250000` |
| `PXDEMO003` | `incomplete` | `demo-cbc-incomplete.pdf` | Incomplete coverage; publication blocked |
| `PXDEMO004` | `another-normal` | `demo-cbc-normal-asha.pdf` | Second complete normal panel; publish eligible |
| `PXDEMO005` | `high-low-plausible` | `demo-cbc-high-low.pdf` | Plausible HIGH/LOW flags; publish eligible |
| `PXDEMO006` | `missing-reference` | `demo-cbc-missing-reference.pdf` | Missing source reference; publication blocked |

The analyzer correction evidence in `demo-cbc-needs-review.pdf` is explicitly
labelled training evidence and is formatted as instrument metadata. It is not
a second CBC row, so extraction should produce one platelet observation with
value `15` until the operator manually corrects that observation.

The generator also creates one `*-corrected.pdf` companion for every patient.
Each companion preserves the matching patient identity and contains a complete
synthetic CBC with the source review defects corrected. These are not extra
patients; use the matching companion only after resetting that patient grant or
on a fresh grant.

## Generate and verify PDFs

From the repository root, use the configured Windows Python runtime when it is
available:

```powershell
python demo/generate_demo_reports.py
python demo/generate_demo_reports.py --verify
```

The generator uses only the Python standard library to write the PDFs. The
`--verify` option additionally uses the local PyMuPDF/numpy extraction runtime
to check one patient header per PDF, matching age/gender/phone metadata,
extraction counts, duplicate markers, missing-reference behavior, and the
expected workflow outcome. It prints summaries only; it does not print raw
report text.

Outputs are written to both:

- `demo/reports/*.pdf` — source fixtures used by server smoke tooling.
- `lab/ui/public/demo-reports/*.pdf` — development UI static assets.
- `lab/ui/public/demo-reports/catalog.json` — byte-for-byte public catalog copy.

## Synthetic account login details

These are the only account credentials for this fixture set. Patient login
uses the existing terminal-OTP flow; there is no fixed OTP in this guide. Read
the short-lived OTP from the local Node server terminal during development.

| Role | Synthetic name | Fixture phone | Patient ID / provider code | Login method |
|---|---|---|---|---|
| Patient | Demo Normal Patient | `+919900000001` | `PXDEMO001` | Phone + terminal OTP |
| Patient | Demo Review Patient | `+919900000002` | `PXDEMO002` | Phone + terminal OTP |
| Patient | Demo Incomplete Patient | `+919900000003` | `PXDEMO003` | Phone + terminal OTP |
| Patient | Demo Asha Rao | `+919900000004` | `PXDEMO004` | Phone + terminal OTP |
| Patient | Demo Kabir Shah | `+919900000005` | `PXDEMO005` | Phone + terminal OTP |
| Patient | Demo Meera Sen | `+919900000006` | `PXDEMO006` | Phone + terminal OTP |
| Doctor | Dr. Demo Mehta | `+919900000010` | `DOC-DEMO01` | Provider code + phone |
| Laboratory | VaaniDoc Demo Diagnostics | `+919900000020` | `LAB-DEMO01` | Provider code + phone |

The first three patient phones/IDs and both provider codes remain compatible
with the original fixture flow.

## Seed the accounts and six bounded grants

Configure the server's existing `lab/server/.env` as usual, then run from the
server directory:

```powershell
cd lab/server
node scripts/seedDemoData.js --confirm-demo
```

The confirmation flag is required on every seed invocation. The command also
refuses to run when `NODE_ENV=production`. It performs a read-only ownership
preflight before inserting anything: an existing phone, provider code, patient
identifier, provider owner, name, or role must match the synthetic catalog.
Unrelated records cause a clear collision error rather than being rewritten.

The seed function is exported for isolated regression tests from
`lab/server/scripts/seedDemoData.js`; requiring the module does not connect to
MongoDB, and library calls default to `connect: false`. The CLI is the path
that explicitly connects to the currently configured `MONGO_URI`.

Normal reruns are insert-only for matching fixture resources. They do not
reopen an expired grant, replace a published report, or change a completed
diagnostic order. The fixture encounters, orders, and grants use deterministic
IDs for newly created records and exact patient/provider/order ownership for
existing records.

## Quick-start and manual-grant walkthroughs

### Quick-start: seeded grant path

1. Generate the PDFs and run the seed command above on a development database.
2. Start the Node server and laboratory UI.
3. Sign in to the laboratory with `LAB-DEMO01` and `+919900000020`.
4. Select a seeded active patient visit and upload the matching catalog PDF
   through the real report upload/extraction workflow.
5. For `PXDEMO002`, use **Fix & Verify** on the single platelet observation,
   entering `250000` with the stated unit and an edit reason, then publish.
6. Publish one of the normal or plausible HIGH/LOW cases and sign in to the
   matching synthetic patient with phone + terminal OTP to view the report.
7. Confirm that publication expires only that lab grant and completes only
   that diagnostic order.

To demonstrate uploading a corrected PDF instead of using **Fix & Verify**, run
`npm run demo:reset`, open the matching patient visit, and choose the matching
**Corrected** entry in the enabled synthetic selector. The files are also
available directly under `demo/reports/` as `*-corrected.pdf`. Do not upload a
corrected companion on a grant that already contains a report:
`REPORT_ALREADY_UPLOADED` is the intentional immutable-audit response.

After a report has been published, a normal seed rerun intentionally keeps the
grant expired and order completed. To prepare the exact six fixture resources
for another clean walkthrough, use the explicit reset command:

```powershell
node scripts/seedDemoData.js --confirm-demo --reset
```

The reset command is the repeatable demo reset: it removes only the preserved
reports, observations, and original PDF files belonging to the exact six
synthetic patient/order/grant chains, then reopens those grants and orders.
From `lab/server` the same action is available as:

```powershell
npm run demo:reset
```

It does not delete real patient records or unrelated reports. After resetting,
upload the six PDFs again through the laboratory UI; the seed command itself
creates accounts and grants, while the real upload endpoint creates each report
and its extracted observations.

Reset deletes preserved original report files, observations, and reports only
when they are linked to the exact synthetic patient, laboratory, order, and
grant chain. It then reactivates those exact fixture grants/orders. It never
resets every patient, order, grant, or report in the database.

### Manual grant: patient-consent path

Use this when the walkthrough needs to demonstrate consent rather than start
with a pre-seeded grant:

1. Sign in as a synthetic patient with phone + terminal OTP.
2. Scan or enter `LAB-DEMO01` in the patient UI.
3. Review the four approved identity fields and approve the laboratory grant.
4. Sign in to the laboratory with the synthetic laboratory phone/code and
   continue with the matching PDF.

The seeded quick-start already includes the six exact grants, so the patient
UI may report an existing active grant instead of creating another one. Use a
fresh fixture database or the explicit reset command before comparing the two
walkthroughs.

## UI integration contract

The development selector can consume `GET /demo-reports/catalog.json` from the
laboratory UI origin. Treat `patients[].report.file` as a filename relative to
`/demo-reports/`; display `label` and `description`; and use `scenario` plus
`expectedOutcome` for fixture hints. Fetch the selected PDF as
`/demo-reports/<file>` and submit it through the existing real upload endpoint.
The catalog is descriptive only: it must not cause the UI to insert reports or
observations directly.

Enable the catalog-based selector explicitly with
`VITE_ENABLE_DEMO_REPORT_SELECTOR=true` in the local laboratory UI environment.
It only offers the fixture matching the granted patient identity. Uploading a
second PDF on the same grant is intentionally rejected: the original is
preserved for auditability. Use a new diagnostic order/approved grant, or the
explicit fixture-only reset above for a synthetic demonstration.

## Isolated integration smoke test

From `lab/server`, with the existing database configuration and Python runtime:

```powershell
npm run demo:smoke -- --confirm-demo
```

This uses a randomly named isolated database and temporary report storage; it
does not reset the configured application database. It exercises six real PDF
uploads, correction and audit persistence, rejected invalid edits, normal and
corrected publication, structural publication blocks, duplicate rejection,
patient downloads, access expiry, and fixture lifecycle checks. Tokens and OTPs
are held in memory and not printed. On this Windows workspace, run Windows
Node and Windows Python together rather than passing WSL paths to Windows
Python.

## Runtime note

The upload path invokes the repository extraction bridge. Ensure the configured
Python runtime has the existing extraction dependencies (including numpy and
PyMuPDF). If the Node process cannot find the Windows runtime, set the
existing environment setting without putting credentials in this fixture:

```env
PYTHON_EXECUTABLE=C:\path\to\python.exe
```
