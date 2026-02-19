
// // helper to resolve recursive variable definitions, e.g., `--color-border: var(--color-red);`
// // also allows for fallback colors
// function resolveValue(
// 	value: string,
// 	map: Map<string, string>,
// 	visited = new Set<string>()
// ): string | null {
// 	value = value.trim();

// 	if (!value.startsWith("var(")) {
// 		return value; // literal value
// 	}

// 	// Remove "var(" and trailing ")"
// 	let inner = value.slice(4, -1).trim();

// 	// Parse the first argument (variable name) and the fallback
// 	let varName = "";
// 	let fallback: string | undefined;
// 	let depth = 0;
// 	let splitIndex = -1;

// 	for (let i = 0; i < inner.length; i++) {
// 		const c = inner[i];
// 		if (c === "(") depth++;
// 		else if (c === ")") depth--;
// 		else if (c === "," && depth === 0) {
// 			splitIndex = i;
// 			break;
// 		}
// 	}

// 	if (splitIndex === -1) {
// 		varName = inner.trim();
// 	} else {
// 		varName = inner.slice(0, splitIndex).trim();
// 		fallback = inner.slice(splitIndex + 1).trim();
// 	}

// 	// Prevent infinite recursion
// 	if (visited.has(varName)) {
// 		if (fallback) return resolveValue(fallback, map, visited);
// 		return null;
// 	}

// 	visited.add(varName);

// 	const variableValue = map.get(varName);
// 	if (variableValue) {
// 		const resolved = resolveValue(variableValue, map, visited);
// 		if (resolved) return resolved;
// 	}

// 	// If variable not defined, resolve fallback
// 	if (fallback) {
// 		return resolveValue(fallback, map, visited);
// 	}

// 	return null;
// }


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
	visited = new Set<string>()
): string | null {
	// prevent infinite recursion
	if (visited.has(name)) {
		return null;
	}
	visited.add(name);

	// filter declarations above positionOffset
	const candidates = varDeclarations
		.filter(d => d.name === name && d.startOffset <= positionOffset);

	if (candidates.length === 0) {
		return null;
	}

	// pick the *last* declaration (closest in cascade)
	const decl = candidates[candidates.length - 1];

	const varMatch = decl.value.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);

	if (!varMatch) {
		return decl.value.trim(); // literal
	}

	const innerName = varMatch[1];
	const fallbackRaw = varMatch[2]?.trim();

    // resolve inner variable recursively
    const resolvedInner = resolveVariableAtPosition(innerName, varDeclarations, decl.startOffset, new Set(visited));

    if (resolvedInner) {
        return resolvedInner;
    }

    // if inner var is undefined, recursively resolve fallback
    if (fallbackRaw) {
        // check if fallback is var()
        if (fallbackRaw.startsWith("var(")) {
            return resolveVariableAtPositionFromString(fallbackRaw, varDeclarations, decl.startOffset, visited);
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
    visited: Set<string>
): string | null {
    const match = varString.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
    if (!match) {
        return varString.trim();
    }

    const innerName = match[1].trim();
    const fallbackRaw = match[2]?.trim();

    const resolvedInner = resolveVariableAtPosition(innerName, varDeclarations, positionOffset, new Set(visited));
    if (resolvedInner) {
        return resolvedInner;
    }

    if (fallbackRaw) {
        if (fallbackRaw.startsWith("var(")) {
            return resolveVariableAtPositionFromString(fallbackRaw, varDeclarations, positionOffset, visited);
        } else {
            return fallbackRaw;
        }
    }
    return null;
}
