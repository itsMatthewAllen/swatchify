// variableResolver.ts

import { calculateSpecificity, compareSpecificity } from "./specificity";
import { VariableDeclarationMap, VariableDeclaration } from "./variableIndex";

export class VariableResolver {

    private DEBUG_NAME = "--color29";
    private cache = new Map<string, string | null>();

    constructor(private readonly map: VariableDeclarationMap) {}

    /**
     * Resolve a variable usage at a given document offset and selector
     */
    resolve(name: string, positionOffset: number, usageSelector: string | null, usageMedia: string | null = null): string | null {
        // optional debug entry when DEBUG_NAME matches (no logging by default)
        if (name === this.DEBUG_NAME) {
            // silence
        }

        const result = this.resolveVariable(name, positionOffset, usageSelector, usageMedia, new Set());

        if (name === this.DEBUG_NAME) {
            // silence
        }

        return result;
    }

    /**
     * Resolve a var() with optional fallback.
     * If the variable cannot be resolved, attempts to resolve the fallback.
     */
    resolveWithFallback(
        name: string,
        fallback: string | null,
        positionOffset: number,
        usageSelector: string | null,
        usageMedia: string | null = null
    ): string | null {
        // First try to resolve the variable
        const resolved = this.resolve(name, positionOffset, usageSelector, usageMedia);
        if (resolved !== null) {
            return resolved;
        }

        // If variable not found and fallback exists, resolve the fallback
        if (fallback) {
            // Recursively resolve the fallback in case it contains var()
            return this.fallbackResolveValueString(fallback.trim(), positionOffset, usageSelector, usageMedia);
        }

        return null;
    }

    /**
     * Helper to resolve var() expressions within a fallback string.
     * Public version compatible with the fallback resolution logic.
     */
    fallbackResolveValueString(
        value: string,
        positionOffset: number,
        usageSelector: string | null,
        usageMedia: string | null
    ): string | null {
        return this.resolveValueString(value, positionOffset, usageSelector, new Set(), usageMedia);
    }

    // ================= CORE RESOLUTION =================

