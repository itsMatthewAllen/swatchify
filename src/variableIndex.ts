export interface VariableDeclaration {
    name: string;
    value: string;
    startOffset: number;
    endOffset: number;
    selector?: string;
    // optional media query context in which this declaration appears
    media?: string | null;
    // range of the media block (if any) - useful for determining whether a
    // usage offset lies inside the same media context
    mediaStart?: number;
    mediaEnd?: number;
}

export type VariableDeclarationMap = Map<string, VariableDeclaration[]>;

export function buildVariableDeclarationMap(
    declarations: VariableDeclaration[]
): VariableDeclarationMap {
    const map: VariableDeclarationMap = new Map();

    for (const decl of declarations) {
        if (!map.has(decl.name)) {
            map.set(decl.name, []);
        }
        map.get(decl.name)!.push(decl);
    }

    // sort for binary search
    for (const [, list] of map) {
        list.sort((a, b) => a.startOffset - b.startOffset);
    }

    return map;
}