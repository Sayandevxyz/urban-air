// ============================================================================
// scripts/check-structure.mjs
// Verifies naming conventions, file banners, exported JSDoc, and zero ignores.
// ============================================================================

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const SUPPRESSION_PATTERNS = [
  { name: "eslint-disable", re: /eslint-disable/ },
  { name: "@ts-ignore", re: /@ts-ignore/ },
  { name: "@ts-nocheck", re: /@ts-nocheck/ },
  { name: "@ts-expect-error", re: /@ts-expect-error/ },
  { name: "coverage-ignore", re: /\/\*\s*(?:istanbul|c8|v8)\s+ignore\b/ },
];

const NEXT_APP_ALLOWED = new Set(["page.tsx", "layout.tsx", "route.ts", "globals.css", "icon.svg"]);
const BANNER_BAR_SLASH =
  "// ============================================================================";
const BANNER_BAR_HASH =
  "# ============================================================================";
const MIN_PURPOSE_EXTRA_CHARS = 10;

const SRC_FOLDER_RULES = [
  {
    prefix: "src/components/",
    check: (b) => /^[A-Z][A-Za-z0-9]*\.tsx$/.test(b),
    msg: "component must be PascalCase.tsx",
  },
  {
    prefix: "src/hooks/",
    check: (b) => /^use[A-Z][A-Za-z0-9]*\.ts$/.test(b),
    msg: "hook must match useXxx.ts",
  },
  {
    prefix: "src/app/",
    check: (b) => NEXT_APP_ALLOWED.has(b),
    msg: "unexpected file in Next app dir",
  },
  {
    prefix: "src/i18n/",
    check: (b) => /^[a-z]{2}\.json$/.test(b),
    msg: "i18n file must be <lang>.json",
  },
];

function walkFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(fullPath));
    else results.push(fullPath);
  }
  return results;
}

function hasBannerAt(lines, offset, relPath, isShell) {
  const bar = isShell ? BANNER_BAR_HASH : BANNER_BAR_SLASH;
  const prefix = isShell ? "# " : "// ";
  const purpose = lines[offset + 2];
  return (
    lines[offset] === bar &&
    lines[offset + 1] === `${prefix}${relPath}` &&
    typeof purpose === "string" &&
    purpose.startsWith(prefix) &&
    purpose.length > prefix.length + MIN_PURPOSE_EXTRA_CHARS &&
    lines[offset + 3] === bar
  );
}

function validateBanner(relPath, content, violations) {
  const isShell = relPath.endsWith(".sh");
  const lines = content.split(/\r?\n/);
  if (isShell && lines[0] !== "#!/usr/bin/env bash")
    violations.push(`${relPath}: missing bash shebang`);
  if (!hasBannerAt(lines, isShell ? 1 : 0, relPath, isShell))
    violations.push(`${relPath}: missing or malformed 4-line standard header banner`);
}

function checkSrcFolderRule(relPath, base) {
  if (relPath === "src/middleware.ts") return null;
  const matched = SRC_FOLDER_RULES.find((r) => relPath.startsWith(r.prefix));
  if (matched) return matched.check(base) ? null : `${relPath}: ${matched.msg}`;
  return /^[a-z0-9-]+\.ts$/.test(base) ? null : `${relPath}: module must use kebab-case.ts`;
}

function validateSuppressions(relPath, content, violations) {
  content.split(/\r?\n/).forEach((line, idx) => {
    for (const rule of SUPPRESSION_PATTERNS) {
      if (rule.re.test(line))
        violations.push(`${relPath}:${idx + 1}: forbidden suppression (${rule.name})`);
    }
  });
}

function isDocumentableExport(node) {
  if ((ts.getCombinedModifierFlags(node) & ts.ModifierFlags.Export) === 0) return false;
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isVariableStatement(node)
  );
}

function validateTypeScriptAst(relPath, content, violations) {
  if (!relPath.endsWith(".ts") && !relPath.endsWith(".tsx")) return;
  const sf = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true);
  let castFlagged = false;
  const walk = (node) => {
    const isCast =
      ts.isTypeAssertionExpression(node) ||
      (ts.isAsExpression(node) && node.type.getText(sf) !== "const");
    if (!castFlagged && isCast) {
      violations.push(`${relPath}: disallowed non-const "as" type assertion`);
      castFlagged = true;
    }
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(sf, (node) => {
    walk(node);
    if (!isDocumentableExport(node) || ts.getJSDocCommentsAndTags(node).length > 0) return;
    const decl = ts.isVariableStatement(node) ? node.declarationList.declarations[0] : null;
    violations.push(
      `${relPath}: exported "${node.name?.text ?? decl?.name.getText(sf) ?? "export"}" missing WHY JSDoc`,
    );
  });
}

const PILLAR_DOCS = [
  "CODE_QUALITY.md",
  "TESTING.md",
  "SECURITY.md",
  "EFFICIENCY.md",
  "ACCESSIBILITY.md",
  "PROBLEM_ALIGNMENT.md",
];

function validateDocPaths(doc, violations) {
  if (!fs.existsSync(doc)) return;
  for (const [, ref] of fs
    .readFileSync(doc, "utf8")
    .matchAll(/`([A-Za-z0-9_./-]+\.[A-Za-z0-9]+)`/g)) {
    if (!ref.includes("*") && ref.includes("/") && !fs.existsSync(ref)) {
      violations.push(`${doc}: broken repo path reference "${ref}"`);
    }
  }
}

function validateDocs(violations) {
  for (const doc of PILLAR_DOCS) {
    if (!fs.existsSync(doc)) {
      violations.push(`${doc}: missing required root pillar doc`);
      continue;
    }
    const lines = fs.readFileSync(doc, "utf8").split(/\r?\n/);
    if (lines.length > 120) violations.push(`${doc}: ${lines.length} lines exceeds 120 limit`);
    if (!lines.slice(0, 5).some((l) => l.includes("Evaluation criterion:")))
      violations.push(`${doc}: missing opening "Evaluation criterion:" line`);
  }
  const readmeLines = fs.readFileSync("README.md", "utf8").split(/\r?\n/).length;
  if (readmeLines > 150) violations.push(`README.md: ${readmeLines} lines exceeds 150 limit`);
  for (const doc of ["PROBLEM_ALIGNMENT.md", "docs/REQUIREMENTS.md"])
    validateDocPaths(doc, violations);
}

const violations = [];
const files = ["src", "tests", "scripts"].flatMap((dir) => walkFiles(dir));

for (const file of files) {
  const relPath = file.replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");
  if (relPath.startsWith("src/")) {
    const err = checkSrcFolderRule(relPath, path.posix.basename(relPath));
    if (err) violations.push(err);
  }
  if (!/\.(ts|tsx|mjs|sh)$/.test(relPath)) continue;
  validateBanner(relPath, content, violations);
  if (!relPath.startsWith("scripts/")) validateSuppressions(relPath, content, violations);
  if (relPath.startsWith("src/")) validateTypeScriptAst(relPath, content, violations);
}
validateDocs(violations);

if (violations.length > 0) {
  process.stderr.write(`Structure check failed:\n${violations.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(
  `Structure check passed across ${files.length} files in src/, tests/, and scripts/.\n`,
);
