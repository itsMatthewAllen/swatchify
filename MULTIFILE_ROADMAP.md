# Multi-File Variable Support Roadmap

## Overview
Move from single-file variable resolution to project-wide variable indexing and resolution. This involves scanning CSS files, resolving imports, building a global index, and maintaining it as files change.

---

## Phase 1: Workspace Scanning (Foundation)
*Establish ability to find and track all CSS files in project*

### 1.1 - Workspace Scanner Module
- [ ] Create `src/workspace/workspaceScanner.ts`
  - `scanCSSFiles(workspaceRoot)`: Find all .css, .scss, .less files
  - `watchForChanges()`: Setup FSWatcher for file additions/deletions
  - Handle exclusions: node_modules/, dist/, build/, .git/
  - Return: Map<filepath, fileContent>
- **Tests**: `test/integration/workspaceScanning.test.ts`
  - Test finding files in nested directories
  - Test exclusion patterns work
  - Test watch callbacks fire on file changes

### 1.2 - File Index Manager
- [ ] Create `src/workspace/fileIndexManager.ts`
  - `FileIndex` class: tracks all CSS files and content
  - `addFile(filePath, content)`: Register a file
  - `updateFile(filePath, content)`: Update after file change
  - `deleteFile(filePath)`: Remove from index
  - `getAllFiles()`: Return list of indexed files
  - `getFileContent(filePath)`: Retrieve content
- **Tests**: `test/unit/fileIndexManager.test.ts`
  - Test adding/updating/deleting files
  - Test deduplication (same path added twice)
  - Test file retrieval

### 1.3 - VS Code Extension Integration
- [ ] Modify `src/extension.ts`
  - Initialize workspace scanner on activate
  - Setup file watchers for .css/.scss/.less
  - Call re-indexing on file changes
  - Handle workspace.onDidChangeTextDocument events
  - Cache indexed content

---

## Phase 2: Import Resolution (Dependency Graph)
*Parse import statements and build file dependency relationships*

### 2.1 - Import Parser
- [ ] Create `src/imports/importParser.ts`
  - Parse CSS `@import "path";` statements
  - Parse SCSS `@import "path";` statements
  - Parse Less `@import "path";` statements
  - Handle quotes, URLs, media queries
  - Return: `{ path: string, mediaQuery?: string, line: number }[]`
  - Handle relative paths, absolute paths, node_modules imports
- **Tests**: `test/unit/importParser.test.ts`
  - Test CSS imports: `@import "vars.css";`
  - Test SCSS imports: `@import "colors";` (without extension)
  - Test URLs: `@import url("...")`
  - Test with media queries: `@import "..." screen;`
  - Ignore non-import @ rules

### 2.2 - Path Resolver
- [ ] Create `src/imports/pathResolver.ts`
  - `resolveImportPath(importPath, fromFilePath, workspaceRoot)`
  - Handle relative paths (`../colors.css`)
  - Handle absolute paths (`/styles/vars.css`)
  - Handle SCSS naming conventions (no extension, `_partials`)
  - Handle node_modules imports
  - Return: absolute file path or null if not found
- **Tests**: `test/unit/pathResolver.test.ts`
  - Test relative path resolution
  - Test SCSS `_partial.scss` convention
  - Test extension inference (.css, .scss, .less)
  - Test non-existent files return null

### 2.3 - Dependency Graph Builder
- [ ] Create `src/imports/dependencyGraph.ts`
  - `DependencyGraph` class tracking file relationships
  - `addDependency(from: FilePath, to: FilePath)`
  - `getLoadOrder(rootFiles)`: Topological sort
  - `detectCycles()`: Find circular imports
  - `getDependents(filePath)`: Files that import this file
  - `getDependencies(filePath)`: Files this file imports
- **Tests**: `test/unit/dependencyGraph.test.ts` + `test/integration/dependencyResolution.test.ts`
  - Test linear dependency chain (A → B → C)
  - Test diamond dependency (A → B, A → C, B → D, C → D)
  - Test cycle detection (A → B → A)
  - Test load order respects dependencies

---

## Phase 3: Global Variable Index (Multi-File Aggregation)
*Build unified variable index from all files, respecting import order and cascade*

### 3.1 - Global Variable Index
- [ ] Create `src/workspace/globalVariableIndex.ts`
  - `GlobalVariableIndex` class
  - `buildIndex(fileIndex, dependencyGraph)`: Process all files in order
  - Aggregates declarations from all files respecting import order
  - Track which file each declaration comes from
  - Track file paths with line/column for each declaration
  - `getVariablesByName(varName)`: Return all declarations across files
  - `getVariablesForFile(filePath)`: Get declarations in one file
  - `invalidateFile(filePath)`: Rebuild after file change
