"""Generate clearly labelled, text-layer PDFs for the SwasthSetu demo.

This intentionally uses only the Python standard library so the fixture PDFs
can be regenerated before installing the extraction runtime. They are
synthetic and must never be presented as clinical records.
"""

from __future__ import annotations

import argparse
import copy
import json
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REPORTS = ROOT / "reports"
PUBLIC_REPORTS = ROOT.parent / "lab" / "ui" / "public" / "demo-reports"
CATALOG_PATH = ROOT / "catalog.json"


def pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def text_cmd(x: float, y: float, text: str, font="F1", size=9, color=(0, 0, 0)) -> str:
    r, g, b = color
    return f"{r:g} {g:g} {b:g} rg BT /{font} {size:g} Tf {x:g} {y:g} Td ({pdf_escape(text)}) Tj ET"


def rect_cmd(x: float, y: float, width: float, height: float, fill=None, stroke=None, line_width=1) -> str:
    commands = []
    if fill:
        commands.append(f"{fill[0]:g} {fill[1]:g} {fill[2]:g} rg")
    if stroke:
        commands.append(f"{stroke[0]:g} {stroke[1]:g} {stroke[2]:g} RG {line_width:g} w")
    commands.append(f"{x:g} {y:g} {width:g} {height:g} re")
    commands.append("B" if fill and stroke else "f" if fill else "S")
    return " ".join(commands)


def line_cmd(x1, y1, x2, y2, color=(0, 0, 0), line_width=1) -> str:
    return f"{color[0]:g} {color[1]:g} {color[2]:g} RG {line_width:g} w {x1:g} {y1:g} m {x2:g} {y2:g} l S"


def make_page(items: list[str]) -> bytes:
    return ("q\n" + "\n".join(items) + "\nQ\n").encode("latin-1", "replace")


def make_pdf(path: Path, pages: list[list[str]]) -> None:
    if not pages:
        raise ValueError(f"PDF must contain at least one page: {path.name}")
    streams = [make_page(page) for page in pages]
    page_count = len(streams)
    page_objects = []
    content_objects = []
    objects = [b"<< /Type /Catalog /Pages 2 0 R >>", b""]
    # Fonts are kept as separate standard PDF objects so the report renders in
    # any browser/PDF viewer without shipping binary fonts.
    objects.extend([
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold >>",
    ])
    next_object = 7
    for stream in streams:
        page_objects.append(next_object)
        content_objects.append(next_object + 1)
        objects.append(b"")
        objects.append(b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"endstream")
        next_object += 2
    kids = " ".join(f"{number} 0 R" for number in page_objects)
    objects[1] = f"<< /Type /Pages /Kids [{kids}] /Count {page_count} >>".encode()
    for index, page_number in enumerate(page_objects):
        objects[page_number - 1] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R /F4 6 0 R >> >> "
            f"/Contents {content_objects[index]} 0 R >>"
        ).encode()
    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, obj in enumerate(objects, start=1):
        offsets.append(len(output))
        output.extend(f"{number} 0 obj\n".encode())
        output.extend(obj)
        output.extend(b"\nendobj\n")
    xref = len(output)
    output.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    output.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        output.extend(f"{offset:010d} 00000 n \n".encode())
    output.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    path.write_bytes(output)


PAGE_WIDTH = 612
PAGE_HEIGHT = 792
ROW_HEIGHT = 15
TABLE_ROW_START = 503
TABLE_COLUMNS = {
    "test": (52, 310),
    "result": (318, 385),
    "unit": (394, 445),
    "reference": (452, 568),
}
SECTION_MARKERS = {
    0: "RED CELL INDICES",
    7: "WHITE CELL COUNT",
    8: "DIFFERENTIAL COUNT",
    13: "PLATELETS",
}
COLLECTION_DATE = "14 Aug 2026 09:30"
RECEIVED_DATE = "14 Aug 2026 09:45"
REPORTED_DATE = "14 Aug 2026 12:10"


def format_number(value) -> str:
    return f"{value:g}"


