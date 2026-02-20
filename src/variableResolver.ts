import { selectorMatches } from "./helper";
import { calculateSpecificity, compareSpecificity } from "./specificity";

export interface VariableDeclaration {
    name: string;
    value: string;
    startOffset: number; // document offset
	endOffset: number;
	selector?: string; // for selector-scoped variables 
}

export function resolveVariableAtPosition(
	name: string,
	varDeclarations: VariableDeclaration[],
	positionOffset: number,
    usageSelector: string | null,
	visited = new Set<string>()
): string | null {
	// prevent infinite recursion
	if (visited.has(name)) {
		return null;
	}
	visited.add(name);

    // find candidates in scope
    const candidates = varDeclarations.filter(d => 
        d.name === name &&
        d.startOffset <= positionOffset
    );

	if (candidates.length === 0) {
		return null;
	}

    // pick declaration w/highest specificity
    let best = candidates[0];
    let bestSpec = calculateSpecificity(best.selector ?? null);

    for (const candidate of candidates.slice(1)) {
        const spec = calculateSpecificity(candidate.selector ?? null);

        const cmp = compareSpecificity(spec, bestSpec);

        if (cmp > 0 || (cmp === 0 && candidate.startOffset > best.startOffset)) {
            best = candidate;
            bestSpec = spec;
        }
    }

    const decl = best;

	const varMatch = decl.value.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);

	if (!varMatch) {
		return decl.value.trim(); // literal
	}

	const innerName = varMatch[1];
	const fallbackRaw = varMatch[2]?.trim();

    const innerPosition = decl.startOffset;

    // resolve inner variable recursively
    const resolvedInner = resolveVariableAtPosition(
        innerName,
        varDeclarations,
        innerPosition,
        decl.selector ?? usageSelector,
        new Set(visited));

    if (resolvedInner) {
        return resolvedInner;
    }

    // if inner var is undefined, recursively resolve fallback
    if (fallbackRaw) {
        // check if fallback is var()
        if (fallbackRaw.startsWith("var(")) {
            return resolveVariableAtPositionFromString(
                fallbackRaw, 
                varDeclarations, 
                innerPosition,
                usageSelector, 
                visited);
        } else {
            return fallbackRaw;
        }
    }

    return null;
}

// helper to resolve a raw var() string (where fallback can also be var())
export function resolveVariableAtPositionFromString(
    varString: string,
    varDeclarations: VariableDeclaration[],
    positionOffset: number,
    usageSelector: string | null,
    visited: Set<string>
): string | null {
    const match = varString.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
    if (!match) {
        return varString.trim();
    }

    const innerName = match[1].trim();
    const fallbackRaw = match[2]?.trim();

    const resolvedInner = resolveVariableAtPosition(
        innerName,
        varDeclarations,
        positionOffset,
        usageSelector,
        visited);
    if (resolvedInner) {
        return resolvedInner;
    }

    if (fallbackRaw) {
        if (fallbackRaw.startsWith("var(")) {
            return resolveVariableAtPositionFromString(
                fallbackRaw,
                varDeclarations,
                positionOffset,
                usageSelector,
                visited);
        } else {
            return fallbackRaw;
        }
    }
    return null;
}
