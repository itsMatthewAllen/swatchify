# Test Plan — color-variable-swatches

This document describes how to organize Jest tests and a comprehensive checklist of tests (simple → hard) for the `color-variable-swatches` extension. It assumes a TypeScript/Jest setup. Place tests in a top-level `test/` folder and keep `src/` for implementation.

## Suggested test organization
- `test/unit/` — small, focused unit tests for parsers, resolvers, and helpers.
- `test/integration/` — tests that exercise `buildColorInformation`, `collectDeclarations`, and `collectVarUsages` over realistic input strings.
- `test/regressions/` — one-off tests for past bugs; named after the bug or issue.
- `test/perf/` — stress/performance tests (optional, run separately).

File naming convention:
- `*.test.ts` for tests.
- Group by unit under descriptive filenames, e.g. `parsing.test.ts`, `variableResolution.test.ts`, `scoping.test.ts`.

Where to put existing tests:
- Move `src/test/extension.test.ts` → `test/unit/variableResolver.test.ts` (the file tests `VariableResolver` helpers).

Example Jest setup notes
- Install: `npm install --save-dev jest ts-jest @types/jest`
- `npx ts-jest config:init` to generate a `jest.config.js` suited for TypeScript.
- Add scripts to `package.json`:
  - `test`: `jest`
  - `test:watch`: `jest --watch`

## Test suites and checklist (simple → hard)

The checklist below enumerates tests you should implement. For each test note: input string, expected resolved color(s), expected number of swatches/usages, and range/position assertions where relevant.

1) Basic single-variable definitions
- `--color1: #fff;` — swatch exists, resolves to `#ffffff`.
- File: `test/unit/parsing.test.ts`

2) Hex variations and normalization
- `#fff`, `#ffffff`, `#FFF` — parser normalizes to the same value.
- File: `test/unit/parsing.test.ts`

3) Named color keywords
- `--c: red;` → `#ff0000` or normalized internal form.
- File: `test/unit/parsing.test.ts`

4) `rgb()` / `rgba()` parsing
- `rgba(255,0,0,0.5)` — alpha read; if UI doesn't display alpha, ensure behavior is documented.
- File: `test/unit/parsing.test.ts`

5) `hsl()` / `hsla()` parsing
- Confirm `hsl()` maps to expected RGB/hex equivalent.
- File: `test/unit/parsing.test.ts`

6) 8-digit hex and alpha hex
- `#RRGGBBAA` and short `#RGBA` support and normalization.
- File: `test/unit/parsing.test.ts`

7) Simple `var()` usage
- `:root { --a:#000 } .x { color: var(--a) }` — usage resolves to `#000000`.
- File: `test/unit/variableResolution.test.ts`

8) `var()` with literal fallback
- `color: var(--missing, #123456)` — fallback used when var undefined.
- File: `test/unit/variableResolution.test.ts`

9) Recursive chain (simple)
- `--a: var(--b); --b: #fff;` — `--a` resolves to `#ffffff`.
- File: `test/unit/variableResolution.test.ts`

10) Multi-level recursion
- Chains of 3–5 variables; validate full resolution.
- File: `test/unit/variableResolution.test.ts`

11) Nested fallbacks
- `var(--a, var(--b, #000))` with various missing/available combos.
- File: `test/unit/variableResolution.test.ts`

12) Cycle detection / circular refs
- `--a:var(--b); --b:var(--a)` — ensure resolver avoids infinite loop and returns `undefined` or a safe fallback.
- File: `test/unit/variableResolution.test.ts`

13) Multiple fallback entries and invalid fallbacks
- `var(--a, invalid, #abc)` — skip invalid fallback, pick first valid color.
- File: `test/unit/variableResolution.test.ts`

14) `var()` inside function contexts
- `rgba(var(--rgb), 0.5)` where `--rgb: 255,0,0` or `"255,0,0"` — ensure substitution then parse.
- File: `test/unit/parsing.test.ts` or `test/unit/variableResolution.test.ts`

15) Scoping & cascade: `:root` vs local
- Define `--c` in `:root`, override in `.scope`; consumers inside `.scope` should pick the override.
- File: `test/unit/scoping.test.ts`

16) Shadowing & redefinition order
- Two declarations of same variable later overrides earlier in the same cascade; assert last-wins.
- File: `test/unit/scoping.test.ts`

17) Multiple usages across file
- Same variable used in many selectors; ensure each usage resolves per its local scope and order.
- File: `test/unit/scoping.test.ts`

18) Complex combos (recursion + fallback + scope)
- `--a: var(--b, var(--c, #f00));` with `--b` defined in a parent scope and `--c` in local scope.
- File: `test/integration/complexResolution.test.ts`

19) Parsing robustness and malformed input
- Whitespace, comments, missing semicolons, malformed `--bad 123;` — parser should not crash; invalid declarations ignored.
- File: `test/unit/parsing.test.ts`

20) Provider integration tests
- `buildColorInformation`, `collectDeclarations`, and `collectVarUsages` — end-to-end over a realistic CSS/HTML string; assert ranges and outputs.
- File: `test/integration/provider.test.ts`

21) Editor/live-edit scenarios (partial buffers)
- Incomplete lines or unclosed parentheses should not crash the resolver; best-effort parsing.
- File: `test/integration/liveEdit.test.ts`

22) Performance / stress tests (optional)
- Many variables and deep chains — ensure no stack overflow and acceptable runtime.
- File: `test/perf/stress.test.ts` (run separately from unit tests)

23) Regression tests
- For any fixed bug, add a test reproducing the bug so CI prevents regressions.
- File: `test/regressions/<issue-name>.test.ts`

24) Edge-spec tests
- CSS custom property names with escaped characters or unusual unicode — ensure parsing per spec.
- File: `test/unit/parsing.test.ts`

25) End-to-end snapshot (optional)
- Snapshot the provider's output for a sample file to detect format changes.
- File: `test/integration/snapshots.test.ts`

## Recommended test structure per file (examples)
- `test/unit/parsing.test.ts` — tests 1–6, 19, 24.
- `test/unit/variableResolution.test.ts` — tests 7–14, 18, 12–13.
- `test/unit/scoping.test.ts` — tests 15–17.
- `test/integration/provider.test.ts` — tests 20–21, 25.
- `test/regressions/*` — bug-specific tests.

## Assertion patterns & helpers
- Use small helpers to assert color equality (normalize hex, compare rgba/hsl conversions).
- Assert positions by giving known input strings and checking `range` values returned by `collectVarUsages`.
- Use `expect(() => fn()).not.toThrow()` for resilience tests.

## CI suggestions
- Run unit tests on PRs. Run perf/stress tests as optional or scheduled jobs.
- Add a GitHub Actions workflow that runs `npm test` on `push`/`pull_request`.

## Next steps
1. Move `src/test/extension.test.ts` → `test/unit/variableResolver.test.ts` and update imports.
2. Add a minimal Jest setup (`jest.config.js`) if not present.
3. Scaffold the simplest tests (parsing basics and simple `var()` usage) to validate test setup.

If you'd like, I can: scaffold the suggested test files, move the existing `extension.test.ts`, and add a minimal `jest.config.js` + `package.json` scripts and a few starter tests (1–4). Which should I do next?
