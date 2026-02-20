export interface Specificity {
    a: number; // inline
    b: number; // ids
    c: number; // classes, attributes, pseudo-classes
    d: number; // elements, pseudo-elements
}

export function calculateSpecificity(selector: string | null): Specificity {
    if (!selector) {
        return { a: 0, b: 0, c: 0, d: 0 };
    }

    let b = 0, c = 0, d = 0;

    const parts = selector.split(/\s+/);

    for (const part of parts) {
        if (!part) {
            continue;
        }

        // ids
        b += (part.match(/#/g) || []).length;

        // classes, attributes, pseudo-classes
        c += (part.match(/\./g) || []).length;
        c += (part.match(/\[/g) || []).length;
        c += (part.match(/:(?!:)/g) || []).length;

        // elements
        if (/^[a-zA-Z]/.test(part)) {
            d++;
        }

        // pseudo-elements
        d += (part.match(/::/g) || []).length;
    }

    return { a: 0, b, c, d };
}

export function compareSpecificity(a: Specificity, b: Specificity): number {
    if (a.a !== b.a) {
        return a.a - b.a;
    }
    if (a.b !== b.b) {
        return a.b - b.b;
    }
    if (a.c !== b.c) {
        return a.c - b.c;
    }
    return a.d - b.d;
}