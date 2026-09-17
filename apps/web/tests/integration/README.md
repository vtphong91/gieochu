# Integration tests (Vitest)

Runs against a real test database (see `TEST_DATABASE_URL`). No tests yet —
M0 ships 0 integration tests by design (docs/GIEOCHU_PROMPT_MVP_PHASE1.md §9).
M1 adds the first 8 here (`auth.test.ts`).

Conventions:

- One `describe` block per module: `describe("M8 orders", ...)`.
- English test names describing behavior.
- Reset the schema before each test file; mock storage via MinIO, email via
  an in-memory adapter.