def marker_reference(marker: dict, patient: dict, report: dict) -> str:
    if marker["key"] in report.get("missingReferences", []):
        return "Not supplied"
    reference = marker["reference"]
    if isinstance(reference, dict):
        reference = reference[patient["gender"]]
    return f"[{format_number(reference[0])} - {format_number(reference[1])}]"


def marker_flag(marker: dict, patient: dict, report: dict, value) -> str:
    if value is None or marker["key"] in report.get("missingReferences", []):
        return ""
    reference = marker["reference"]
    if isinstance(reference, dict):
        reference = reference[patient["gender"]]
    if value < reference[0]:
        return "LOW"
    if value > reference[1]:
        return "HIGH"
    return ""


def report_rows(catalog: dict, patient: dict) -> list[dict]:
    report = patient["report"]
    values = report["values"]
    if len(values) != len(catalog["markers"]):
        raise ValueError(f"Wrong marker count: {patient['identifier']}")
    return [
        {
            "marker": marker,
            "value": value,
            "reference": marker_reference(marker, patient, report),
            "flag": marker_flag(marker, patient, report, value),
        }
        for marker, value in zip(catalog["markers"], values)
    ]


def table_row_positions(catalog: dict) -> list[tuple[dict, float]]:
    """Return each marker and its PDF baseline for column-aware checks."""
    y = TABLE_ROW_START
    positions = []
    for index, marker in enumerate(catalog["markers"]):
        if index in SECTION_MARKERS:
            y -= ROW_HEIGHT
            y -= ROW_HEIGHT
        positions.append((marker, y))
        y -= ROW_HEIGHT
    return positions


def label_value_cmd(x: float, y: float, label: str, value: str, value_x: float) -> str:
    """Draw a readable metadata pair while preserving one extraction line."""
    return (
        f"BT /F2 7.5 Tf 0.22 0.34 0.38 rg 1 0 0 1 {x:g} {y:g} Tm "
        f"({pdf_escape(label)}) Tj /F1 8.5 Tf 0.10 0.12 0.14 rg "
        f"1 0 0 1 {value_x:g} {y:g} Tm ({pdf_escape(value)}) Tj ET"
    )


def table_row_cmd(row: dict, y: float, alternate: bool) -> str:
    marker = row["marker"]
    value = row["value"]
    flag = row["flag"]
    display_name = marker["name"] if value is not None else f"Not reported: {marker['name']} (source blank)"
    value_text = format_number(value) if value is not None else "Not reported"
    row_fill = (0.985, 0.99, 0.99) if alternate else (1.0, 1.0, 1.0)
    value_color = (0.72, 0.12, 0.10) if flag else (0.10, 0.12, 0.14)
    reference_color = (0.10, 0.12, 0.14) if row["reference"] != "Not supplied" else (0.55, 0.32, 0.05)
    commands = [
        rect_cmd(40, y - 5, 532, 15, fill=row_fill),
        line_cmd(40, y - 7, 572, y - 7, (0.84, 0.88, 0.88), 0.35),
    ]
    if flag:
        commands.append(rect_cmd(40, y - 5, 4, 15, fill=(0.78, 0.18, 0.14)))
    commands.append(
        "BT /F1 8.2 Tf 0.10 0.12 0.14 rg "
        f"1 0 0 1 {TABLE_COLUMNS['test'][0]:g} {y:g} Tm ({pdf_escape(display_name)}) Tj "
        f"{value_color[0]:g} {value_color[1]:g} {value_color[2]:g} rg "
        f"1 0 0 1 {TABLE_COLUMNS['result'][0]:g} {y:g} Tm ({pdf_escape(value_text)}) Tj "
        f"0.10 0.12 0.14 rg 1 0 0 1 {TABLE_COLUMNS['unit'][0]:g} {y:g} Tm "
        f"({pdf_escape(marker['unit'])}) Tj {reference_color[0]:g} {reference_color[1]:g} "
        f"{reference_color[2]:g} rg 1 0 0 1 {TABLE_COLUMNS['reference'][0]:g} {y:g} Tm "
        f"({pdf_escape(row['reference'])}) Tj ET"
    )
    return " ".join(commands)


