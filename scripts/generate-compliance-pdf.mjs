#!/usr/bin/env node
/**
 * Generate a compliance assessment PDF report from compliance-report.json
 * using pdfmake (same library as the VPAT PDF generator).
 *
 * This runs in the CI build chain AFTER compliance-scan.mjs.
 * It reads public/compliance/compliance-report.json and produces
 * public/compliance/compliance-report.pdf.
 *
 * Usage: node scripts/generate-compliance-pdf.mjs
 * Output: public/compliance/compliance-report.pdf
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

const DATA_PATH = join(projectRoot, "public", "compliance", "compliance-report.json");
const OUTPUT_DIR = join(projectRoot, "public", "compliance");
const OUTPUT_PATH = join(OUTPUT_DIR, "compliance-report.pdf");

console.log("=== Compliance PDF generation started (pdfmake) ===");

if (!existsSync(DATA_PATH)) {
  console.warn(`  Data file not found: ${DATA_PATH}`);
  console.warn("  Skipping compliance PDF generation.");
  process.exit(0);
}

const report = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

// ─── Status colors ──────────────────────────────────────────────────────
const STATUS_COLORS = {
  "compliant": "#16a34a",          // green-600
  "partially-compliant": "#ca8a04", // yellow-600
  "non-compliant": "#dc2626",       // red-600
  "not-found": "#6b7280",           // gray-500
};

const SEVERITY_COLORS = {
  "critical": "#dc2626",
  "high": "#ea580c",
  "medium": "#ca8a04",
  "low": "#6b7280",
};

// ─── Build PDF document definition ───────────────────────────────────────
const docDefinition = {
  pageSize: "A4",
  pageMargins: [40, 50, 40, 50],
  defaultStyle: {
    fontSize: 9,
    lineHeight: 1.3,
  },
  header: {
    margin: [40, 20, 40, 0],
    columns: [
      { text: "Primebrick — Automated Compliance Report", fontSize: 8, color: "#6b7280", width: "*" },
      { text: new Date(report.scanDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), fontSize: 8, color: "#6b7280", alignment: "right" },
    ],
  },
  footer: (currentPage, pageCount) => ({
    margin: [40, 0, 40, 20],
    text: `Page ${currentPage} of ${pageCount}`,
    fontSize: 8,
    color: "#9ca3af",
    alignment: "center",
  }),
  content: [
    // ─── Title ─────────────────────────────────────────────────────────
    {
      text: "Automated Compliance Assessment Report",
      fontSize: 22,
      bold: true,
      margin: [0, 0, 0, 5],
    },
    {
      text: "Primebrick v3 — Security & Compliance Posture",
      fontSize: 12,
      color: "#6b7280",
      margin: [0, 0, 0, 20],
    },

    // ─── Overall score banner ─────────────────────────────────────────
    {
      columns: [
        {
          width: "auto",
          stack: [
            {
              text: `${report.overallScore}%`,
              fontSize: 36,
              bold: true,
              color: report.overallScore >= 80 ? "#16a34a" : report.overallScore >= 60 ? "#ca8a04" : "#dc2626",
            },
            { text: "Overall Score", fontSize: 9, color: "#6b7280" },
          ],
        },
        {
          width: "*",
          margin: [20, 5, 0, 0],
          stack: [
            { text: `${report.summary.compliant} compliant · ${report.summary.partiallyCompliant} partial · ${report.summary.notFound} not found · ${report.summary.nonCompliant} non-compliant`, fontSize: 10 },
            { text: `${report.summary.totalEvidence} evidence items found across ${report.reposScanned.length} repositories`, fontSize: 9, color: "#6b7280", margin: [0, 4, 0, 0] },
            ...(report.summary.totalViolations > 0 ? [{ text: `${report.summary.totalViolations} violations detected`, fontSize: 9, color: "#dc2626", margin: [0, 2, 0, 0] }] : []),
            ...(report.summary.unpinnedDependencies > 0 ? [{ text: `${report.summary.unpinnedDependencies} unpinned dependencies`, fontSize: 9, color: "#ca8a04", margin: [0, 2, 0, 0] }] : []),
          ],
        },
      ],
      margin: [0, 0, 0, 20],
    },

    // ─── Framework scores ─────────────────────────────────────────────
    { text: "Framework Scores", fontSize: 14, bold: true, margin: [0, 0, 0, 8] },
    {
      table: {
        widths: ["auto", "*", "auto", "auto", "auto", "auto", "auto"],
        headerRows: 1,
        body: [
          [
            { text: "Framework", bold: true, fillColor: "#f3f4f6" },
            { text: "Controls", bold: true, fillColor: "#f3f4f6", alignment: "center" },
            { text: "Compliant", bold: true, fillColor: "#f3f4f6", alignment: "center" },
            { text: "Partial", bold: true, fillColor: "#f3f4f6", alignment: "center" },
            { text: "Not Found", bold: true, fillColor: "#f3f4f6", alignment: "center" },
            { text: "Non-Compliant", bold: true, fillColor: "#f3f4f6", alignment: "center" },
            { text: "Score", bold: true, fillColor: "#f3f4f6", alignment: "center" },
          ],
          ...Object.entries(report.frameworkScores).map(([name, s]) => [
            { text: name, bold: true },
            { text: String(s.totalControls), alignment: "center" },
            { text: String(s.compliant), alignment: "center", color: "#16a34a" },
            { text: String(s.partiallyCompliant), alignment: "center", color: "#ca8a04" },
            { text: String(s.notFound), alignment: "center", color: "#6b7280" },
            { text: String(s.nonCompliant), alignment: "center", color: "#dc2626" },
            { text: `${s.score}%`, alignment: "center", bold: true, color: s.score >= 80 ? "#16a34a" : s.score >= 60 ? "#ca8a04" : "#dc2626" },
          ]),
        ],
      },
      margin: [0, 0, 0, 20],
    },

    // ─── Control details ──────────────────────────────────────────────
    { text: "Control Assessment Details", fontSize: 14, bold: true, margin: [0, 0, 0, 8] },
    ...report.controls.map(control => {
      const statusColor = STATUS_COLORS[control.status] || "#6b7280";
      const sevColor = SEVERITY_COLORS[control.severity] || "#6b7280";
      return [
        // Control header
        {
          columns: [
            { text: control.title, bold: true, fontSize: 11, width: "*" },
            { text: control.status.toUpperCase().replace(/-/g, " "), fontSize: 8, bold: true, color: statusColor, alignment: "right" },
          ],
          margin: [0, 8, 0, 2],
        },
        // Control description + severity
        {
          columns: [
            { text: control.description, fontSize: 8, color: "#6b7280", width: "*" },
            { text: `[${control.severity.toUpperCase()}]`, fontSize: 7, color: sevColor, alignment: "right" },
          ],
          margin: [0, 0, 0, 2],
        },
        // Framework mappings
        {
          text: Object.entries(control.frameworks).map(([fw, ref]) => `${fw}: ${ref}`).join("  ·  "),
          fontSize: 7,
          color: "#9ca3af",
          margin: [0, 0, 0, 2],
        },
        // Evidence summary
        {
          text: `${control.evidenceCount} evidence items in ${control.reposScanned.join(", ")}` +
            (control.violationCount > 0 ? `  ·  ${control.violationCount} violations` : ""),
          fontSize: 8,
          color: control.evidenceCount > 0 ? "#374151" : "#9ca3af",
          margin: [0, 0, 0, 4],
        },
        // Top evidence items (max 3)
        ...(control.evidence.slice(0, 3).map(e => ({
          text: `  → ${e.repo}/${e.file}:${e.line}  ${e.snippet.substring(0, 80)}`,
          fontSize: 7,
          color: "#6b7280",
          margin: [0, 0, 0, 1],
        }))),
        // Violations (if any)
        ...(control.violations.slice(0, 3).map(v => ({
          text: `  ✗ ${v.repo}/${v.file}:${v.line}  ${v.snippet.substring(0, 80)}`,
          fontSize: 7,
          color: "#dc2626",
          margin: [0, 0, 0, 1],
        }))),
      ];
    }).flat(),

    // ─── Dependency issues ────────────────────────────────────────────
    ...(Object.keys(report.dependencies).length > 0 ? [
      { text: "Dependency Issues", fontSize: 14, bold: true, margin: [0, 16, 0, 8] },
      ...Object.entries(report.dependencies).map(([repo, vulns]) => ({
        text: `${repo}: ${vulns.length} unpinned dependencies`,
        fontSize: 9,
        margin: [0, 0, 0, 2],
      })),
    ] : []),

    // ─── Disclaimer ───────────────────────────────────────────────────
    { text: "", margin: [0, 20, 0, 0] },
    {
      text: "Disclaimer",
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 4],
    },
    {
      text: "This report is generated by an automated code pattern scanner. It detects the presence of security controls in the source code but does not constitute a formal compliance certification. Organizations should engage qualified auditors for official certification. The scanner maps code evidence to framework controls based on pattern matching — false positives and false negatives are possible.",
      fontSize: 8,
      color: "#6b7280",
      lineHeight: 1.4,
    },
  ],
};

// ─── Generate PDF ────────────────────────────────────────────────────────
// Register Roboto fonts (pdfmake's default font).
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
    console.log(`  Written to: ${OUTPUT_PATH} (${sizeKB} KB)`);
    console.log("=== Compliance PDF generation complete ===");
  })
  .catch((err) => {
    console.error("  PDF generation failed:", err);
    process.exit(1);
  });
