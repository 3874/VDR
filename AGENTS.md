# AGENTS.md

## Goal

The goal is to extract financial statements from business reports, audit reports, and corporate tax adjustment reports into XBRL-like JSON, reproduce the original financial statements exactly from that JSON, and verify whether account relationships are accounting-consistent.

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