def section_cmd(title: str, y: float) -> str:
    return " ".join([
        rect_cmd(40, y - 5, 532, 15, fill=(0.88, 0.95, 0.96)),
        text_cmd(52, y, title, "F2", 8.1, (0.04, 0.25, 0.34)),
    ])


def report_lines(catalog: dict, patient: dict) -> list[str]:
    """Return parser-friendly visible row equivalents for compatibility checks."""
    report = patient["report"]
    lines = [
        "SYNTHETIC DEMONSTRATION REPORT - NOT FOR CLINICAL USE",
        f"{catalog['laboratory']['name']} | COMPLETE BLOOD COUNT (CBC)",
        f"Patient: {patient['name']}",
        f"Patient ID: {patient['identifier']} | Sample ID: {report['sampleId']}",
        f"Age / Sex: {patient['age']} Years/{patient['gender']}",
        f"Phone: {patient['phone']}",
        "Test Name | Result | Unit | Reference Interval",
    ]
    for row in report_rows(catalog, patient):
        marker = row["marker"]
        if row["value"] is None:
            continue
        reference_suffix = "" if row["reference"] == "Not supplied" else f" {row['reference']}"
        lines.append(f"{marker['name']}: {format_number(row['value'])} {marker['unit']}{reference_suffix}")
    lines += ["END OF REPORT RESULTS", f"SYNTHETIC SCENARIO: {report['scenario'].upper()}"]
    if report.get("correctionEvidence"):
        evidence = report["correctionEvidence"]
        lines += [
            "SYNTHETIC ANALYZER CORRECTION EVIDENCE - REVIEW APPENDIX ONLY",
            f"Observed source value for the platelet analyte: 15 {evidence['unit']}",
            f"Synthetic analyzer rerun evidence: {evidence['value']:g} {evidence['unit']}",
            "Correct the existing observation after review; do not create another test.",
        ]
    return lines


def report_header(catalog: dict, page_label: str) -> list[str]:
    return [
        rect_cmd(0, 744, PAGE_WIDTH, 48, fill=(0.04, 0.22, 0.30)),
        rect_cmd(0, 744, 9, 48, fill=(0.03, 0.58, 0.60)),
        text_cmd(40, 768, "SWASTHSETU", "F2", 17, (1, 1, 1)),
        text_cmd(40, 753, catalog["laboratory"]["name"], "F1", 8.2, (0.78, 0.92, 0.93)),
        text_cmd(426, 768, "DEMO LABORATORY", "F2", 8.5, (0.84, 0.96, 0.96)),
        text_cmd(426, 753, page_label, "F2", 8, (1.0, 0.82, 0.35)),
        rect_cmd(40, 720, 532, 18, fill=(0.96, 0.80, 0.37), stroke=(0.70, 0.39, 0.06), line_width=0.7),
        text_cmd(52, 726, "SYNTHETIC DEMONSTRATION REPORT - NOT FOR CLINICAL USE", "F2", 8.2, (0.36, 0.16, 0.02)),
    ]


def footer_cmd(page_number: int, page_count: int) -> list[str]:
    return [
        text_cmd(40, 48, f"Synthetic fixture only | Page {page_number} of {page_count}", "F1", 7.5, (0.35, 0.39, 0.40)),
        text_cmd(382, 48, "No clinical or accreditation authority", "F1", 7.5, (0.35, 0.39, 0.40)),
    ]


