
export function splitColorArgs(input: string) {
	input = input.trim();

	let alpha: number | null = null;

	// modern syntax rgb(1 2 3 / 50%)
	const slashIndex = input.lastIndexOf("/");
	if (slashIndex !== -1) {
		alpha = parseAlpha(input.slice(slashIndex + 1).trim());
		input = input.slice(0, slashIndex).trim();
	}

	let parts: string[];

	// comma syntax
	if (input.includes(",")) {
		parts = input.split(",").map(p => p.trim()).filter(Boolean);

		// rgba/hsla legacy alpha
		if (parts.length === 4) {
			alpha = parseAlpha(parts.pop()!);
		}
	} else {
		parts = input.split(/\s+/).filter(Boolean);
	}

	return { channels: parts, alpha };
}

// parses alpha values, supporting decimals and percent values
export function parseAlpha(value: string): number {
	if (value.endsWith("%")) {
		return Math.max(0, Math.min(1, parseFloat(value) / 100));
	}
	return Math.max(0, Math.min(1, parseFloat(value)));
}

export function findVarFunctions(text: string): { start: number; end: number; content: string }[] {
	const results = [];

	for (let i = 0; i < text.length; i++) {
		if (text.startsWith("var(", i)) {
			let depth = 1;
			let j = i + 4;

			while (j < text.length && depth > 0) {
				if (text[j] === "(") {
					depth++;
				} else if (text[j] === ")") {
					depth--;
				}
				j++;
			}

			if (depth === 0) {
				results.push({
					start: i,
					end: j,
					content: text.slice(i + 4, j - 1)
				});
			}
		}
	}

	return results;
}

export function splitVarArguments(content: string): [string, string | null] {
	let depth = 0;

	for (let i = 0; i < content.length; i++) {
		const c = content[i];
		if (c === "(") {
			depth++;
		} else if (c === ")") {
			depth--;
		} else if (c === "," && depth === 0) {
			return [content.slice(0, i), content.slice(i + 1)];
		}
	}
	return [content, null];
}

export function findEnclosingSelector(text: string, offset: number): string | null {
	const blockRegex = /([^{}]+)\{/g;
	let match: RegExpExecArray | null;
	let lastSelector: string | null = null;

	while ((match = blockRegex.exec(text))) {
		if (match.index > offset) {
			break;
		}
		lastSelector = match[1].trim();
	}

	return lastSelector;
}

export function selectorMatches(decl: string | undefined, usage: string | null): boolean {
	if (!decl) {
		return true;
	}
	if (!usage) {
		return decl === ":root";
	}

	if (decl === ":root") {
		return true;
	}
	if (decl === usage) {
		return true;
	}

	// class match
	if (decl.startsWith(".") && usage.includes(decl)) {
		return true;
	}

	// element match
	if (!decl.startsWith(".") && !decl.startsWith("#")) {
		return usage.startsWith(decl);
	}

	return false;
}