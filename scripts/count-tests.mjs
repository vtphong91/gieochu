#!/usr/bin/env node
// Counts `it(...)` / `test(...)` cases across the two test suites and checks
// them against the fixed targets from docs/GIEOCHU_PROMPT_MVP_PHASE1.md §9
// (91 Jest unit cases in packages/*, 50 Vitest integration cases in apps/web), raised
// +1/+1 for the product-upload object-key hardening, then +2/+2 for the product editor phase 1
// (external-link allowlist + publish eligibility unit tests; publish-refusal and external-link
// delivery integration tests) — owner-approved, ADR-026 (cap +3/+3 for the whole batch).
// ADR-028 uses +2/+2 of the remaining headroom without raising the cap (Cloudinary delivery URL + sanitizer
// image-host unit tests; image quota signature refusal + register folder check integration tests).
// ADR-037 mục 6 (M12): integration cap 53 -> 55 for exactly the 2 M12 tests of §9 (audit log append-only — M12a;
// daily stats without personal data + admin dashboard — M12b). Unit cap stays 94.
// ADR-050 (owner-approved +1/+2): unit 94 -> 95 (CMS menu/home-sections parse + unsafe links), integration 55 -> 57
// (legal acceptance recorded per published version + publish blocked while placeholders remain).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, "$1");

function walk(dir, predicate, results = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".next" || entry === "generated") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, predicate, results);
    } else if (predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

function countCases(files) {
  const testCallPattern = /\b(it|test)\s*\(\s*["'`]/g;
  let total = 0;
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    const matches = content.match(testCallPattern);
    total += matches ? matches.length : 0;
  }
  return total;
}

const unitFiles = walk(join(ROOT, "packages"), (f) => f.endsWith(".test.ts"));
const integrationFiles = walk(join(ROOT, "apps", "web", "tests", "integration"), (f) => f.endsWith(".test.ts"));

const unitCount = countCases(unitFiles);
const integrationCount = countCases(integrationFiles);

console.log(`Jest unit test cases (packages/*):        ${unitCount} / 95`);
console.log(`Vitest integration test cases (apps/web):  ${integrationCount} / 57`);

if (unitCount > 95 || integrationCount > 57) {
  console.error("\nTest count exceeds the target in docs/GIEOCHU_PROMPT_MVP_PHASE1.md §9 — check before adding more.");
  process.exitCode = 1;
}
