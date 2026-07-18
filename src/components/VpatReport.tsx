import { useEffect, useState } from "react";

/**
 * VPAT 2.5 INT conformance report component.
 *
 * Fetches /vpat/vpat-data.json at runtime and renders:
 * - Summary statistics (violations, passes, routes audited)
 * - Download link for the PDF (/vpat/vpat-2.5.pdf)
 * - WCAG 2.x conformance table (A/AA/AAA)
 * - Section 508 conformance table
 * - EN 301 549 conformance table
 *
 * If the data file is not found (e.g. audit not yet run), all criteria
 * show "Not Evaluated" and a notice is displayed.
 *
 * Styling uses Zudoku CSS theme variables (--background, --foreground,
 * --card, --border, --muted, --muted-foreground, --primary, etc.) so
 * the component adapts automatically to light/dark mode.
 */

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

interface AuditData {
  audit_date: string;
  axe_version: string;
  base_url: string;
  axe_tags: string[];
  routes_audited: number;
  total_violations: number;
  total_passes: number;
  total_incomplete: number;
  total_inapplicable: number;
  unique_violating_rules: string[];
  unique_passing_rules: string[];
  routes: Array<{
    route: string;
    label: string;
    violations: number;
    passes: number;
    redirected: boolean;
    final_url: string | null;
  }>;
}

type Status = "Supports" | "Partially Supports" | "Does Not Support" | "Not Evaluated";

function getConformanceStatus(
  sc: { axeRules: string[] },
  data: AuditData | null
): Status {
  if (!data) return "Not Evaluated";
  const axeRules = sc.axeRules;
  if (axeRules.length === 0) return "Not Evaluated";

  const violating = new Set(data.unique_violating_rules);
  const passing = new Set(data.unique_passing_rules);

  const hasViolation = axeRules.some((r) => violating.has(r));
  const allPass = axeRules.every((r) => passing.has(r));

  if (hasViolation) return "Partially Supports";
  if (allPass) return "Supports";
  return "Not Evaluated";
}

const STATUS_COLORS: Record<Status, string> = {
  "Supports": "#16a34a",
  "Partially Supports": "#d97706",
  "Does Not Support": "#dc2626",
  "Not Evaluated": "#6b7280",
};

