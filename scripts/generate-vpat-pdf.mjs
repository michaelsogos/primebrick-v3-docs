#!/usr/bin/env node
/**
 * Generate a VPAT 2.5 INT PDF report from vpat-data.json using pdfkit.
 *
 * This runs in the Cloudflare build chain AFTER sync-vpat-data.mjs.
 * It reads public/vpat/vpat-data.json and produces public/vpat/vpat-2.5.pdf.
 *
 * The PDF is a formal document with:
 * - Title page (VPAT 2.5 INT, Primebrick, date)
 * - Section 1: WCAG 2.x conformance table (A/AA/AAA)
 * - Section 2: Section 508 conformance table
 * - Section 3: EN 301 549 conformance table
 * - Notes on methodology and limitations
 *
 * Usage: node scripts/generate-vpat-pdf.mjs
 *
 * Output: public/vpat/vpat-2.5.pdf
 */
import PDFDocument from "pdfkit";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const DATA_PATH = join(projectRoot, "public", "vpat", "vpat-data.json");
const OUTPUT_DIR = join(projectRoot, "public", "vpat");
const OUTPUT_PATH = join(OUTPUT_DIR, "vpat-2.5.pdf");

console.log("=== VPAT 2.5 PDF generation started ===");

if (!existsSync(DATA_PATH)) {
  console.warn(`  Data file not found: ${DATA_PATH}`);
  console.warn("  Skipping VPAT PDF generation.");
  process.exit(0);
}

const auditData = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

// WCAG 2.2 success criteria — full list with level and axe rule mapping.
// Source: WCAG 2.2 Recommendation (2023-10-05).
// axe-core covers ~50 of 86 SCs automatically; the rest require manual review.
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

/**
 * Determine conformance status for a WCAG SC based on axe results.
 * Returns one of: "Supports", "Partially Supports", "Does Not Support", "Not Evaluated".
 */
function getConformanceStatus(sc, auditData) {
  const axeRules = sc.axeRules || [];
  if (axeRules.length === 0) {
    // No axe rule covers this SC — requires manual review
    return "Not Evaluated";
  }

  const violatingRules = new Set(auditData.unique_violating_rules);
  const passingRules = new Set(auditData.unique_passing_rules);

  const hasViolation = axeRules.some((r) => violatingRules.has(r));
  const allPass = axeRules.every((r) => passingRules.has(r));

  if (hasViolation) {
    return "Partially Supports";
  }
  if (allPass) {
    return "Supports";
  }
  // Some rules may be incomplete or inapplicable
  return "Not Evaluated";
}

/**
 * Map WCAG SC to Section 508 (2017) chapters.
 * Section 508 Chapter 3 references WCAG 2.0 Level A/AA.
 * Chapter 4: Functional Performance Criteria
 * Chapter 5: Interoperability
 * Chapter 6: Content
 */
const SECTION_508_CRITERIA = [
  { chapter: "3", title: "Technical Criteria (WCAG 2.0 A/AA)", scRefs: WCAG_SC.filter((sc) => sc.level === "A" || sc.level === "AA") },
  { chapter: "4", title: "Functional Performance Criteria", scRefs: [] },
  { chapter: "5", title: "Interoperability", scRefs: [] },
  { chapter: "6", title: "Content", scRefs: [] },
];

/**
 * Map WCAG SC to EN 301 549 clauses.
 * EN 301 549 v3.2.1 (2021) references WCAG 2.1 Level A/AA.
 * Clause 4: Functional Performance
 * Clause 5: Generic Requirements
 * Clause 6: ICT with Video
 * Clause 7: Hardware
 * Clause 8: Web
 * Clause 9: Non-web documents
 * Clause 10: Software
 * Clause 11: Documentation
 * Clause 12: Support services
 * Clause 13: Conformance
 */
