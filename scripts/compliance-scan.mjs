#!/usr/bin/env node
/**
 * Automated compliance scanner for Primebrick.
 *
 * Scans the shallow-cloned repos in .tmp-repo-sync/ for security-relevant
 * code patterns and maps them to compliance frameworks (ISO 27001, NIS2,
 * GDPR, CCPA). Produces a JSON report with evidence (file:line) for each
 * control.
 *
 * Runs in the CI build chain AFTER sync-repo-docs.mjs (which creates
 * .tmp-repo-sync/). Does NOT require manual input — it reads the actual
 * source code.
 *
 * Usage: node scripts/compliance-scan.mjs
 * Output: public/compliance/compliance-report.json
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const TMP_DIR = join(projectRoot, '.tmp-repo-sync');
const OUTPUT_DIR = join(projectRoot, 'public', 'compliance');
const OUTPUT_PATH = join(OUTPUT_DIR, 'compliance-report.json');

// ─── Repos to scan ──────────────────────────────────────────────────────
const REPOS = [
  { slug: 'backend', dir: 'backend', label: 'Backend (primebrick-v3-backend)' },
  { slug: 'frontend', dir: 'frontend', label: 'Frontend (primebrick-v3-frontend)' },
  { slug: 'microservices', dir: 'microservices', label: 'Microservices (primebrick-v3-microservices)' },
  { slug: 'dal', dir: 'dal', label: 'DAL (primebrick-v3-dal)' },
  { slug: 'sdk', dir: 'sdk', label: 'SDK (primebrick-v3-sdk)' },
];

// ─── File extensions to scan ────────────────────────────────────────────
const SCAN_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.svelte', '.json'];

// ─── Compliance controls ────────────────────────────────────────────────
// Each control is a code pattern check mapped to one or more frameworks.
// The scanner searches for the patterns and records evidence (file:line).
const CONTROLS = [
  {
    id: 'RBAC',
    title: 'Role-Based Access Control',
    description: 'Fine-grained permission system with role mappings',
    frameworks: {
      'ISO 27001': 'A.5.15, A.8.2, A.8.3',
      'NIS2': 'Art. 21(2)(b)',
      'GDPR': 'Art. 5(1)(f), Art. 32',
      'CCPA': '§1798.150(a)(1)',
    },
    patterns: [
      /\bRBAC\b/i, /\brole_mapping/i, /\bpermission/i, /\brequirePermission/i,
      /\bcheckPermission/i, /\bhasPermission/i, /\bPermissionError/i,
      /\bis_admin\b/i, /\brole.*check/i, /\baccess.*control/i,
    ],
    negativePatterns: [
      // If these are found, it means RBAC is bypassed somewhere
    ],
    repos: ['backend', 'frontend', 'microservices'],
    severity: 'critical',
  },
  {
    id: 'MFA',
    title: 'Multi-Factor Authentication',
    description: 'MFA enforced at the identity provider (TOTP, hardware keys, passkeys)',
    frameworks: {
      'ISO 27001': 'A.8.5',
      'NIS2': 'Art. 21(2)(j)',
      'GDPR': 'Art. 32(1)(b)',
      'CCPA': '§1798.150(a)(1)',
    },
    patterns: [
      /\bMFA\b/i, /\bmfa\b/i, /\bTOTP\b/i, /\bWebAuthn\b/i, /\bpasskey/i,
      /\bFIDO2\b/i, /\bstep.up.*auth/i, /\bre.auth/i, /\bsecurity.guard/i,
      /\bverify.*mfa/i, /\bmfa.*verif/i,
    ],
    repos: ['backend', 'frontend', 'sdk'],
    severity: 'critical',
  },
  {
    id: 'AUDIT_TRAIL',
    title: 'Audit Trail / Logging',
    description: 'Immutable audit log for all CRUD operations',
    frameworks: {
      'ISO 27001': 'A.8.15, A.8.16',
      'NIS2': 'Art. 21(2)(b)',
      'GDPR': 'Art. 30, Art. 33',
      'CCPA': '§1798.130(a)(5)(A)',
    },
    patterns: [
      /\baudit.*log/i, /\bAuditTrail\b/i, /\baudit_trail/i, /\bAuditEntity/i,
      /\bcreateAudit/i, /\bwriteAudit/i, /\baudit.*entry/i,
      /\bdelta.*calc/i, /\bAuditLog\b/i,
    ],
    repos: ['backend', 'dal'],
    severity: 'high',
  },
  {
    id: 'MULTI_TENANT',
    title: 'Multi-Tenant Data Isolation',
    description: 'Organization-level data isolation at the DAL layer',
    frameworks: {
      'ISO 27001': 'A.8.3',
      'NIS2': 'Art. 21(2)(d)',
      'GDPR': 'Art. 5(1)(c), Art. 32',
      'CCPA': '§1798.150(a)(1)',
    },
    patterns: [
      /\borganization_id/i, /\borg_id/i, /\btenant.*isolation/i,
      /\bscope.*org/i, /\bwhere.*org/i, /\bOrgScoped/i,
      /\bmulti.tenant/i, /\btenant.*context/i,
    ],
    repos: ['backend', 'dal', 'sdk'],
    severity: 'critical',
  },
  {
    id: 'SOFT_DELETE',
    title: 'Soft-Delete & Recovery',
    description: 'Records are soft-deleted (deleted_at) and can be restored',
    frameworks: {
      'GDPR': 'Art. 17, Art. 15',
      'ISO 27001': 'A.8.10',
      'NIS2': 'Art. 21(2)(c)',
    },
    patterns: [
      /\bsoft.delete/i, /\bsoftDelete\b/i, /\bdeleted_at\b/i,
      /\brestore.*record/i, /\brestoreRecord/i, /\bundelete/i,
      /\bparanoid\b/i, /\bIsDeleted\b/i,
    ],
    repos: ['backend', 'dal'],
    severity: 'medium',
  },
  {
    id: 'INPUT_VALIDATION',
    title: 'Input Validation',
    description: 'Schema-based input validation (Zod, Joi, etc.)',
    frameworks: {
      'ISO 27001': 'A.8.28, A.8.25',
      'NIS2': 'Art. 21(2)(e)',
      'GDPR': 'Art. 5(1)(c)',
      'OWASP': 'A03:2021 — Injection',
    },
    patterns: [
      /\bzod\b/i, /\bZodSchema\b/i, /\b\.parse\(/i, /\b\.safeParse\(/i,
      /\bjoi\b/i, /\bvalidate\(/i, /\bvalidation.*schema/i,
      /\bbody.*validation/i, /\binput.*valid/i,
    ],
    repos: ['backend', 'microservices', 'sdk', 'dal'],
    severity: 'high',
  },
  {
    id: 'ENCRYPTION_TRANSIT',
    title: 'Encryption in Transit (TLS/HTTPS)',
    description: 'TLS/HTTPS enforced for all API traffic',
    frameworks: {
      'ISO 27001': 'A.8.24',
      'NIS2': 'Art. 21(2)(g)',
      'GDPR': 'Art. 32(1)(a)',
      'CCPA': '§1798.150(a)(1)',
    },
    patterns: [
      /\bhttps\b/i, /\bTLS\b/i, /\bsecure.*cookie/i, /\bhttpOnly/i,
      /\bSameSite\b/i, /\bHSTS\b/i, /\bssl.*redirect/i,
      /\bsecure.*protocol/i,
    ],
    repos: ['backend', 'frontend'],
    severity: 'high',
  },
  {
    id: 'RATE_LIMITING',
    title: 'Rate Limiting',
    description: 'API rate limiting to prevent abuse and DoS',
    frameworks: {
      'NIS2': 'Art. 21(2)(c)',
      'ISO 27001': 'A.8.6',
      'OWASP': 'A04:2021 — Insecure Design',
    },
    patterns: [
      /\brate.*limit/i, /\brateLimit/i, /\bthrottle/i, /\btoo.many.request/i,
      /\b429\b/, /\bslow.*down/i,
    ],
    repos: ['backend', 'microservices'],
    severity: 'medium',
  },
  {
    id: 'JWT_AUTH',
    title: 'JWT Authentication',
    description: 'Short-lived JWT access tokens with refresh token rotation',
    frameworks: {
      'ISO 27001': 'A.8.5',
      'NIS2': 'Art. 21(2)(j)',
      'GDPR': 'Art. 32(1)(b)',
      'OWASP': 'A07:2021 — Auth Failures',
    },
    patterns: [
      /\bJWT\b/i, /\bjwt\b/i, /\baccess_token/i, /\brefresh_token/i,
      /\bbearer\b/i, /\bverify.*token/i, /\btoken.*verify/i,
      /\bjsonwebtoken\b/i, /\bjwt.*sign/i, /\bjwt.*verify/i,
    ],
    repos: ['backend', 'frontend', 'sdk', 'microservices'],
    severity: 'high',
  },
  {
    id: 'OAUTH_OIDC',
    title: 'OAuth 2.0 / OIDC Identity Provider',
    description: 'Delegated authentication via Casdoor/OIDC',
    frameworks: {
      'ISO 27001': 'A.8.5',
      'NIS2': 'Art. 21(2)(j)',
      'GDPR': 'Art. 32(1)(b)',
    },
    patterns: [
      /\bOAuth\b/i, /\bOIDC\b/i, /\bOpenID\b/i, /\bCasdoor\b/i,
      /\bauthorization.*code/i, /\bauth.*flow/i, /\bclient_id\b/i,
      /\bclient_secret\b/i, /\btoken.*endpoint/i, /well-known.*oauth/i,
    ],
    repos: ['backend', 'frontend', 'sdk'],
    severity: 'high',
  },
  {
    id: 'PARAMETERIZED_QUERIES',
    title: 'Parameterized Queries (SQL Injection Prevention)',
    description: 'All database queries use parameterized inputs',
    frameworks: {
      'ISO 27001': 'A.8.28',
      'OWASP': 'A03:2021 — Injection',
      'NIS2': 'Art. 21(2)(e)',
    },
    patterns: [
      /\bparameterized/i, /\bquery.*builder/i, /\bQueryBuilder\b/i,
      /\bprepared.*statement/i, /\bplaceholder/i, /\b\$1\b/, /\b\$2\b/,
      /\bpg.*query/i, /\bpool.*query/i, /\bclient.*query/i,
    ],
    repos: ['backend', 'dal'],
    severity: 'critical',
  },
  {
    id: 'SECRETS_MANAGEMENT',
    title: 'Secrets Management',
    description: 'No hardcoded secrets; secrets loaded from environment',
    frameworks: {
      'ISO 27001': 'A.5.17',
      'NIS2': 'Art. 21(2)(g)',
      'OWASP': 'A02:2021 — Cryptographic Failures',
    },
    patterns: [
      /\bprocess\.env\b/i, /\bgetEnv\b/i, /\bENV\b/i, /\bdotenv\b/i,
      /\bconfig.*env/i, /\bsecret.*env/i, /\bkey.*env/i,
    ],
    negativePatterns: [
      // Flag hardcoded secrets (password = "...")
      /password\s*[:=]\s*["'][^"']{4,}["']/i,
      /secret\s*[:=]\s*["'][^"']{8,}["']/i,
      /api[_-]?key\s*[:=]\s*["'][^"']{10,}["']/i,
    ],
    repos: ['backend', 'frontend', 'microservices', 'sdk', 'dal'],
    severity: 'critical',
  },
  {
    id: 'CORS_CONFIG',
    title: 'CORS Configuration',
    description: 'Proper CORS configuration to restrict cross-origin access',
    frameworks: {
      'ISO 27001': 'A.8.23',
      'OWASP': 'A05:2021 — Security Misconfiguration',
    },
    patterns: [
      /\bCORS\b/i, /\bcors\b/i, /\bAccess-Control-Allow-Origin/i,
      /\ballowed.*origin/i, /\borigin.*whitelist/i,
    ],
    repos: ['backend', 'microservices'],
    severity: 'medium',
  },
  {
    id: 'HEALTH_CHECKS',
    title: 'Health Checks & Monitoring',
    description: 'Service health endpoints and monitoring',
    frameworks: {
      'NIS2': 'Art. 21(2)(c)',
      'ISO 27001': 'A.8.16',
    },
    patterns: [
      /\bhealth.*check/i, /\bhealthCheck/i, /\/health\b/i,
      /\/healthz\b/i, /\/ready\b/i, /\/readiness/i, /\/liveness/i,
      /\bservice.*registry/i, /\bheartbeat/i,
    ],
    repos: ['backend', 'microservices', 'sdk'],
    severity: 'low',
  },
  {
    id: 'SERVICE_REGISTRY',
    title: 'Service Registry & Discovery',
    description: 'Microservices register via NATS for dynamic discovery',
    frameworks: {
      'NIS2': 'Art. 21(2)(d)',
      'ISO 27001': 'A.5.23',
    },
    patterns: [
      /\bservice.*registry/i, /\bserviceRegistry/i, /\bNATS\b/i, /\bnats\b/i,
      /\bregister.*service/i, /\bservice.*register/i, /\bmicroservice.*standard/i,
    ],
    repos: ['backend', 'microservices', 'sdk'],
    severity: 'low',
  },
  {
    id: 'ERROR_HANDLING',
    title: 'Structured Error Handling',
    description: 'Centralized error handling with proper HTTP status codes',
    frameworks: {
      'ISO 27001': 'A.8.25',
      'OWASP': 'A09:2021 — Security Logging',
    },
    patterns: [
      /\bApiError\b/i, /\bapiError\b/i, /\berror.*handler/i, /\berrorHandler/i,
      /\bAppError\b/i, /\bHttpError\b/i, /\berror.*middleware/i,
      /\bstatusCode\b/i, /\berror.*code\b/i,
    ],
    repos: ['backend', 'microservices', 'sdk'],
    severity: 'low',
  },
  {
    id: 'DATA_MINIMIZATION',
    title: 'Data Minimization (Field-Level Access)',
    description: 'API responses only include fields the user is authorized to see',
    frameworks: {
      'GDPR': 'Art. 5(1)(c)',
      'ISO 27001': 'A.8.3',
      'CCPA': '§1798.100(d)',
    },
    patterns: [
      /\bfield.*level/i, /\bfieldLevel/i, /\bselect.*field/i,
      /\bexclude.*field/i, /\bstrip.*field/i, /\bfilter.*field/i,
      /\bvisible.*field/i, /\bauthorized.*field/i,
    ],
    repos: ['backend', 'dal'],
    severity: 'medium',
  },
];

// ─── Scanner ────────────────────────────────────────────────────────────

/**
 * Recursively collect all source files in a directory.
 */
function collectFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip node_modules, dist, .git, .next, build
      if (['node_modules', 'dist', '.git', '.next', 'build', '.svelte-kit'].includes(entry)) continue;
      collectFiles(fullPath, files);
    } else {
      const ext = entry.substring(entry.lastIndexOf('.'));
      if (SCAN_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

/**
 * Scan a single file for pattern matches.
 * Returns an array of { pattern, line, snippet } matches.
 */
function scanFile(filePath, patterns) {
  const matches = [];
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        matches.push({
          line: i + 1,
          snippet: line.trim().substring(0, 120),
        });
        break; // one match per line is enough
      }
    }
  }
  return matches;
}

/**
 * Scan a single file for negative patterns (red flags).
 */
function scanFileNegative(filePath, patterns) {
  const violations = [];
  if (!patterns || patterns.length === 0) return violations;
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        violations.push({
          line: i + 1,
          snippet: line.trim().substring(0, 120),
        });
        break;
      }
    }
  }
  return violations;
}

/**
 * Determine compliance status from evidence.
 */
function getStatus(positiveMatches, negativeMatches, expectedRepos, scannedRepos) {
  if (negativeMatches.length > 0) return 'non-compliant';
  if (positiveMatches.length === 0) return 'not-found';
  if (positiveMatches.length >= 3) return 'compliant';
  if (positiveMatches.length >= 1) return 'partially-compliant';
  return 'not-found';
}

