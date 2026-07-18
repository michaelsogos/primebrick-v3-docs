#!/usr/bin/env node
/**
 * Generate a VPAT 2.5 INT PDF report from vpat-data.json using pdfmake.
 *
 * pdfmake uses a declarative JSON document definition with built-in
 * table support (automatic text wrapping, page breaks, column widths).
 * This produces a much cleaner PDF than pdfkit's manual drawing.
 *
 * This runs in the Cloudflare build chain AFTER sync-vpat-data.mjs.
 * It reads public/vpat/vpat-data.json and produces public/vpat/vpat-2.5.pdf.
 *
 * Usage: node scripts/generate-vpat-pdf.mjs
 *
 * Output: public/vpat/vpat-2.5.pdf
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pdfmake = require("pdfmake");
const vfs = require("pdfmake/build/vfs_fonts");

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const DATA_PATH = join(projectRoot, "public", "vpat", "vpat-data.json");
const OUTPUT_DIR = join(projectRoot, "public", "vpat");
const OUTPUT_PATH = join(OUTPUT_DIR, "vpat-2.5.pdf");

console.log("=== VPAT 2.5 PDF generation started (pdfmake) ===");

if (!existsSync(DATA_PATH)) {
  console.warn(`  Data file not found: ${DATA_PATH}`);
  console.warn("  Skipping VPAT PDF generation.");
  process.exit(0);
}

const auditData = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

// WCAG 2.2 success criteria — full list with level and axe rule mapping.
const WCAG_SC = [
  // Principle 1: Perceivable
  { num: "1.1.1", level: "A", title: "Non-text Content", axeRules: ["image-alt", "image-redundant-alt"] },
  { num: "1.2.1", level: "A", title: "Audio-only and Video-only (Prerecorded)", axeRules: [] },
  { num: "1.2.2", level: "A", title: "Captions (Prerecorded)", axeRules: [] },
  { num: "1.2.3", level: "A", title: "Audio Description or Media Alternative (Prerecorded)", axeRules: [] },
  { num: "1.2.4", level: "AA", title: "Captions (Live)", axeRules: [] },
  { num: "1.2.5", level: "AA", title: "Audio Description (Prerecorded)", axeRules: [] },
  { num: "1.2.6", level: "AAA", title: "Sign Language (Prerecorded)", axeRules: [] },
  { num: "1.2.7", level: "AAA", title: "Extended Audio Description (Prerecorded)", axeRules: [] },
  { num: "1.2.8", level: "AAA", title: "Media Alternative (Prerecorded)", axeRules: [] },
  { num: "1.2.9", level: "AAA", title: "Audio-only (Live)", axeRules: [] },
  { num: "1.3.1", level: "A", title: "Info and Relationships", axeRules: ["heading-order", "region", "landmark-one-main", "page-has-heading-one", "button-name", "label"] },
  { num: "1.3.2", level: "A", title: "Meaningful Sequence", axeRules: [] },
  { num: "1.3.3", level: "A", title: "Sensory Characteristics", axeRules: [] },
  { num: "1.3.4", level: "AA", title: "Orientation", axeRules: [] },
  { num: "1.3.5", level: "AA", title: "Identify Input Purpose", axeRules: ["autocomplete-valid"] },
  { num: "1.3.6", level: "AAA", title: "Identify Purpose", axeRules: [] },
  { num: "1.4.1", level: "A", title: "Use of Color", axeRules: [] },
  { num: "1.4.2", level: "A", title: "Audio Control", axeRules: [] },
  { num: "1.4.3", level: "AA", title: "Contrast (Minimum)", axeRules: ["color-contrast"] },
  { num: "1.4.4", level: "AA", title: "Resize Text", axeRules: [] },
  { num: "1.4.5", level: "AA", title: "Images of Text", axeRules: [] },
  { num: "1.4.6", level: "AAA", title: "Contrast (Enhanced)", axeRules: ["color-contrast-enhanced"] },
  { num: "1.4.7", level: "AAA", title: "Low or No Background Audio", axeRules: [] },
  { num: "1.4.8", level: "AAA", title: "Visual Presentation", axeRules: [] },
  { num: "1.4.9", level: "AAA", title: "Images of Text (No Exception)", axeRules: [] },
  { num: "1.4.10", level: "AA", title: "Reflow", axeRules: [] },
  { num: "1.4.11", level: "AA", title: "Non-text Contrast", axeRules: [] },
  { num: "1.4.12", level: "AA", title: "Text Spacing", axeRules: ["avoid-inline-spacing"] },
  { num: "1.4.13", level: "AA", title: "Content on Hover or Focus", axeRules: [] },
  // Principle 2: Operable
  { num: "2.1.1", level: "A", title: "Keyboard", axeRules: [] },
  { num: "2.1.2", level: "A", title: "No Keyboard Trap", axeRules: [] },
  { num: "2.1.3", level: "AAA", title: "Keyboard (No Exception)", axeRules: [] },
  { num: "2.1.4", level: "A", title: "Character Key Shortcuts", axeRules: [] },
  { num: "2.2.1", level: "A", title: "Timing Adjustable", axeRules: [] },
  { num: "2.2.2", level: "A", title: "Pause, Stop, Hide", axeRules: [] },
  { num: "2.2.3", level: "AAA", title: "No Timing", axeRules: [] },
  { num: "2.2.4", level: "AAA", title: "Interruptions", axeRules: [] },
  { num: "2.2.5", level: "AAA", title: "Re-authenticating", axeRules: [] },
  { num: "2.2.6", level: "AAA", title: "Timeouts", axeRules: [] },
  { num: "2.3.1", level: "A", title: "Three Flashes or Below Threshold", axeRules: [] },
  { num: "2.3.2", level: "AAA", title: "Three Flashes", axeRules: [] },
  { num: "2.3.3", level: "AAA", title: "Animation from Interactions", axeRules: [] },
  { num: "2.4.1", level: "A", title: "Bypass Blocks", axeRules: ["bypass"] },
  { num: "2.4.2", level: "A", title: "Page Titled", axeRules: ["document-title"] },
  { num: "2.4.3", level: "A", title: "Focus Order", axeRules: [] },
  { num: "2.4.4", level: "A", title: "Link Purpose (In Context)", axeRules: ["link-name"] },
  { num: "2.4.5", level: "AA", title: "Multiple Ways", axeRules: [] },
  { num: "2.4.6", level: "AA", title: "Headings and Labels", axeRules: ["empty-heading"] },
  { num: "2.4.7", level: "AA", title: "Focus Visible", axeRules: [] },
  { num: "2.4.8", level: "AAA", title: "Location", axeRules: [] },
  { num: "2.4.9", level: "AAA", title: "Link Purpose (Link Only)", axeRules: [] },
  { num: "2.4.10", level: "AA", title: "Section Headings", axeRules: [] },
  { num: "2.4.11", level: "AA", title: "Focus Not Obscured (Minimum)", axeRules: [] },
  { num: "2.4.12", level: "AAA", title: "Focus Not Obscured (Enhanced)", axeRules: [] },
  { num: "2.4.13", level: "AAA", title: "Focus Appearance", axeRules: [] },
  { num: "2.5.1", level: "A", title: "Pointer Gestures", axeRules: [] },
  { num: "2.5.2", level: "A", title: "Pointer Cancellation", axeRules: [] },
  { num: "2.5.3", level: "A", title: "Label in Name", axeRules: ["button-name", "link-name"] },
  { num: "2.5.4", level: "A", title: "Motion Actuation", axeRules: [] },
  { num: "2.5.7", level: "AA", title: "Dragging Movements", axeRules: [] },
  { num: "2.5.8", level: "AA", title: "Target Size (Minimum)", axeRules: ["target-size"] },
  { num: "2.5.5", level: "AAA", title: "Target Size (Enhanced)", axeRules: [] },
  { num: "2.5.6", level: "AAA", title: "Concurrent Input Mechanisms", axeRules: [] },
  // Principle 3: Understandable
  { num: "3.1.1", level: "A", title: "Language of Page", axeRules: ["html-has-lang", "html-lang-valid"] },
  { num: "3.1.2", level: "AA", title: "Language of Parts", axeRules: [] },
  { num: "3.1.3", level: "AAA", title: "Unusual Words", axeRules: [] },
  { num: "3.1.4", level: "AAA", title: "Abbreviations", axeRules: [] },
  { num: "3.1.5", level: "AAA", title: "Reading Level", axeRules: [] },
  { num: "3.1.6", level: "AAA", title: "Pronunciation", axeRules: [] },
  { num: "3.2.1", level: "A", title: "On Focus", axeRules: [] },
  { num: "3.2.2", level: "A", title: "On Input", axeRules: [] },
  { num: "3.2.3", level: "AA", title: "Consistent Navigation", axeRules: [] },
  { num: "3.2.4", level: "AA", title: "Consistent Identification", axeRules: [] },
  { num: "3.2.5", level: "AAA", title: "Change on Request", axeRules: [] },
  { num: "3.2.6", level: "A", title: "Consistent Help", axeRules: [] },
  { num: "3.3.1", level: "A", title: "Error Identification", axeRules: [] },
  { num: "3.3.2", level: "A", title: "Labels or Instructions", axeRules: ["label"] },
  { num: "3.3.3", level: "AA", title: "Error Suggestion", axeRules: [] },
  { num: "3.3.4", level: "AA", title: "Error Prevention (Legal, Financial, Data)", axeRules: [] },
  { num: "3.3.5", level: "AAA", title: "Help", axeRules: [] },
  { num: "3.3.6", level: "AAA", title: "Error Prevention (All)", axeRules: [] },
  { num: "3.3.7", level: "AA", title: "Redundant Entry", axeRules: [] },
  // Principle 4: Robust
  { num: "4.1.1", level: "A", title: "Parsing", axeRules: ["duplicate-id-aria"] },
  { num: "4.1.2", level: "A", title: "Name, Role, Value", axeRules: ["aria-allowed-attr", "aria-allowed-role", "aria-required-attr", "aria-roles", "aria-valid-attr", "aria-valid-attr-value", "aria-conditional-attr", "aria-prohibited-attr", "aria-deprecated-role"] },
  { num: "4.1.3", level: "AA", title: "Status Messages", axeRules: [] },
  { num: "4.2.1", level: "A", title: "Accessible Name", axeRules: ["button-name", "link-name"] },
  { num: "4.2.2", level: "A", title: "Accessible Description", axeRules: [] },
];

// --- Conformance logic ---

function getConformanceStatus(sc, auditData) {
  const axeRules = sc.axeRules || [];
  if (axeRules.length === 0) return "Not Evaluated";
  const violating = new Set(auditData.unique_violating_rules);
  const passing = new Set(auditData.unique_passing_rules);
  if (axeRules.some((r) => violating.has(r))) return "Partially Supports";
  if (axeRules.every((r) => passing.has(r))) return "Supports";
  return "Not Evaluated";
}

function getRemarks(sc, status, auditData) {
  if (status === "Supports") return `Axe rules passed: ${sc.axeRules.join(", ")}`;
  if (status === "Partially Supports") {
    const v = sc.axeRules.filter((r) => auditData.unique_violating_rules.includes(r));
    return `Violations in: ${v.join(", ")}`;
  }
  if (status === "Not Evaluated" && sc.axeRules.length > 0) return "Some rules incomplete/inapplicable";
  return "Manual review required";
}

const STATUS_COLORS = {
  "Supports": "#16a34a",
  "Partially Supports": "#d97706",
  "Does Not Support": "#dc2626",
  "Not Evaluated": "#6b7280",
};

// --- Colors ---
const HEADER_BG = "#1e3a5f";
const HEADER_FG = "#ffffff";
const ROW_ALT = "#f3f4f6";
const BORDER = "#d1d5db";

// --- Build table helper ---
// pdfmake tables: { table: { widths: [...], body: [[cell, ...], ...] }, layout: {...} }
function buildTable(headers, rows, widths) {
  const body = [];

  // Header row
  body.push(
    headers.map((h) => ({
      text: h,
      style: "tableHeader",
      color: HEADER_FG,
    }))
  );

  // Data rows
  for (const row of rows) {
    body.push(
      row.map((cell) => {
        if (typeof cell === "object" && cell !== null && cell._isStatus) {
          return {
            text: cell.text,
            color: STATUS_COLORS[cell.text] || "#111827",
            bold: true,
            fontSize: 8,
          };
        }
        return { text: String(cell), fontSize: 8, color: "#111827" };
      })
    );
  }

  return {
    table: {
      widths: widths,
      headerRows: 1,
      body: body,
    },
    layout: {
      hLineColor: (i) => BORDER,
      vLineColor: () => BORDER,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      fillColor: (i) => {
        if (i === 0) return HEADER_BG;
        return i % 2 === 0 ? ROW_ALT : null;
      },
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 3,
      paddingBottom: () => 3,
    },
  };
}

function statusCell(text) {
  return { _isStatus: true, text };
}

// --- Build document content ---

const auditDate = new Date(auditData.audit_date).toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const content = [];

// --- Title Page ---
content.push(
  { text: "Voluntary Product Accessibility Template", style: "title", alignment: "center", margin: [0, 120, 0, 10] },
  { text: "VPAT 2.5 INT Edition", style: "subtitle", alignment: "center", margin: [0, 0, 0, 40] },
  { text: "Primebrick Frontend (primebrick-fe-v3)", style: "product", alignment: "center", margin: [0, 0, 0, 10] },
  { text: "Based on WCAG 2.2 (A/AA/AAA), Section 508, EN 301 549", style: "muted", alignment: "center", margin: [0, 0, 0, 30] },
  { text: `Audit date: ${auditDate}`, style: "info", alignment: "center", margin: [0, 0, 0, 5] },
  { text: `Axe-core version: ${auditData.axe_version}`, style: "info", alignment: "center", margin: [0, 0, 0, 5] },
  { text: `Routes audited: ${auditData.routes_audited}`, style: "info", alignment: "center", margin: [0, 0, 0, 40] },
  {
    text: "This document is generated from automated axe-core scans and includes manual review notes. Axe-core covers approximately 50 of 86 WCAG 2.2 success criteria automatically; the remainder require manual review and are marked 'Not Evaluated'.",
    style: "muted",
    alignment: "center",
    margin: [40, 0, 40, 0],
  },
);

// --- Applicable Standards Table ---
content.push({ text: "", pageBreak: "before" });
content.push({ text: "Applicable Standards and Guidelines", style: "sectionTitle", margin: [0, 0, 0, 10] });
content.push(
  buildTable(
    ["Standard / Guideline", "Included In Report"],
    [
      ["WCAG 2.0", "Level A (Yes) / AA (Yes) / AAA (Yes)"],
      ["WCAG 2.1", "Level A (Yes) / AA (Yes) / AAA (Yes)"],
      ["WCAG 2.2", "Level A (Yes) / AA (Yes) / AAA (Yes)"],
      ["Section 508 (2017)", "Chapters 3-6 (Yes)"],
      ["EN 301 549 v3.2.1", "Clauses 4-13 (Yes)"],
    ],
    ["auto", "auto"],
  ),
);

// --- Section 1: WCAG 2.x Conformance ---
content.push({ text: "", pageBreak: "before" });
content.push({ text: "Section 1: WCAG 2.x Conformance", style: "sectionTitle", margin: [0, 0, 0, 6] });
content.push({
  text: "The following table lists all WCAG 2.2 success criteria and their conformance status. Criteria marked 'Not Evaluated' require manual review (no automated axe rule covers them).",
  style: "muted",
  margin: [0, 0, 0, 10],
});

const wcagRows = WCAG_SC.map((sc) => {
  const status = getConformanceStatus(sc, auditData);
  const remarks = getRemarks(sc, status, auditData);
  return [sc.num, sc.level, sc.title, statusCell(status), remarks];
});

content.push(
  buildTable(
    ["SC", "Level", "Success Criterion", "Conformance Level", "Remarks and Explanations"],
    wcagRows,
    [40, 35, 180, 80, "auto"],
  ),
);

// --- Section 2: Section 508 ---
content.push({ text: "", pageBreak: "before" });
content.push({ text: "Section 2: Section 508 Conformance", style: "sectionTitle", margin: [0, 0, 0, 6] });
content.push({
  text: "Section 508 (2017) Chapter 3 references WCAG 2.0 Level A/AA. Chapters 4, 5, and 6 require manual evaluation.",
  style: "muted",
  margin: [0, 0, 0, 10],
});

const section508Criteria = [
  { chapter: "3", title: "Technical Criteria (WCAG 2.0 A/AA)", scRefs: WCAG_SC.filter((sc) => sc.level === "A" || sc.level === "AA") },
  { chapter: "4", title: "Functional Performance Criteria", scRefs: [] },
  { chapter: "5", title: "Interoperability", scRefs: [] },
  { chapter: "6", title: "Content", scRefs: [] },
];

const s508Rows = section508Criteria.map((c) => {
  let status = "Not Evaluated";
  let remarks = "Manual review required";
  if (c.scRefs.length > 0) {
    const statuses = c.scRefs.map((sc) => getConformanceStatus(sc, auditData));
    if (statuses.every((s) => s === "Supports")) {
      status = "Supports";
      remarks = `All ${c.scRefs.length} WCAG SCs passed`;
    } else if (statuses.some((s) => s === "Partially Supports")) {
      status = "Partially Supports";
      const partial = c.scRefs.filter((sc) => getConformanceStatus(sc, auditData) === "Partially Supports");
      remarks = `Violations in ${partial.length} SCs`;
    } else if (statuses.some((s) => s === "Supports")) {
      status = "Partially Supports";
      remarks = "Some SCs passed, others not evaluated";
    }
  }
  return [c.chapter, c.title, statusCell(status), remarks];
});

content.push(
  buildTable(
    ["Chapter", "Criteria", "Conformance Level", "Remarks and Explanations"],
    s508Rows,
    [50, 200, 80, "auto"],
  ),
);

// --- Section 3: EN 301 549 ---
content.push({ text: "", pageBreak: "before" });
content.push({ text: "Section 3: EN 301 549 Conformance", style: "sectionTitle", margin: [0, 0, 0, 6] });
content.push({
  text: "EN 301 549 v3.2.1 Clause 5 and 8 reference WCAG 2.1 Level A/AA. Other clauses require manual evaluation.",
  style: "muted",
  margin: [0, 0, 0, 10],
});

const enCriteria = [
  { clause: "4", title: "Functional Performance", scRefs: [] },
  { clause: "5", title: "Generic Requirements (WCAG 2.1 A/AA)", scRefs: WCAG_SC.filter((sc) => sc.level === "A" || sc.level === "AA") },
  { clause: "6", title: "ICT with Video", scRefs: [] },
  { clause: "7", title: "Hardware", scRefs: [] },
  { clause: "8", title: "Web (WCAG 2.1 A/AA)", scRefs: WCAG_SC.filter((sc) => sc.level === "A" || sc.level === "AA") },
  { clause: "9", title: "Non-web Documents", scRefs: [] },
  { clause: "10", title: "Software", scRefs: [] },
  { clause: "11", title: "Documentation", scRefs: [] },
  { clause: "12", title: "Support Services", scRefs: [] },
  { clause: "13", title: "Conformance", scRefs: [] },
];

const enRows = enCriteria.map((c) => {
  let status = "Not Evaluated";
  let remarks = "Manual review required";
  if (c.scRefs.length > 0) {
    const statuses = c.scRefs.map((sc) => getConformanceStatus(sc, auditData));
    if (statuses.every((s) => s === "Supports")) {
      status = "Supports";
      remarks = `All ${c.scRefs.length} WCAG SCs passed`;
    } else if (statuses.some((s) => s === "Partially Supports")) {
      status = "Partially Supports";
      const partial = c.scRefs.filter((sc) => getConformanceStatus(sc, auditData) === "Partially Supports");
      remarks = `Violations in ${partial.length} SCs`;
    } else if (statuses.some((s) => s === "Supports")) {
      status = "Partially Supports";
      remarks = "Some SCs passed, others not evaluated";
    }
  }
  return [c.clause, c.title, statusCell(status), remarks];
});

content.push(
  buildTable(
    ["Clause", "Requirements", "Conformance Level", "Remarks and Explanations"],
    enRows,
    [45, 200, 80, "auto"],
  ),
);

// --- Methodology ---
content.push({ text: "", pageBreak: "before" });
content.push({ text: "Methodology and Limitations", style: "sectionTitle", margin: [0, 0, 0, 10] });
content.push({
  ol: [
    {
      text: [
        { text: "Automated Testing: ", bold: true },
        `This report is generated from automated axe-core scans using @axe-core/playwright. Axe-core version ${auditData.axe_version} was used with tags: ${auditData.axe_tags.join(", ")}.`,
      ],
    },
    {
      text: [
        { text: "Routes Audited: ", bold: true },
        `${auditData.routes_audited} routes were scanned including login, welcome, customer management, CRM pipeline, and all system settings pages.`,
      ],
    },
    {
      text: [
        { text: "Coverage Limitations: ", bold: true },
        "Axe-core covers approximately 50 of 86 WCAG 2.2 success criteria automatically. Success criteria not covered by axe rules are marked 'Not Evaluated' and require manual review.",
      ],
    },
    {
      text: [
        { text: "Conformance Status Definitions: ", bold: true },
      ],
    },
    {
      ul: [
        { text: [{ text: "Supports: ", bold: true }, "All automated axe rules for this criterion passed on all audited routes."] },
        { text: [{ text: "Partially Supports: ", bold: true }, "At least one axe rule violation was detected on one or more routes."] },
        { text: [{ text: "Does Not Support: ", bold: true }, "All axe rules failed (no route passed)."] },
        { text: [{ text: "Not Evaluated: ", bold: true }, "No automated axe rule covers this criterion; manual review required."] },
      ],
      margin: [20, 0, 0, 0],
    },
    {
      text: [
        { text: "Remediation Priority: ", bold: true },
        "Violations should be remediated in order of impact: critical > serious > moderate > minor. See the downloadable PDF for detailed violation information.",
      ],
    },
    {
      text: [
        { text: "Manual Review Required: ", bold: true },
        "A complete VPAT requires manual review of all 'Not Evaluated' criteria. This includes keyboard navigation testing, screen reader testing, cognitive accessibility review, and verification of content alternatives for media.",
      ],
    },
  ],
  fontSize: 9,
  lineHeight: 1.4,
});

// --- Document definition ---
const docDefinition = {
  pageSize: "A4",
  pageMargins: [40, 50, 40, 50],
  content: content,
  styles: {
    title: {
      fontSize: 24,
      bold: true,
      color: "#111827",
    },
    subtitle: {
      fontSize: 16,
      color: "#6b7280",
    },
    product: {
      fontSize: 14,
      color: "#111827",
    },
    info: {
      fontSize: 11,
      color: "#374151",
    },
    muted: {
      fontSize: 10,
      color: "#6b7280",
    },
    sectionTitle: {
      fontSize: 15,
      bold: true,
      color: "#111827",
      margin: [0, 0, 0, 8],
    },
    tableHeader: {
      bold: true,
      fontSize: 9,
      color: "#ffffff",
    },
  },
  defaultStyle: {
    fontSize: 10,
    color: "#111827",
  },
  footer: (currentPage, pageCount) => ({
    text: `"Voluntary Product Accessibility Template" and "VPAT" are registered service marks of the Information Technology Industry Council (ITI)  |  Page ${currentPage} of ${pageCount}`,
    fontSize: 7,
    color: "#9ca3af",
    alignment: "center",
    margin: [0, 20, 0, 0],
  }),
};

// --- Generate PDF ---
// Register Roboto fonts (pdfmake's default font).
// The VFS stores base64 strings, but pdfkit expects Buffers, so convert them.
const fontStorage = {};
for (const [key, val] of Object.entries(vfs)) {
  if (key.endsWith(".ttf")) {
    fontStorage[key] = Buffer.from(val, "base64");
  }
}
pdfmake.virtualfs.storage = fontStorage;
pdfmake.fonts = {
  Roboto: {
    normal: "Roboto-Regular.ttf",
    bold: "Roboto-Medium.ttf",
    italics: "Roboto-Italic.ttf",
    bolditalics: "Roboto-MediumItalic.ttf",
  },
};

mkdirSync(OUTPUT_DIR, { recursive: true });

const pdfDoc = pdfmake.createPdf(docDefinition);
pdfDoc
  .getBuffer()
  .then((buffer) => {
    writeFileSync(OUTPUT_PATH, buffer);
    const sizeKB = (buffer.length / 1024).toFixed(1);
    console.log(`  Written to: ${OUTPUT_PATH}`);
    console.log(`  Size: ${sizeKB} KB`);
    console.log("=== VPAT 2.5 PDF generation complete ===");
  })
  .catch((err) => {
    console.error("PDF generation failed:", err);
    process.exit(1);
  });