    private resolveVariable(
        name: string,
        positionOffset: number,
        usageSelector: string | null,
        usageMedia: string | null,
        visited: Set<string>
    ): string | null {
        const cacheKey = `${name}|${positionOffset}|${usageSelector ?? ""}|${usageMedia ?? ""}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) ?? null;
        }

        if (visited.has(name)) {
            return null; // prevent infinite recursion
        }
        
        const candidates = this.map.get(name);
        
        if (name === this.DEBUG_NAME) {
            // debug stub
        }
        
        if (!candidates || candidates.length === 0) {
            if (name === this.DEBUG_NAME) {
                // debug stub
            }
            return null;
        }
        
        visited.add(name);

        let scoped = this.getScopedDeclarations(candidates, positionOffset)
            // filter out declarations inside a different media context
            .filter(d => !d.media || d.media === usageMedia);
        let best: VariableDeclaration | null = null;

        if (name === this.DEBUG_NAME) {
            // debug stub
        }

        if (scoped.length > 0) {
            best = this.pickBestDeclaration(scoped);
        }

        if (!best) {
            const rootDecls = candidates.filter(c => c.selector === ':root');
            // additionally ensure root declarations match media (most are null)
            const filtered = rootDecls.filter(c => !c.media || c.media === usageMedia);
            if (name === this.DEBUG_NAME) {
                // debug stub
            }
            if (filtered.length > 0) {
                best = filtered[filtered.length - 1]; // last matching :root declaration
            }
        }

        if (!best) {
            if (name === this.DEBUG_NAME) {
                // debug stub
            }
            return null;
        }

        if (name === this.DEBUG_NAME) {
            // debug stub
        }

        const resolved = this.resolveValueString(
            best.value,
            best.startOffset,
            best.selector ?? usageSelector,
            visited,
            usageMedia
        );

        this.cache.set(cacheKey, resolved);
        return resolved;
    }

    // ================= OPTIMIZED SCOPING =================

    private getScopedDeclarations(list: VariableDeclaration[], positionOffset: number): VariableDeclaration[] {
        // binary search for last declaration before position
        let left = 0,
            right = list.length - 1;
        let lastValid = -1;

        while (left <= right) {
            const mid = (left + right) >> 1;
            if (list[mid].startOffset <= positionOffset) {
                lastValid = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }

        return lastValid === -1 ? [] : list.slice(0, lastValid + 1);
    }

    private pickBestDeclaration(list: VariableDeclaration[]): VariableDeclaration {
        let best = list[0];
        let bestSpec = calculateSpecificity(best.selector ?? null);

        for (const candidate of list.slice(1)) {
            const spec = calculateSpecificity(candidate.selector ?? null);
            const cmp = compareSpecificity(spec, bestSpec);
            if (cmp > 0 || (cmp === 0 && candidate.startOffset > best.startOffset)) {
                best = candidate;
                bestSpec = spec;
            }
        }
        return best;
    }

    // ================= VALUE RESOLUTION =================

    private resolveValueString(
        value: string,
        positionOffset: number,
        usageSelector: string | null,
        visited: Set<string>,
        usageMedia: string | null
    ): string | null {
        // resolve value string; debugging available via DEBUG_NAME if needed
        let result = value.trim();
        let index = 0;

        if (value.includes(this.DEBUG_NAME)) {
            // debug stub
        }
        
        while (true) {
            const varStart = result.indexOf("var(", index);
            if (varStart === -1) {
                break;
            }

            const { innerContent, endIndex } = this.extractVarFunction(result, varStart);
            if (!innerContent) {
                break;
            }

            // debug: found var() inner

            // ← KEY: Pass the current usageSelector (which is the declaration's selector)
            // to maintain scope context for nested variables
            const resolved = this.resolveVarExpression(innerContent, positionOffset, usageSelector, visited, usageMedia);
            
            // debug: resolved to result

            if (resolved === null) {
                // BUG FIX: If a var() cannot be resolved (cycled, not found, etc),
                // the entire value becomes invalid per CSS spec.
                // debug: unresolved var
                return null;
            }

            result = result.slice(0, varStart) + resolved + result.slice(endIndex);

            // debug: intermediate result

            index = varStart;
        }

        // debug final result
        return result.trim();
    }

    private resolveVarExpression(
        content: string,
        positionOffset: number,
        usageSelector: string | null,
        visited: Set<string>,
        usageMedia: string | null
    ): string | null {
        // split into variable name and fallback
        const commaIndex = this.findTopLevelComma(content);
        const name = commaIndex === -1 ? content.trim() : content.slice(0, commaIndex).trim();
        const fallback = commaIndex === -1 ? null : content.slice(commaIndex + 1).trim();

        // debug varExpression content

        const resolved = this.resolveVariable(name, positionOffset, usageSelector, usageMedia, visited);
        
        // debug resolved primary

        if (resolved !== null) {
            return resolved;
        }

        // fallback is attempted only if the main variable fails
        if (fallback) {
            // debug attempting fallback
            // Recursively resolve the fallback (it might be another var() or a raw color)
            return this.resolveValueString(fallback, positionOffset, usageSelector, visited, usageMedia);
        }

        return null;
    }

    // ================= UTILITIES =================

    private extractVarFunction(str: string, start: number): { innerContent: string | null; endIndex: number } {
        // `start` points at the `v` of `var(`.  walk forward until the matching
        // closing parenthesis is found; ignore the very first character so we
        // don’t return immediately with depth===0.
        let depth = 0;

        for (let i = start; i < str.length; i++) {
            const ch = str[i];
            if (ch === "(") {
                depth++;
            } else if (ch === ")") {
                depth--;
                // we only consider the function closed when we’ve seen the opening
                // parenthesis and then the matching closing one
                if (depth === 0) {
                    return {
                        innerContent: str.slice(start + 4, i).trim(), // skip `var(`
                        endIndex: i + 1
                    };
                }
            }
            // note: do **not** return just because depth===0 here; we haven’t
            // started yet
        }

        // malformed `var(` – caller will treat this as “nothing to do”
        return { innerContent: null, endIndex: start };
    }

    private findTopLevelComma(str: string): number {
        let depth = 0;
        for (let i = 0; i < str.length; i++) {
            const c = str[i];
            if (c === "(") {
                depth++;
            }
            else if (c === ")") {
                depth--;
            }
            else if (c === "," && depth === 0) {return i;}
        }
        return -1;
    }
}