const STATUS_LABELS: Record<Status, string> = {
  "Supports": "Supports",
  "Partially Supports": "Partially Supports",
  "Does Not Support": "Does Not Support",
  "Not Evaluated": "Not Evaluated",
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      style={{
        color: STATUS_COLORS[status],
        fontWeight: 600,
        fontSize: "0.85em",
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function VpatReport() {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/vpat/vpat-data.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: AuditData) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>Loading VPAT audit data…</p>;
  }

  if (error) {
    return (
      <div
        style={{
          padding: "1rem",
          border: "1px solid var(--destructive)",
          borderRadius: "var(--radius)",
          backgroundColor: "color-mix(in srgb, var(--destructive) 10%, transparent)",
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: "var(--foreground)" }}>
          VPAT audit data not available
        </p>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.9em", color: "var(--muted-foreground)" }}>
          The file <code>/vpat/vpat-data.json</code> could not be loaded ({error}).
          All criteria below are marked "Not Evaluated". Run the axe audit in the
          FE repo (<code>pnpm run test:a11y</code>) to generate the data.
        </p>
      </div>
    );
  }

  const auditDate = data
    ? new Date(data.audit_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div>
      {/* Download banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 1.5rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          backgroundColor: "var(--card)",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--foreground)" }}>
            VPAT 2.5 INT — Primebrick Frontend
          </p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.85em", color: "var(--muted-foreground)" }}>
            Audit date: {auditDate} · Axe-core v{data?.axe_version} · {data?.routes_audited} routes audited
          </p>
        </div>
        <a
          href="/vpat/vpat-2.5.pdf"
          download
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
            textDecoration: "none",
            borderRadius: "calc(var(--radius) - 0.125rem)",
            fontWeight: 600,
            fontSize: "0.9em",
          }}
        >
          ⬇ Download PDF
        </a>
      </div>

      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {[
          { label: "Violations", value: data?.total_violations ?? 0, color: "#dc2626" },
          { label: "Passes", value: data?.total_passes ?? 0, color: "#16a34a" },
          { label: "Incomplete", value: data?.total_incomplete ?? 0, color: "#d97706" },
          { label: "Inapplicable", value: data?.total_inapplicable ?? 0, color: "#6b7280" },
          { label: "Routes", value: data?.routes_audited ?? 0, color: "var(--primary)" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "1rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              textAlign: "center",
              backgroundColor: "var(--card)",
            }}
          >
            <div style={{ fontSize: "1.75rem", fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
            <div style={{ fontSize: "0.8em", color: "var(--muted-foreground)", marginTop: "0.25rem" }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* WCAG 2.x table */}
      <h2 id="wcag-2x-conformance">Section 1: WCAG 2.x Conformance</h2>
      <p style={{ fontSize: "0.9em", color: "var(--muted-foreground)" }}>
        All WCAG 2.2 success criteria with their conformance status. Criteria
        marked "Not Evaluated" require manual review (no automated axe rule
        covers them).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}>
              <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>SC</th>
              <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Level</th>
              <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Success Criterion</th>
              <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Conformance</th>
              <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {WCAG_SC.map((sc, i) => {
              const status = getConformanceStatus(sc, data);
              let remarks = "";
              if (status === "Supports") {
                remarks = `Axe rules passed: ${sc.axeRules.join(", ")}`;
              } else if (status === "Partially Supports") {
                const violating = sc.axeRules.filter((r) =>
                  data?.unique_violating_rules.includes(r)
                );
                remarks = `Violations in: ${violating.join(", ")}`;
              } else if (status === "Not Evaluated" && sc.axeRules.length > 0) {
                remarks = "Some rules incomplete/inapplicable";
              } else {
                remarks = "Manual review required";
              }
              return (
                <tr key={sc.num} style={{ backgroundColor: i % 2 === 1 ? "var(--muted)" : "var(--background)" }}>
                  <td style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--border)", fontWeight: 600, color: "var(--foreground)" }}>{sc.num}</td>
                  <td style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--border)", color: "var(--foreground)" }}>{sc.level}</td>
                  <td style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--border)", color: "var(--foreground)" }}>{sc.title}</td>
                  <td style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--border)" }}>
                    <StatusBadge status={status} />
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem", border: "1px solid var(--border)", fontSize: "0.9em", color: "var(--muted-foreground)" }}>
                    {remarks}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Section 508 */}
      <h2 id="section-508">Section 2: Section 508 Conformance</h2>
      <p style={{ fontSize: "0.9em", color: "var(--muted-foreground)" }}>
        Section 508 (2017) Chapter 3 references WCAG 2.0 Level A/AA. Chapters 4,
        5, and 6 require manual evaluation.
      </p>
      <Section508Table data={data} />

      {/* EN 301 549 */}
      <h2 id="en-301-549">Section 3: EN 301 549 Conformance</h2>
      <p style={{ fontSize: "0.9em", color: "var(--muted-foreground)" }}>
        EN 301 549 v3.2.1 Clause 5 and 8 reference WCAG 2.1 Level A/AA.
        Other clauses require manual evaluation.
      </p>
      <En301549Table data={data} />

      {/* Methodology */}
      <h2 id="methodology">Methodology and Limitations</h2>
      <ol style={{ fontSize: "0.9em", lineHeight: 1.6, color: "var(--foreground)" }}>
        <li>
          <strong>Automated Testing:</strong> This report is generated from
          automated axe-core scans using @axe-core/playwright. Axe-core
          version {data?.axe_version} was used with tags: {data?.axe_tags.join(", ")}.
        </li>
        <li>
          <strong>Routes Audited:</strong> {data?.routes_audited} routes were
          scanned including login, welcome, customer management, CRM pipeline,
          and all system settings pages.
        </li>
        <li>
          <strong>Coverage Limitations:</strong> Axe-core covers approximately
          50 of 86 WCAG 2.2 success criteria automatically. Success criteria
          not covered by axe rules are marked "Not Evaluated" and require
          manual review.
        </li>
        <li>
          <strong>Conformance Status Definitions:</strong>
          <ul>
            <li><strong>Supports:</strong> All automated axe rules for this criterion passed on all audited routes.</li>
            <li><strong>Partially Supports:</strong> At least one axe rule violation was detected on one or more routes.</li>
            <li><strong>Does Not Support:</strong> All axe rules failed (no route passed).</li>
            <li><strong>Not Evaluated:</strong> No automated axe rule covers this criterion; manual review required.</li>
          </ul>
        </li>
        <li>
          <strong>Remediation Priority:</strong> Violations should be remediated
          in order of impact: critical &gt; serious &gt; moderate &gt; minor.
          See the downloadable PDF for detailed violation information.
        </li>
        <li>
          <strong>Manual Review Required:</strong> A complete VPAT requires
          manual review of all "Not Evaluated" criteria. This includes keyboard
          navigation testing, screen reader testing, cognitive accessibility
          review, and verification of content alternatives for media.
        </li>
      </ol>
    </div>
  );
}

