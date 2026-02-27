import { VariableDeclaration } from "../variableIndex";

export function collectVariableDeclarations(text: string): VariableDeclaration[] {
    const varDeclarations: VariableDeclaration[] = [];

    interface MediaContext {
        selector: string;
        start: number;
        end: number;
    }

    function walk(content: string, baseOffset: number, mediaCtx: MediaContext | null) {
        // manual parser to handle nested blocks correctly
        // content is a slice of the full text; baseOffset helps compute global offsets
        let pos = 0;
        while (pos < content.length) {
            // skip whitespace and comments (simple)
            while (pos < content.length && /\s/.test(content[pos])) pos++;
            if (pos >= content.length) break;

            // find selector start to '{'
            const selStart = pos;
            const braceIdx = content.indexOf('{', pos);
            if (braceIdx === -1) break;
            const selector = content.slice(selStart, braceIdx).trim();

            // compute offset of the body within original text
            pos = braceIdx + 1;
            const bodyStart = baseOffset + pos;

            // now find matching closing brace by counting
            let depth = 1;
            while (pos < content.length && depth > 0) {
                if (content[pos] === '{') depth++;
                else if (content[pos] === '}') depth--;
                pos++;
            }
            const bodyEnd = baseOffset + pos - 1; // position of closing '}'
            const body = content.slice(braceIdx + 1, pos - 1);

            // found selector

            if (selector.startsWith("@media")) {
                // entering media block
                walk(body, bodyStart, { selector, start: bodyStart, end: bodyEnd });
            } else {
                // collect declarations
                const definitionRegex = /(--[\w-]+)\s*:\s*([^;]+?)\s*;/gd;
                let defMatch: RegExpExecArray | null;

                while ((defMatch = definitionRegex.exec(body))) {
                    const name = defMatch[1];
                    const valueRaw = defMatch[2];

                    const valueIndices = defMatch.indices![2];
                    const valueStart = bodyStart + valueIndices[0];
                    const valueEnd = bodyStart + valueIndices[1];

                    const decl: VariableDeclaration = {
                        name,
                        value: valueRaw.trim(),
                        startOffset: valueStart,
                        endOffset: valueEnd,
                        selector
                    };

                    if (mediaCtx) {
                        decl.media = mediaCtx.selector;
                        decl.mediaStart = mediaCtx.start;
                        decl.mediaEnd = mediaCtx.end;
                    }

                    varDeclarations.push(decl);
                }

                // recurse to find nested blocks (e.g. selectors inside selectors)
                walk(body, bodyStart, mediaCtx);
            }
        }
    }

    walk(text, 0, null);
    return varDeclarations;
}