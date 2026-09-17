#!/usr/bin/env node
// Counts `it(...)` / `test(...)` cases across the two test suites and checks
// them against the fixed targets from docs/GIEOCHU_PROMPT_MVP_PHASE1.md §9
// (91 Jest unit cases in packages/*, 50 Vitest integration cases in apps/web).
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

console.log(`Jest unit test cases (packages/*):        ${unitCount} / 91`);
console.log(`Vitest integration test cases (apps/web):  ${integrationCount} / 50`);

if (unitCount > 91 || integrationCount > 50) {
  console.error("\nTest count exceeds the target in docs/GIEOCHU_PROMPT_MVP_PHASE1.md §9 — check before adding more.");
  process.exitCode = 1;
}