/**
 * Scan all repos for a single control.
 */
function scanControl(control) {
  const evidence = [];
  const violations = [];
  const reposScanned = [];

  for (const repoSlug of control.repos) {
    const repoDir = join(TMP_DIR, repoSlug);
    if (!existsSync(repoDir)) {
      console.warn(`  ${control.id}: repo "${repoSlug}" not found in .tmp-repo-sync/, skipping`);
      continue;
    }
    reposScanned.push(repoSlug);

    // Scan src/ directory (where source code lives)
    const srcDir = join(repoDir, 'src');
    if (!existsSync(srcDir)) continue;

    const files = collectFiles(srcDir);
    for (const file of files) {
      const relPath = relative(repoDir, file).replace(/\\/g, '/');
      const positive = scanFile(file, control.patterns);
      for (const match of positive) {
        evidence.push({
          repo: repoSlug,
          file: relPath,
          line: match.line,
          snippet: match.snippet,
        });
      }

      const negative = scanFileNegative(file, control.negativePatterns || []);
      for (const v of negative) {
        violations.push({
          repo: repoSlug,
          file: relPath,
          line: v.line,
          snippet: v.snippet,
        });
      }
    }
  }

  const status = getStatus(evidence, violations, control.repos, reposScanned);

  return {
    id: control.id,
    title: control.title,
    description: control.description,
    severity: control.severity,
    frameworks: control.frameworks,
    status,
    evidenceCount: evidence.length,
    violationCount: violations.length,
    reposScanned,
    evidence: evidence.slice(0, 20), // cap at 20 evidence items
    violations: violations.slice(0, 10), // cap at 10 violations
  };
}