def report_pages(catalog: dict, patient: dict) -> list[list[str]]:
    """Render one compact report, plus review evidence only when needed."""
    report = patient["report"]
    rows = report_rows(catalog, patient)
    has_appendix = bool(report.get("correctionEvidence"))
    page_count = 2 if has_appendix else 1
    expected = report["expectedOutcome"]
    review_required = expected["uploadStatus"] == "NEEDS_REVIEW"
    status = "MANUAL REVIEW REQUIRED" if review_required else "DEMO WORKFLOW READY"
    flag_count = sum(bool(row["flag"]) for row in rows)

    main = report_header(catalog, "SYNTHETIC CBC RESULT")
    main.extend([
        # This is a visible watermark, not a second text layer.
        "BT /F2 45 Tf 0.92 0.95 0.95 rg 0.707 0.707 -0.707 0.707 125 305 Tm (SYNTHETIC DEMO) Tj ET",
        rect_cmd(40, 582, 532, 127, fill=(0.96, 0.98, 0.98), stroke=(0.53, 0.72, 0.75), line_width=0.8),
        text_cmd(52, 691, "PATIENT AND SPECIMEN INFORMATION", "F2", 9, (0.04, 0.25, 0.34)),
        line_cmd(52, 682, 560, 682, (0.53, 0.72, 0.75), 0.6),
        label_value_cmd(52, 666, "Patient Name :", patient["name"], 122),
        label_value_cmd(325, 666, "Patient ID :", patient["identifier"], 388),
        label_value_cmd(52, 649, "Age / Sex :", f"{patient['age']} Years/{patient['gender']}", 122),
        label_value_cmd(325, 649, "Phone :", patient["phone"], 388),
        label_value_cmd(52, 632, "Specimen Type :", "Synthetic EDTA whole blood", 122),
        label_value_cmd(325, 632, "Sample ID :", report["sampleId"], 388),
        label_value_cmd(52, 615, "Referred By :", catalog["doctor"]["name"], 122),
        label_value_cmd(325, 615, "Collected :", COLLECTION_DATE, 388),
        label_value_cmd(52, 598, "Report Type :", "Synthetic CBC demonstration", 122),
        label_value_cmd(325, 598, "Reported :", REPORTED_DATE, 388),
        text_cmd(40, 559, "COMPLETE BLOOD COUNT (CBC)", "F2", 14, (0.04, 0.25, 0.34)),
        text_cmd(394, 560, status, "F2", 8.2, (0.70, 0.15, 0.10) if review_required else (0.04, 0.45, 0.43)),
        text_cmd(40, 546, f"Scenario: {report['scenario'].replace('-', ' ').title()}", "F1", 7.8, (0.35, 0.39, 0.40)),
        text_cmd(394, 546, f"{flag_count} synthetic range flag(s)", "F1", 7.8, (0.35, 0.39, 0.40)),
        line_cmd(40, 539, 572, 539, (0.04, 0.55, 0.58), 1.4),
        rect_cmd(40, 519, 532, 20, fill=(0.08, 0.32, 0.38), stroke=(0.04, 0.25, 0.34), line_width=0.5),
        text_cmd(52, 526, "Test", "F2", 8.2, (1, 1, 1)),
        text_cmd(318, 526, "Result", "F2", 8.2, (1, 1, 1)),
        text_cmd(394, 526, "Units", "F2", 8.2, (1, 1, 1)),
        text_cmd(452, 526, "Reference interval", "F2", 7.8, (1, 1, 1)),
    ])
    y = TABLE_ROW_START
    for index, row in enumerate(rows):
        if index in SECTION_MARKERS:
            y -= ROW_HEIGHT
            main.append(section_cmd(SECTION_MARKERS[index], y))
            y -= ROW_HEIGHT
        main.append(table_row_cmd(row, y, alternate=index % 2 == 1))
        y -= ROW_HEIGHT
    main.extend([
        rect_cmd(40, 74, 532, 52, fill=(0.96, 0.98, 0.98), stroke=(0.53, 0.72, 0.75), line_width=0.7),
        text_cmd(52, 108, "WORKFLOW STATUS", "F2", 8, (0.04, 0.25, 0.34)),
        text_cmd(52, 93, status, "F2", 9, (0.70, 0.15, 0.10) if review_required else (0.04, 0.45, 0.43)),
        text_cmd(330, 108, "AUTHORIZED SYNTHETIC DEMO QA", "F2", 8, (0.04, 0.25, 0.34)),
        text_cmd(330, 93, "Fictional workflow sign-off; not a clinical signature", "F1", 7.5, (0.35, 0.39, 0.40)),
        text_cmd(40, 78, "Red result accent = outside the synthetic reference interval; operator review remains required.", "F1", 7, (0.35, 0.39, 0.40)),
        *footer_cmd(1, page_count),
    ])
    pages = [main]

    if has_appendix:
        evidence = report["correctionEvidence"]
        appendix = report_header(catalog, "REVIEWER APPENDIX")
        appendix.extend([
            "BT /F2 45 Tf 0.92 0.95 0.95 rg 0.707 0.707 -0.707 0.707 125 305 Tm (REVIEW ONLY) Tj ET",
            rect_cmd(40, 610, 532, 85, fill=(1.0, 0.97, 0.88), stroke=(0.88, 0.70, 0.27), line_width=0.8),
            text_cmd(52, 679, "REVIEWER APPENDIX | CORRECTION EVIDENCE ONLY", "F2", 10, (0.45, 0.30, 0.02)),
            text_cmd(52, 658, f"Sample ID: {report['sampleId']} | Scenario: {report['scenario']}", "F1", 8.5),
            text_cmd(52, 642, f"Observed source value for the platelet analyte: 15 {evidence['unit']}", "F1", 9),
            text_cmd(52, 626, f"Synthetic analyzer rerun evidence: {evidence['value']:g} {evidence['unit']}", "F1", 9),
            text_cmd(40, 554, "REVIEW INSTRUCTION", "F2", 11, (0.04, 0.25, 0.34)),
            line_cmd(40, 547, 572, 547, (0.04, 0.55, 0.58), 1.2),
            text_cmd(52, 521, "Review the existing observation and apply a documented correction only after operator verification.", "F1", 9),
            text_cmd(52, 503, "This appendix is training evidence, not another test result and not a patient-care instruction.", "F1", 9),
            text_cmd(52, 485, "The source row remains unchanged until the review workflow records its correction.", "F1", 9),
            rect_cmd(40, 390, 532, 52, fill=(0.96, 0.98, 0.98), stroke=(0.53, 0.72, 0.75), line_width=0.7),
            text_cmd(52, 422, "AUTHORIZED SYNTHETIC DEMO QA", "F2", 8, (0.04, 0.25, 0.34)),
            text_cmd(52, 405, "Fictional workflow sign-off; no clinical or accreditation authority", "F1", 8.5, (0.35, 0.39, 0.40)),
            text_cmd(40, 78, "Appendix content is limited to synthetic correction evidence for reviewer training.", "F1", 7, (0.35, 0.39, 0.40)),
            *footer_cmd(2, page_count),
        ])
        pages.append(appendix)
    return pages