- **Tests**: `test/unit/globalVariableIndex.test.ts` + `test/integration/multiFileIndex.test.ts`
  - Test aggregating variables from 2 files
  - Test cascade: later file overrides earlier
  - Test import order affects resolution
  - Test getting variables for specific file
  - Test circular import handling

### 3.2 - Selective Re-indexing Strategy
- [ ] Enhance `GlobalVariableIndex`
  - `invalidateFile(filePath)`: Only re-index affected files
  - Track: which files import the changed file
  - Re-index only those dependents
  - Invalidate resolver cache for affected variables
  - Debounce rapid changes (100ms)
- **Tests**: `test/integration/incrementalIndexing.test.ts`
  - Test changing file only re-indexes dependents
  - Test cache invalidation works
  - Test rapid file changes debounce correctly

---

## Phase 4: Multi-File Variable Resolver
*Resolve variables correctly across project, respecting file context and imports*

### 4.1 - File-Aware Variable Resolver
- [ ] Modify `src/variableResolver.ts` → create `src/workspace/multiFileVariableResolver.ts`
  - New class `MultiFileVariableResolver` extending current logic
  - `resolve(varName, filePath, selector)`: Resolve in context of a file
  - Query `GlobalVariableIndex` instead of single VariableDeclarationMap
  - Respect variable cascade: local file → imported → root
  - Handle variables from different files
  - Support cross-file variable references
- **Tests**: `test/unit/multiFileVariableResolver.test.ts`
  - Test resolving variable defined in imported file
  - Test file-local variable overrides global
  - Test cascade respects import order
  - Test var in file A references var in file B

### 4.2 - File Context Tracking
- [ ] Maintain file context through resolution chain
  - When resolving var in file A that references file B var
  - Continue resolution in appropriate file context
  - Handle scope properly across file boundaries
- **Tests**: `test/integration/crossFileResolution.test.ts`
  - Test: `colors.css` has `--primary: #blue`
  - `app.css` imports `colors.css`, uses `color: var(--primary)`
  - Verify swatch shows correct color

---

## Phase 5: Provider Changes (Single-File → Multi-File)
*Update color provider to work with global index instead of single-file approach*

### 5.1 - Multi-File Color Provider
- [ ] Create `src/colorProvider/multiFileColorProvider.ts`
  - New provider using `GlobalVariableIndex` and `MultiFileVariableResolver`
  - For each usage in current file, resolve using global context
  - Pass file path to resolver
  - Handle color information across file boundaries
- [ ] Modify `src/extension.ts`
  - Activate global indexing on extension startup
  - Register both old (single-file) and new (multi-file) providers
  - Switch based on configuration/feature flag
- **Tests**: `test/integration/multiFileColorProvider.test.ts`
  - Test getting color info for variable from imported file
  - Test cascade works correctly

### 5.2 - Backward Compatibility
- [ ] Keep single-file provider as fallback
  - Useful for simple projects
  - Faster for single-file analysis
  - Configurable which provider to use

---

## Phase 6: Performance Optimization (Large Projects)
*Make it fast for projects with hundreds of CSS files*

### 6.1 - Caching Strategy
- [ ] Implement multi-level caching
  - File content cache (invalidated on file change)
  - Parse cache (declarations per file)
  - Resolution cache (variable → value per context)
  - Dependency graph cache
- [ ] Implement `src/workspace/cache.ts`
  - `memoized(key, fn)`: Cache function results
  - `invalidate(pattern)`: Clear matching cache entries
  - `clear()`: Full cache clear
- **Tests**: `test/unit/cache.test.ts`
  - Test memoization works
  - Test invalidation clears correct entries

### 6.2 - Debouncing & Batching
- [ ] Batch index updates
  - Collect file changes over 100ms window
  - Process batch together instead of incremental
  - Reduces re-index operations
- [ ] Implement `src/workspace/indexUpdateQueue.ts`
  - Queue file changes with debounce
  - Batch process when queue settles
- **Tests**: `test/unit/indexUpdateQueue.test.ts`
  - Test rapid file changes batch together
  - Test processing happens after debounce

### 6.3 - Lazy Loading
- [ ] Lazy index building
  - Only index files when needed
  - Build index for current and imported files first
  - Defer other files until idle
- [ ] Use VS Code extension context.subscriptions for cleanup

### 6.4 - Performance Benchmarks
- [ ] Create performance tests
  - `test/perf/largeProject.test.ts`
  - Test with 100 CSS files
  - Test with 1000 variable declarations
  - Test resolution time < 10ms per lookup
  - Test indexing time < 1s for typical project

---

## Phase 7: Testing Infrastructure (Multi-File Tests)
*Comprehensive testing for multi-file scenarios*