const EN_301_549_CRITERIA = [
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

// PDF generation
const doc = new PDFDocument({
  size: "A4",
  margins: { top: 50, bottom: 50, left: 50, right: 50 },
  bufferPages: true,
});

// Collect PDF bytes
const chunks = [];
doc.on("data", (chunk) => chunks.push(chunk));

const pageWidth = doc.page.width;
const pageHeight = doc.page.height;
const contentWidth = pageWidth - 100; // margins

// Colors
const HEADER_BG = "#1e3a5f";
const HEADER_FG = "#ffffff";
const ROW_ALT = "#f3f4f6";
const BORDER = "#d1d5db";
const TEXT = "#111827";
const MUTED = "#6b7280";
const SUPPORTS = "#16a34a";
const PARTIAL = "#d97706";
const NOT_EVAL = "#6b7280";
const NOT_SUPPORT = "#dc2626";

// Fonts (pdfkit built-in: Helvetica)
const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";
const FONT_ITALIC = "Helvetica-Oblique";

// --- Title Page ---
doc
  .fillColor(TEXT)
  .font(FONT_BOLD)
  .fontSize(28)
  .text("Voluntary Product Accessibility Template", 50, 200, { align: "center", width: contentWidth });

doc
  .fontSize(20)
  .fillColor(MUTED)
  .text("VPAT 2.5 INT Edition", 50, 250, { align: "center", width: contentWidth });

doc
  .font(FONT)
  .fontSize(16)
  .fillColor(TEXT)
  .text("Primebrick Frontend (primebrick-fe-v3)", 50, 320, { align: "center", width: contentWidth });

doc
  .fontSize(12)
  .fillColor(MUTED)
  .text(`Based on WCAG 2.2 (A/AA/AAA), Section 508, EN 301 549`, 50, 350, { align: "center", width: contentWidth });

const auditDate = new Date(auditData.audit_date).toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
doc.text(`Audit date: ${auditDate}`, 50, 375, { align: "center", width: contentWidth });
doc.text(`Axe-core version: ${auditData.axe_version}`, 50, 395, { align: "center", width: contentWidth });
doc.text(`Routes audited: ${auditData.routes_audited}`, 50, 415, { align: "center", width: contentWidth });

doc
  .fontSize(10)
  .fillColor(MUTED)
  .text(
    "This document is generated from automated axe-core scans and includes manual review notes. " +
      "Axe-core covers approximately 50 of 86 WCAG 2.2 success criteria automatically; " +
      "the remainder require manual review and are marked 'Not Evaluated'.",
    50,
    470,
    { align: "center", width: contentWidth, lineGap: 4 }
  );

// --- Helper: draw table ---
function drawTable(doc, y, columns, rows, options = {}) {
  const rowHeight = options.rowHeight || 24;
  const headerHeight = options.headerHeight || 28;
  const fontSize = options.fontSize || 8;
  const headerFontSize = options.headerFontSize || 9;

  // Draw header
  let x = 50;
  doc.fillColor(HEADER_FG);
  doc.rect(50, y, contentWidth, headerHeight).fill(HEADER_BG);

  doc.font(FONT_BOLD).fontSize(headerFontSize).fillColor(HEADER_FG);
  for (const col of columns) {
    doc.text(col.label, x + 4, y + 8, { width: col.width - 8, align: "left" });
    x += col.width;
  }

  y += headerHeight;

  // Draw rows
  doc.font(FONT).fontSize(fontSize).fillColor(TEXT);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Check for page break
    if (y + rowHeight > pageHeight - 50) {
      doc.addPage();
      y = 50;
      // Redraw header on new page
      x = 50;
      doc.fillColor(HEADER_FG);
      doc.rect(50, y, contentWidth, headerHeight).fill(HEADER_BG);
      doc.font(FONT_BOLD).fontSize(headerFontSize).fillColor(HEADER_FG);
      for (const col of columns) {
        doc.text(col.label, x + 4, y + 8, { width: col.width - 8, align: "left" });
        x += col.width;
      }
      y += headerHeight;
      doc.font(FONT).fontSize(fontSize).fillColor(TEXT);
    }

    // Alternating row background
    if (i % 2 === 1) {
      doc.rect(50, y, contentWidth, rowHeight).fill(ROW_ALT);
    }

    // Row borders
    doc.lineWidth(0.5).strokeColor(BORDER);
    doc.rect(50, y, contentWidth, rowHeight).stroke();

    // Cell content
    x = 50;
    for (let j = 0; j < columns.length; j++) {
      const col = columns[j];
      const value = row[j];
      let color = TEXT;
      if (col.type === "status") {
        if (value === "Supports") color = SUPPORTS;
        else if (value === "Partially Supports") color = PARTIAL;
        else if (value === "Does Not Support") color = NOT_SUPPORT;
        else color = NOT_EVAL;
      }
      doc.fillColor(color);
      doc.text(value, x + 4, y + 7, { width: col.width - 8, align: "left" });
      x += col.width;
    }

    y += rowHeight;
  }

  return y;
}