def _compact(text: str) -> str:
    return "".join(text.split())


def _row_words(page, y: float, pymupdf):
    target = PAGE_HEIGHT - y - 2
    words = page.get_text("words")
    return [word for word in words if abs((word[1] + word[3]) / 2 - target) <= 7]


def _column_text(words: list[tuple], column: tuple[float, float]) -> str:
    selected = [word for word in words if word[0] >= column[0] - 1 and word[2] <= column[1] + 1]
    return " ".join(word[4] for word in sorted(selected, key=lambda item: item[0]))


def verify_table_columns(catalog: dict, patient: dict, page, pymupdf) -> None:
    """Check visible row content in its four rendered columns, not line strings."""
    rows = report_rows(catalog, patient)
    positions = table_row_positions(catalog)
    for row, (marker, y) in zip(rows, positions):
        words = _row_words(page, y, pymupdf)
        assert words, f"No words on table row: {marker['key']}"
        test_text = _column_text(words, TABLE_COLUMNS["test"])
        result_text = _column_text(words, TABLE_COLUMNS["result"])
        unit_text = _column_text(words, TABLE_COLUMNS["unit"])
        reference_text = _column_text(words, TABLE_COLUMNS["reference"])
        assert marker["name"] in test_text, f"Test column mismatch: {marker['key']}"
        if row["value"] is None:
            assert "Not reported" in result_text, f"Missing result not visible: {marker['key']}"
        else:
            assert format_number(row["value"]) in result_text, f"Result column mismatch: {marker['key']}"
        assert marker["unit"] in unit_text, f"Unit column mismatch: {marker['key']}"
        if row["reference"] == "Not supplied":
            assert row["reference"] in reference_text
        else:
            assert _compact(row["reference"]) in _compact(reference_text), f"Reference column mismatch: {marker['key']}"