// ─── Dependency vulnerability scan ───────────────────────────────────────

/**
 * Run npm/pnpm audit on a repo and collect vulnerabilities.
 */
function scanDependencies(repoSlug) {
  const repoDir = join(TMP_DIR, repoSlug);
  if (!existsSync(repoDir)) return [];

  const pkgPath = join(repoDir, 'package.json');
  if (!existsSync(pkgPath)) return [];

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const vulnerabilities = [];

    // Check for known vulnerable patterns (simplified — in production use npm audit)
    for (const [name, version] of Object.entries(deps)) {
      // Check for unpinned versions (ranges)
      if (/^[\^~>=*]/.test(version) || version === 'latest') {
        vulnerabilities.push({
          package: name,
          version,
          severity: 'low',
          type: 'unpinned-version',
          description: `Version "${version}" is not pinned — could resolve to a vulnerable release`,
        });
      }
    }

    return vulnerabilities;
  } catch {
    return [];
  }
}

// ─── Main ───────────────────────────────────────────────────────────────

console.log('=== Compliance scan started ===');

if (!existsSync(TMP_DIR)) {
  console.warn('.tmp-repo-sync/ not found — producing stub report (build will continue)');
  const stubReport = {
    scanDate: new Date().toISOString(),
    scannerVersion: '1.0.0',
    reposScanned: [],
    overallScore: 0,
    frameworkScores: {},
    controls: CONTROLS.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      severity: c.severity,
      frameworks: c.frameworks,
      status: 'not-found',
      evidenceCount: 0,
      violationCount: 0,
      reposScanned: [],
      evidence: [],
      violations: [],
    })),
    dependencies: {},
    summary: {
      totalControls: CONTROLS.length,
      compliant: 0,
      partiallyCompliant: 0,
      notFound: CONTROLS.length,
      nonCompliant: 0,
      totalEvidence: 0,
      totalViolations: 0,
      unpinnedDependencies: 0,
    },
  };
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(stubReport, null, 2), 'utf-8');
  console.log(`Stub report written to ${OUTPUT_PATH}`);
  console.log('=== Compliance scan complete (stub — no source code available) ===');
  process.exit(0);
}

