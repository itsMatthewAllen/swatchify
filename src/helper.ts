
// handles commas, spaces, and slash alpha values
// export function splitColorArgs(input: string) {
// 	let alpha: number | null = null;
//     input = input.trim();

// 	// split slash alpha
// 	const parts = input.split("/");
// 	const mainPart = parts[0].trim();
// 	if (parts[1]) {
// 		alpha = parseAlpha(parts[1].trim());
// 	}

// 	// split main part by comma or spaces
//     let channels: string[] = [];
//     if (mainPart.includes(",")) {
//         channels = mainPart.split(",").map(p => p.trim()).filter(Boolean);
//     } else {
//         channels = mainPart.split(/\s+/).map(p => p.trim()).filter(Boolean);
//     }
    
// 	return { channels, alpha };
// }
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