def verify_reports(catalog: dict) -> None:
    """Check PDF layout and the local extraction bridge without raw output."""
    import pymupdf  # Generation itself needs only the standard library.

    assert (PUBLIC_REPORTS / "catalog.json").read_bytes() == CATALOG_PATH.read_bytes()
    for patient in catalog["patients"]:
        report = patient["report"]
        expected = report["expectedOutcome"]
        path = REPORTS / report["file"]
        assert path.read_bytes() == (PUBLIC_REPORTS / report["file"]).read_bytes()
        with pymupdf.open(path) as document:
            expected_pages = 2 if report.get("correctionEvidence") else 1
            assert len(document) == expected_pages, report["file"]
            full_text = "\n".join(page.get_text() for page in document)
            assert full_text.count("SYNTHETIC DEMONSTRATION REPORT - NOT FOR CLINICAL USE") == expected_pages
            assert patient["name"] in full_text
            assert patient["identifier"] in full_text
            assert patient["phone"] in full_text
            assert report["sampleId"] in full_text
            assert "Synthetic EDTA whole blood" in full_text
            assert catalog["doctor"]["name"] in full_text
            assert COLLECTION_DATE in full_text
            assert RECEIVED_DATE not in full_text  # fixed source constant is not shown as a result field
            assert REPORTED_DATE in full_text
            assert f"{patient['age']} Years/{patient['gender']}" in full_text
            assert sum(page.get_text().count(patient["name"]) for page in document) == 1
            first_page = document[0]
            first_text = first_page.get_text()
            for section in SECTION_MARKERS.values():
                assert section in first_text
            for heading in ("Test", "Result", "Units", "Reference interval"):
                assert heading in first_text
            verify_table_columns(catalog, patient, first_page, pymupdf)
            for page in document:
                for word in page.get_text("words"):
                    assert page.rect.contains(pymupdf.Rect(word[:4])), "Clipped PDF text"
        completed = subprocess.run(
            [sys.executable, "-B", str(ROOT.parent / "extraction" / "bridge.py"), str(path)],
            cwd=ROOT.parent, capture_output=True, text=True, encoding="utf-8", timeout=60,
        )
        if completed.returncode:
            raise RuntimeError(f"Extraction bridge failed for {report['file']} (exit {completed.returncode})")
        result = json.loads(completed.stdout)
        assert result["source"]["input_type"] == "text_pdf"
        assert result["source"]["ocr_pages"] == 0
        assert result["patient"]["age_value"] == patient["age"]
        assert result["patient"]["sex"] == patient["gender"].lower()
        assert result["validation"]["status"] == expected["validationStatus"], report["file"]
        assert result["validation"]["tests_detected"] == expected["testsDetected"]
        assert result["coverage"]["status"] == expected["coverageStatus"]
        assert not result["coverage"]["duplicate_markers"]
        tests = result["tests"]
        by_name = {test["canonical_name"]: test for test in tests}
        assert len(tests) == len(by_name) == expected["observations"], report["file"]
        assert sorted(test["canonical_name"] for test in tests if test["needs_review"]) == sorted(expected["reviewMarkers"])
        for marker, value in zip(catalog["markers"], report["values"]):
            key = marker["key"]
            if value is None or key in report.get("missingReferences", []):
                assert key not in by_name  # The bridge exports only validated rows.
                continue
            assert by_name[key]["value"] == value, f"Source value changed: {report['file']} / {key}"
            assert by_name[key]["status"] == expected["flags"].get(key, "NORMAL")
            parsed_reference = by_name[key].get("reference_parsed") or {}
            reference = marker["reference"]
            if isinstance(reference, dict):
                reference = reference[patient["gender"]]
            assert parsed_reference.get("min") == reference[0]
            assert parsed_reference.get("max") == reference[1]
        if report.get("missingReferences"):
            assert any(issue["field"] == "missing_reference_range" for issue in result["validation"]["issues"])
        needs_review = bool(result["review_required"] or any(t["needs_review"] for t in tests)
                            or result["validation"]["status"] != "VALID"
                            or result["coverage"]["status"] == "INCOMPLETE" or not tests)
        assert ("NEEDS_REVIEW" if needs_review else "PROCESSING") == expected["uploadStatus"]
        assert (not needs_review) == expected["publishEligible"]
        print(f"Verified {report['file']}: columns checked; {len(tests)} observations; "
              f"{expected['validationStatus']}/{expected['coverageStatus']}; {expected['uploadStatus']}")


