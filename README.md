# Quant-VDR: Financial Integrity OS

**Quant-VDR** (Virtual Data Room) is a high-performance, local-first financial statement extraction and validation system. Designed to ensure absolute financial integrity, it transforms complex business reports into structured, accounting-consistent digital assets.

---

## 💎 Core Philosophy

The primary mission of Quant-VDR is to bridge the gap between unstructured financial reporting and structured data analysis with 100% fidelity.

1.  **Extract**: Convert PDF-based business reports, audit reports, and corporate tax adjustments into XBRL-like JSON structures.
2.  **Reproduce**: Ensure the original financial statements can be perfectly reconstructed from the extracted data.
3.  **Verify**: Perform rigorous cross-statement validation to ensure accounting consistency (e.g., Net Income in IS matches Retained Earnings changes in Equity).

---

## 🚀 Key Features

-   **Intelligent PDF Processing**: Automated table of contents parsing and heuristic-based section discovery.
-   **Financial Statement Targeting**: Precision focus on the four core statements:
    -   Balance Sheet (Statement of Financial Position)
    -   Income Statement (Comprehensive Income)
    -   Cash Flow Statement
    -   Statement of Changes in Equity
-   **Local-First Architecture**: Runs entirely in the browser using HTML5 and Vanilla JS. API keys are stored locally, ensuring data privacy.
-   **XBRL-Like Output**: Generates facts and dimensional data compatible with modern financial analysis tools.
-   **Integrity Dashboard**: Real-time review of document structure and extraction results.

---

## 🛠 Tech Stack

-   **Frontend**: Vanilla HTML5, Modern CSS (Glassmorphism, Dynamic Transitions).
-   **Logic**: Pure JavaScript (ES Modules).
-   **State Management**: Local reactive store with persistence.
-   **AI Integration**: Support for Google Gemini and OpenAI for deep semantic extraction.

---

## 📂 Project Structure

```text
VDR/
├── src/
│   ├── extraction/   # Logic for financial data extraction
│   ├── pdf/          # PDF rendering and parsing utilities
│   ├── validation/   # Accounting consistency check logic
│   ├── xbrl/         # XBRL fact generation and mapping
│   ├── views/        # UI components and view controllers
│   ├── store.js      # Global state management
│   ├── router.js     # Client-side navigation
│   └── main.js       # Application entry point
├── AGENTS.md         # System prompts and operational rules
└── index.html        # Main entry point
```

---

## 🚦 Getting Started

1.  **Open**: Simply open `index.html` in any modern web browser.
2.  **Configure**: Go to the **API Keys** section and provide your Gemini or OpenAI API key (stored locally).
3.  **Upload**: Navigate to **File Upload & Review** and upload your financial PDF.
4.  **Analyze**: Review the detected sections and trigger the extraction process.
5.  **Export**: Download the validated XBRL-like JSON from the **Artifacts** tab.

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.
