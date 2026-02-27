
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

export interface SelectorContext {
	selector: string | null;
	media: string | null;
}

/**
 * Return the selector and media query (if any) that enclose the given
 * offset.  The media query returned is simply the name of the last
 * `@media` block whose braces surround the offset; the condition itself
 * is never evaluated.
 */
export function findEnclosingSelector(text: string, offset: number): SelectorContext {
	// find last simple selector before offset
	const blockRegex = /([^{}]+)\{/g;
	let match: RegExpExecArray | null;
	let lastSelector: string | null = null;

	while ((match = blockRegex.exec(text))) {
		if (match.index > offset) {
			break;
		}
		lastSelector = match[1].trim();
	}

	// determine media context separately
	const media = findMediaSelectorAtOffset(text, offset);

	return { selector: lastSelector, media };
}

/**
 * Scan the text for `@media` blocks and return the selector of the block
 * that contains `offset`, if any.  Does not attempt to evaluate the
 * media condition.
 */
export function findMediaSelectorAtOffset(text: string, offset: number): string | null {
	const mediaRegex = /@media[^{}]*\{/g;
	let match: RegExpExecArray | null;
	let result: string | null = null;

	while ((match = mediaRegex.exec(text))) {
		const sel = match[0].slice(0, -1).trim();
		const start = match.index;
		let depth = 1;
		let i = mediaRegex.lastIndex;

		// walk forward to find matching closing brace
		while (i < text.length && depth > 0) {
			if (text[i] === "{") depth++;
			else if (text[i] === "}") depth--;
			i++;
		}

		const end = i;
		if (offset >= start && offset < end) {
			result = sel;
		}
	}

	return result;
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