def corrected_companion(catalog: dict, source_patient: dict) -> tuple[dict, dict]:
    """Build an upload-ready, complete companion for every demo patient.

    The original files remain available for demonstrating review blockers. Each
    companion removes synthetic source defects and carries the same patient
    identity, so an operator can upload a clean replacement on a fresh grant.
    """
    patient = copy.deepcopy(source_patient)
    source_report = patient["report"]
    report = copy.deepcopy(source_report)
    stem = Path(source_report["file"]).stem
    report["file"] = f"{stem}-corrected.pdf"
    report["sampleId"] = f"{source_report['sampleId']}-CORRECTED"
    report["scenario"] = f"{source_report['scenario']}-corrected"
    report["label"] = f"Corrected {source_report.get('label', 'CBC')}"
    report["description"] = "Upload-ready complete synthetic companion with review defects corrected."
    report.pop("correctionEvidence", None)
    report.pop("missingReferences", None)
    report["values"] = []
    for marker in catalog["markers"]:
        reference = marker["reference"]
        if isinstance(reference, dict):
            reference = reference[patient["gender"]]
        midpoint = (reference[0] + reference[1]) / 2
        report["values"].append(int(midpoint) if midpoint.is_integer() else round(midpoint, 2))
    report["expectedOutcome"] = {
        "validationStatus": "VALID", "coverageStatus": "COMPLETE", "testsDetected": 14,
        "observations": 14, "uploadStatus": "PROCESSING", "publishEligible": True,
        "reviewMarkers": [], "flags": {},
    }
    patient["report"] = report
    return patient, report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify", action="store_true", help="Also check PDF layout and the local Python extraction bridge (requires PyMuPDF/numpy).")
    args = parser.parse_args()
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if catalog["schemaVersion"] != 1 or catalog["synthetic"] is not True:
        raise ValueError("Unsupported synthetic catalog")
    REPORTS.mkdir(parents=True, exist_ok=True)
    PUBLIC_REPORTS.mkdir(parents=True, exist_ok=True)
    for patient in catalog["patients"]:
        filename = patient["report"]["file"]
        if Path(filename).name != filename or not filename.endswith(".pdf"):
            raise ValueError("Catalog report filenames must be plain PDF filenames")
        pages = report_pages(catalog, patient)
        make_pdf(REPORTS / filename, pages)
        make_pdf(PUBLIC_REPORTS / filename, pages)
    corrected_count = 0
    for source_patient in catalog["patients"]:
        corrected_patient, corrected_report = corrected_companion(catalog, source_patient)
        corrected_pages = report_pages(catalog, corrected_patient)
        make_pdf(REPORTS / corrected_report["file"], corrected_pages)
        make_pdf(PUBLIC_REPORTS / corrected_report["file"], corrected_pages)
        corrected_count += 1
    (PUBLIC_REPORTS / "catalog.json").write_bytes(CATALOG_PATH.read_bytes())
    print(f"Generated {len(catalog['patients']) + corrected_count} synthetic PDFs in demo/reports and lab/ui/public/demo-reports.")
    if args.verify:
        verify_reports(catalog)


if __name__ == "__main__":
    main()