// Scan all controls
console.log('Scanning code patterns...');
const controlResults = CONTROLS.map(control => {
  console.log(`  ${control.id}: ${control.title}`);
  return scanControl(control);
});

// Scan dependencies
console.log('Scanning dependencies for unpinned versions...');
const dependencyResults = {};
for (const repo of REPOS) {
  const vulns = scanDependencies(repo.slug);
  if (vulns.length > 0) {
    dependencyResults[repo.slug] = vulns;
    console.log(`  ${repo.slug}: ${vulns.length} unpinned dependencies`);
  } else {
    console.log(`  ${repo.slug}: all dependencies pinned`);
  }
}

// Calculate framework scores
const frameworks = ['ISO 27001', 'NIS2', 'GDPR', 'CCPA', 'OWASP'];
const frameworkScores = {};

for (const fw of frameworks) {
  const fwControls = controlResults.filter(c => c.frameworks[fw]);
  if (fwControls.length === 0) continue;

  const compliant = fwControls.filter(c => c.status === 'compliant').length;
  const partial = fwControls.filter(c => c.status === 'partially-compliant').length;
  const notFound = fwControls.filter(c => c.status === 'not-found').length;
  const nonCompliant = fwControls.filter(c => c.status === 'non-compliant').length;

  // Score: compliant=1, partial=0.5, not-found=0, non-compliant=-1
  const score = ((compliant + partial * 0.5) / fwControls.length * 100).toFixed(1);

  frameworkScores[fw] = {
    totalControls: fwControls.length,
    compliant,
    partiallyCompliant: partial,
    notFound,
    nonCompliant,
    score: parseFloat(score),
  };
}

