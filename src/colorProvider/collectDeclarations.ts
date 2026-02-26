import { VariableDeclaration } from "../variableIndex";

export function collectVariableDeclarations(text: string): VariableDeclaration[] {
    const varDeclarations: VariableDeclaration[] = [];

    const blockRegex = /([^{}]+)\{([\s\S]*?)\}/gd;
    let blockMatch: RegExpExecArray | null;

    while ((blockMatch = blockRegex.exec(text))) {
        const selector = blockMatch[1].trim();
        const body = blockMatch[2];

        const bodyStart = blockMatch.indices![2][0];

        // Match variable declarations: --name: value;
        // The value can contain anything except a top-level semicolon
        const definitionRegex = /(--[\w-]+)\s*:\s*([^;]+?)\s*;/gd;

        let defMatch: RegExpExecArray | null;

        while ((defMatch = definitionRegex.exec(body))) {
            const name = defMatch[1];
            const valueRaw = defMatch[2];

            const valueIndices = defMatch.indices![2];
            const valueStart = bodyStart + valueIndices[0];
            const valueEnd = bodyStart + valueIndices[1];

            varDeclarations.push({
                name,
                value: valueRaw.trim(),
                startOffset: valueStart,
                endOffset: valueEnd,
                selector
            });
        }
    }

    return varDeclarations;
}