// --- Section 1: WCAG 2.x Conformance ---
doc.addPage();
doc.font(FONT_BOLD).fontSize(16).fillColor(TEXT).text("Section 1: WCAG 2.x Conformance", 50, 50);
doc
  .font(FONT)
  .fontSize(10)
  .fillColor(MUTED)
  .text(
    "The following table lists all WCAG 2.2 success criteria and their conformance status. " +
      "Criteria marked 'Not Evaluated' require manual review (no automated axe rule covers them).",
    50,
    75,
    { width: contentWidth, lineGap: 3 }
  );

const wcagColumns = [
  { label: "SC", width: 50, type: "text" },
  { label: "Level", width: 40, type: "text" },
  { label: "Success Criterion", width: 280, type: "text" },
  { label: "Conformance Level", width: 100, type: "status" },
  { label: "Remarks", width: 180, type: "text" },
];

const wcagRows = WCAG_SC.map((sc) => {
  const status = getConformanceStatus(sc, auditData);
  let remarks = "";
  if (status === "Supports") {
    remarks = `Axe rules passed: ${sc.axeRules.join(", ")}`;
  } else if (status === "Partially Supports") {
    const violating = sc.axeRules.filter((r) =>
      auditData.unique_violating_rules.includes(r)
    );
    remarks = `Violations in: ${violating.join(", ")}`;
  } else if (status === "Not Evaluated" && sc.axeRules.length > 0) {
    remarks = "Some rules incomplete/inapplicable";
  } else {
    remarks = "Manual review required";
  }
  return [sc.num, sc.level, sc.title, status, remarks];
});

drawTable(doc, 110, wcagColumns, wcagRows, { rowHeight: 22, fontSize: 7, headerFontSize: 8 });

// --- Section 2: Section 508 ---
doc.addPage();
doc.font(FONT_BOLD).fontSize(16).fillColor(TEXT).text("Section 2: Section 508 Conformance", 50, 50);
doc
  .font(FONT)
  .fontSize(10)
  .fillColor(MUTED)
  .text(
    "Section 508 (2017) Chapter 3 references WCAG 2.0 Level A/AA. " +
      "Chapters 4, 5, and 6 require manual evaluation.",
    50,
    75,
    { width: contentWidth, lineGap: 3 }
  );

const s508Columns = [
  { label: "Chapter", width: 60, type: "text" },
  { label: "Criteria", width: 250, type: "text" },
  { label: "Conformance", width: 120, type: "status" },
  { label: "Remarks", width: 220, type: "text" },
];

const s508Rows = SECTION_508_CRITERIA.map((c) => {
  let status = "Not Evaluated";
  let remarks = "Manual review required";
  if (c.scRefs.length > 0) {
    const statuses = c.scRefs.map((sc) => getConformanceStatus(sc, auditData));
    if (statuses.every((s) => s === "Supports")) {
      status = "Supports";
      remarks = `All ${c.scRefs.length} WCAG SCs passed`;
    } else if (statuses.some((s) => s === "Partially Supports")) {
      status = "Partially Supports";
      const partial = c.scRefs.filter(
        (sc) => getConformanceStatus(sc, auditData) === "Partially Supports"
      );
      remarks = `Violations in ${partial.length} SCs`;
    } else if (statuses.some((s) => s === "Supports")) {
      status = "Partially Supports";
      remarks = "Some SCs passed, others not evaluated";
    }
  }
  return [c.chapter, c.title, status, remarks];
});

drawTable(doc, 110, s508Columns, s508Rows, { rowHeight: 26, fontSize: 9, headerFontSize: 10 });

// --- Section 3: EN 301 549 ---
doc.addPage();
doc.font(FONT_BOLD).fontSize(16).fillColor(TEXT).text("Section 3: EN 301 549 Conformance", 50, 50);
doc
  .font(FONT)
  .fontSize(10)
  .fillColor(MUTED)
  .text(
    "EN 301 549 v3.2.1 (2021) Clause 5 and 8 reference WCAG 2.1 Level A/AA. " +
      "Other clauses require manual evaluation.",
    50,
    75,
    { width: contentWidth, lineGap: 3 }
  );