// Overall score
const totalControls = controlResults.length;
const totalCompliant = controlResults.filter(c => c.status === 'compliant').length;
const totalPartial = controlResults.filter(c => c.status === 'partially-compliant').length;
const overallScore = ((totalCompliant + totalPartial * 0.5) / totalControls * 100).toFixed(1);

// Build report
const report = {
  scanDate: new Date().toISOString(),
  scannerVersion: '1.0.0',
  reposScanned: REPOS.map(r => r.slug).filter(s => existsSync(join(TMP_DIR, s))),
  overallScore: parseFloat(overallScore),
  frameworkScores,
  controls: controlResults,
  dependencies: dependencyResults,
  summary: {
    totalControls,
    compliant: totalCompliant,
    partiallyCompliant: totalPartial,
    notFound: controlResults.filter(c => c.status === 'not-found').length,
    nonCompliant: controlResults.filter(c => c.status === 'non-compliant').length,
    totalEvidence: controlResults.reduce((sum, c) => sum + c.evidenceCount, 0),
    totalViolations: controlResults.reduce((sum, c) => sum + c.violationCount, 0),
    unpinnedDependencies: Object.values(dependencyResults).reduce((sum, v) => sum + v.length, 0),
  },
};

// Write report
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf-8');
console.log(`\nReport written to ${OUTPUT_PATH}`);
console.log(`Overall score: ${overallScore}% (${totalCompliant} compliant, ${totalPartial} partial, ${totalControls - totalCompliant - totalPartial} other)`);
console.log('=== Compliance scan complete ===');
