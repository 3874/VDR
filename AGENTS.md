# AGENTS.md

## Goal

The goal is to extract financial statements from business reports, audit reports, and corporate tax adjustment reports into XBRL-like JSON, reproduce the original financial statements exactly from that JSON, and verify whether account relationships are accounting-consistent.

## Product Strategy

Quant-VDR should be developed as a tiered Financial Integrity OS.

The local HTML/ESM MVP is the quick and private layer. It runs in the user's browser, accepts PDF files, extracts financial statements, creates XBRL-like JSON, and supports fast review without sending documents to a server by default.

A future premium backend can use Arelle to convert the XBRL-like JSON into standards-compliant XBRL, validate it against official taxonomies such as K-IFRS, and return regulator-grade validation reports.

The local layer should prioritize accessibility, privacy, speed, and review workflows. The backend layer should provide reliability, official taxonomy mapping, calculation/formula validation, filing-ready output, and batch/API processing.

## Rules

Uploaded files must be PDFs only.

When finding financial statements, use the table of contents if the file has one, and use it to determine statement locations and finding ranges.

If there is no table of contents, use heuristic methods to locate financial statements.

Financial statements only mean:

- Balance sheet
- Income statement
- Cash flow statement
- Statement of changes in equity

Do not treat other sections as financial statement targets.