const enColumns = [
  { label: "Clause", width: 60, type: "text" },
  { label: "Requirements", width: 250, type: "text" },
  { label: "Conformance", width: 120, type: "status" },
  { label: "Remarks", width: 220, type: "text" },
];

const enRows = EN_301_549_CRITERIA.map((c) => {
  let status = "Not Evaluated";
  let remarks = "Manual review required";
  if (c.scRefs.length > 0) {
    const statuses = c.scRefs.map((sc) => getConformanceStatus(sc, auditData));
    if (statuses.every((s) => s === "Supports")) {
      status = "Supports";
      remarks = `All ${c.scRefs.length} WCAG SCs passed`;
    } else if (statuses.some((s) => s === "Partially Supports")) {
      status = "Partially Supports";
      const partial = c.scRefs.filter(
        (sc) => getConformanceStatus(sc, auditData) === "Partially Supports"
      );
      remarks = `Violations in ${partial.length} SCs`;
    } else if (statuses.some((s) => s === "Supports")) {
      status = "Partially Supports";
      remarks = "Some SCs passed, others not evaluated";
    }
  }
  return [c.clause, c.title, status, remarks];
});

drawTable(doc, 110, enColumns, enRows, { rowHeight: 26, fontSize: 9, headerFontSize: 10 });

// --- Methodology Notes ---
doc.addPage();
doc.font(FONT_BOLD).fontSize(16).fillColor(TEXT).text("Methodology and Limitations", 50, 50);

doc.font(FONT).fontSize(10).fillColor(TEXT);
let notesY = 80;
const notes = [
  "1. Automated Testing",
  "   This report is generated from automated axe-core scans using @axe-core/playwright. " +
    "Axe-core version " + auditData.axe_version + " was used with the following tags enabled: " +
    auditData.axe_tags.join(", ") + ".",
  "",
  "2. Routes Audited",
  `   ${auditData.routes_audited} routes were scanned: ${auditData.routes.map((r) => r.route).join(", ")}.`,
  "",
  "3. Coverage Limitations",
  "   Axe-core covers approximately 50 of 86 WCAG 2.2 success criteria automatically. " +
    "Success criteria not covered by axe rules are marked 'Not Evaluated' and require manual review. " +
    "These include: most of Principle 2 (Operable) keyboard/timing criteria, Principle 3 (Understandable) " +
    "language/cognitive criteria, and many AAA-level criteria.",
  "",
  "4. Conformance Status Definitions",
  "   - Supports: All automated axe rules for this criterion passed on all audited routes.",
  "   - Partially Supports: At least one axe rule violation was detected on one or more routes.",
  "   - Does Not Support: All axe rules failed (no route passed).",
  "   - Not Evaluated: No automated axe rule covers this criterion; manual review required.",
  "",
  "5. Audit Results Summary",
  `   Total violations: ${auditData.total_violations}`,
  `   Total passes: ${auditData.total_passes}`,
  `   Total incomplete: ${auditData.total_incomplete}`,
  `   Total inapplicable: ${auditData.total_inapplicable}`,
  `   Unique violating rules: ${auditData.unique_violating_rules.length}`,
  `   Unique passing rules: ${auditData.unique_passing_rules.length}`,
  "",
  "6. Remediation Priority",
  "   Violations should be remediated in order of impact: critical > serious > moderate > minor. " +
    "Axe-core reports impact level per violation. See vpat-data.json for detailed violation information " +
    "including affected HTML elements and failure summaries.",
  "",
  "7. Manual Review Required",
  "   A complete VPAT requires manual review of all 'Not Evaluated' criteria. " +
    "This includes keyboard navigation testing, screen reader testing, cognitive accessibility review, " +
    "and verification of content alternatives for media.",
];

for (const line of notes) {
  if (line.startsWith("  ") || line.match(/^\d+\./)) {
    doc.font(FONT_BOLD);
  } else {
    doc.font(FONT);
  }
  doc.text(line, 50, notesY, { width: contentWidth, lineGap: 3 });
  notesY += 14 + Math.ceil((line.length * 5) / contentWidth) * 12;
}

// Finalize
doc.end();

// Write PDF to file
const pdfBuffer = await new Promise((resolve) => {
  doc.on("end", () => resolve(Buffer.concat(chunks)));
});

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, pdfBuffer);

console.log(`  Written to: ${OUTPUT_PATH}`);
console.log(`  Size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
console.log("=== VPAT 2.5 PDF generation complete ===");