### 7.1 - Multi-File Test Fixtures
- [ ] Create `test/fixtures/multiFileProject/`
  - `root.css`: Global variables
  - `components/buttons.css`: Component variables
  - `components/forms.css`: Form variables
  - `layouts/grid.css`: Layout variables
  - `app.css`: Main file with imports
  - `index.html`: Reference HTML
  - Structure mimics real project

### 7.2 - Integration Test Suite
- [ ] Create `test/integration/scenarios.test.ts`
  - **Scenario 1**: Simple import chain
    - App imports colors, colors imported
    - Verify swatches work
  - **Scenario 2**: Cascade override
    - Global colors, then override in specific file
    - Verify correct precedence
  - **Scenario 3**: Complex dependencies
    - Diamond dependency pattern
    - Verify correct load order
  - **Scenario 4**: Circular imports
    - Detect and handle gracefully
    - No crash, no infinite loop
  - **Scenario 5**: Cross-file references
    - Variable in A references variable from B
    - Verify resolution works
  - **Scenario 6**: Large project
    - 50+ files
    - Verify performance acceptable

### 7.3 - Regression Tests
- [ ] Add `test/regressions/multiFile.test.ts`
  - Tests for bugs found in multi-file scenarios
  - Document real-world issues

---

## Phase 8: Debugging & Developer Tools (Optional Advanced)
*Help users understand variable resolution across project*

### 8.1 - Hover Details Enhancement
- [ ] Show variable source file in hover
  - `--primary: blue (from: colors.css:15)`
  - Show import chain: `app.css → colors.css → buttons.css`

### 8.2 - VS Code Webview Panel
- [ ] Create "Variable Inspector" panel
  - Show all variables in project
  - Filter by name
  - Show which variables override others
  - visualize dependency graph
  - Show resolution chain for selected variable

### 8.3 - Debug Logging
- [ ] Create `src/debug/variableTracer.ts`
  - Enable/disable via setting
  - Log resolution chain for debugging
  - Show which files considered for each variable

---

## Summary of New Files to Create

```
src/
├── workspace/
│   ├── workspaceScanner.ts          [Phase 1.1]
│   ├── fileIndexManager.ts          [Phase 1.2]
│   ├── globalVariableIndex.ts       [Phase 3.1]
│   ├── multiFileVariableResolver.ts [Phase 4.1]
│   ├── indexUpdateQueue.ts          [Phase 6.2]
│   └── cache.ts                     [Phase 6.1]
├── imports/
│   ├── importParser.ts              [Phase 2.1]
│   ├── pathResolver.ts              [Phase 2.2]
│   └── dependencyGraph.ts           [Phase 2.3]
├── colorProvider/
│   └── multiFileColorProvider.ts    [Phase 5.1]
└── debug/
    └── variableTracer.ts            [Phase 8.3]

test/
├── unit/
│   ├── fileIndexManager.test.ts
│   ├── importParser.test.ts
│   ├── pathResolver.test.ts
│   ├── dependencyGraph.test.ts
│   ├── globalVariableIndex.test.ts
│   ├── multiFileVariableResolver.test.ts
│   ├── cache.test.ts
│   └── indexUpdateQueue.test.ts
├── integration/
│   ├── workspaceScanning.test.ts
│   ├── dependencyResolution.test.ts
│   ├── multiFileIndex.test.ts
│   ├── incrementalIndexing.test.ts
│   ├── crossFileResolution.test.ts
│   ├── multiFileColorProvider.test.ts
│   ├── scenarios.test.ts
│   └── largeProject.test.ts
├── regressions/
│   └── multiFile.test.ts
└── fixtures/
    └── multiFileProject/
        ├── root.css
        ├── components/buttons.css
        ├── components/forms.css
        ├── layouts/grid.css
        ├── app.css
        └── index.html
```

---

## Recommended Implementation Order

1. **Phase 1** (1-2 days): Get files discovered and watched
2. **Phase 2** (2-3 days): Parse imports and build dependency graph
3. **Phase 3** (2-3 days): Build global variable index
4. **Phase 4** (1-2 days): Make resolver work across files
5. **Phase 5** (1 day): Update provider
6. **Phase 6** (1-2 days): Performance optimization if needed
7. **Phase 7** (1 day): Comprehensive testing
8. **Phase 8** (Optional): Developer tools

**Estimated Total**: 9-15 days of development

---

## Success Criteria

✅ Variables from imported files show correct swatches
✅ Cascade respects file import order
✅ Circular imports handled gracefully
✅ No crashes on 100+ file projects
✅ Resolution completes in < 10ms
✅ Indexing completes in < 1s for typical project
✅ 100% test coverage for new modules
✅ Backward compatible with single-file projects