function Section508Table({ data }: { data: AuditData | null }) {
  const criteria = [
    { chapter: "3", title: "Technical Criteria (WCAG 2.0 A/AA)", scRefs: WCAG_SC.filter((sc) => sc.level === "A" || sc.level === "AA") },
    { chapter: "4", title: "Functional Performance Criteria", scRefs: [] },
    { chapter: "5", title: "Interoperability", scRefs: [] },
    { chapter: "6", title: "Content", scRefs: [] },
  ];

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
        <thead>
          <tr style={{ backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}>
            <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Chapter</th>
            <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Criteria</th>
            <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Conformance</th>
            <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => {
            let status: Status = "Not Evaluated";
            let remarks = "Manual review required";
            if (c.scRefs.length > 0) {
              const statuses = c.scRefs.map((sc) => getConformanceStatus(sc, data));
              if (statuses.every((s) => s === "Supports")) {
                status = "Supports";
                remarks = `All ${c.scRefs.length} WCAG SCs passed`;
              } else if (statuses.some((s) => s === "Partially Supports")) {
                status = "Partially Supports";
                const partial = c.scRefs.filter(
                  (sc) => getConformanceStatus(sc, data) === "Partially Supports"
                );
                remarks = `Violations in ${partial.length} SCs`;
              } else if (statuses.some((s) => s === "Supports")) {
                status = "Partially Supports";
                remarks = "Some SCs passed, others not evaluated";
              }
            }
            return (
              <tr key={c.chapter} style={{ backgroundColor: i % 2 === 1 ? "var(--muted)" : "var(--background)" }}>
                <td style={{ padding: "0.5rem", border: "1px solid var(--border)", fontWeight: 600, color: "var(--foreground)" }}>{c.chapter}</td>
                <td style={{ padding: "0.5rem", border: "1px solid var(--border)", color: "var(--foreground)" }}>{c.title}</td>
                <td style={{ padding: "0.5rem", border: "1px solid var(--border)" }}>
                  <StatusBadge status={status} />
                </td>
                <td style={{ padding: "0.5rem", border: "1px solid var(--border)", fontSize: "0.9em", color: "var(--muted-foreground)" }}>
                  {remarks}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function En301549Table({ data }: { data: AuditData | null }) {
  const criteria = [
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

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9em" }}>
        <thead>
          <tr style={{ backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" }}>
            <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Clause</th>
            <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Requirements</th>
            <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Conformance</th>
            <th style={{ padding: "0.5rem", textAlign: "left", border: "1px solid var(--border)" }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, i) => {
            let status: Status = "Not Evaluated";
            let remarks = "Manual review required";
            if (c.scRefs.length > 0) {
              const statuses = c.scRefs.map((sc) => getConformanceStatus(sc, data));
              if (statuses.every((s) => s === "Supports")) {
                status = "Supports";
                remarks = `All ${c.scRefs.length} WCAG SCs passed`;
              } else if (statuses.some((s) => s === "Partially Supports")) {
                status = "Partially Supports";
                const partial = c.scRefs.filter(
                  (sc) => getConformanceStatus(sc, data) === "Partially Supports"
                );
                remarks = `Violations in ${partial.length} SCs`;
              } else if (statuses.some((s) => s === "Supports")) {
                status = "Partially Supports";
                remarks = "Some SCs passed, others not evaluated";
              }
            }
            return (
              <tr key={c.clause} style={{ backgroundColor: i % 2 === 1 ? "var(--muted)" : "var(--background)" }}>
                <td style={{ padding: "0.5rem", border: "1px solid var(--border)", fontWeight: 600, color: "var(--foreground)" }}>{c.clause}</td>
                <td style={{ padding: "0.5rem", border: "1px solid var(--border)", color: "var(--foreground)" }}>{c.title}</td>
                <td style={{ padding: "0.5rem", border: "1px solid var(--border)" }}>
                  <StatusBadge status={status} />
                </td>
                <td style={{ padding: "0.5rem", border: "1px solid var(--border)", fontSize: "0.9em", color: "var(--muted-foreground)" }}>
                  {remarks}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
