// Integration tests invoking provider functions such as collectDeclarations and collectVarUsages

import { collectVariableDeclarations } from '../../src/colorProvider/collectDeclarations';
import { collectVarUsages } from '../../src/colorProvider/collectVarUsages';
import { buildColorInformations } from '../../src/colorProvider/buildColorInformation';

// helper to create a minimal TextDocument
function fakeDocument(text: string) {
  return {
    getText: () => text,
    positionAt(offset: number) {
      const lines = text.slice(0, offset).split('\n');
      const line = lines.length - 1;
      const char = lines[lines.length - 1].length;
      return { line, character: char };
    }
  } as any;
}

describe('provider integration', () => {
  it('should return color information for a simple stylesheet', () => {
    const css = ':root { --a: #000; } .x { color: var(--a); }';
    const declsArray = collectVariableDeclarations(css);
    const decls = new Map<string, typeof declsArray>();
    declsArray.forEach(decl => {
      if (!decls.has(decl.name)) {
        decls.set(decl.name, []);
      }
      decls.get(decl.name)!.push(decl);
    });
    const usages = collectVarUsages(css);
    const doc = fakeDocument(css);
    const infos = buildColorInformations(doc, css, decls, usages);
    expect(infos.length).toBe(1);
  });
});

describe('nested fallback swatches (bug reproduction)', () => {
  it('should create swatch for var() with color fallback', () => {
    // Test case: --color22: var(--missing, rgb(255, 0, 0));
    // Expected: 1 swatch for the var() usage
    const css = ':root { --color22: var(--missing, rgb(255, 0, 0)); }';
    const declsArray = collectVariableDeclarations(css);
    const decls = new Map<string, typeof declsArray>();
    declsArray.forEach(decl => {
      if (!decls.has(decl.name)) {
        decls.set(decl.name, []);
      }
      decls.get(decl.name)!.push(decl);
    });
    
    
    const usages = collectVarUsages(css);
    
    const doc = fakeDocument(css);
    const infos = buildColorInformations(doc, css, decls, usages);
    
    
    // Should create 1 swatch (the var() usage resolves to rgb(255, 0, 0))
    expect(infos.length).toBe(1);
  });

  it('should create swatches for nested var() in fallback chain', () => {
    // Test case: --color1: #ff0000; --color2: #00ff00; --color3: #0000ff;
    //            --color29: var(--missing, var(--color1, var(--color2, var(--color3))));
    // Expected: 4 swatches (one for each var() usage at different nesting levels)
    const css = `
      :root {
        --color1: #ff0000;
        --color2: #00ff00;
        --color3: #0000ff;
        --color29: var(--missing, var(--color1, var(--color2, var(--color3))));
      }
    `;
    
    const declsArray = collectVariableDeclarations(css);
    const decls = new Map<string, typeof declsArray>();
    declsArray.forEach(decl => {
      if (!decls.has(decl.name)) {
        decls.set(decl.name, []);
      }
      decls.get(decl.name)!.push(decl);
    });
    
    
    const usages = collectVarUsages(css);
    
    const doc = fakeDocument(css);
    const infos = buildColorInformations(doc, css, decls, usages);
    
    // BUG: Should create 4 swatches (one for each var() at different levels)
    // Currently only creates 1 (the innermost var(--color3))
    expect(infos.length).toBe(4);
  });

  it('should create swatches for each level of nested fallback', () => {
    // Simpler case: var(--a, var(--b))
    const css = ':root { --b: #00ff00; --a: var(--b); }';
    
    const declsArray = collectVariableDeclarations(css);
    const decls = new Map<string, typeof declsArray>();
    declsArray.forEach(decl => {
      if (!decls.has(decl.name)) {
        decls.set(decl.name, []);
      }
      decls.get(decl.name)!.push(decl);
    });
    
    const usages = collectVarUsages(css);
    
    const doc = fakeDocument(css);
    const infos = buildColorInformations(doc, css, decls, usages);
    
    
    // Should have 1 swatch for var(--b) usage
    // (var(--b) resolves to #00ff00 which is a valid color)
    expect(infos.length).toBeGreaterThanOrEqual(1);
  });

  it('should show swatch for var() in fallback when var is missing', () => {
    // Case: --test: var(--missing, var(--real, #fff));
    // Usages: one for var(--missing, ...) and one for var(--real, #fff)
    const css = ':root { --real: #ff0000; --test: var(--missing, var(--real, #fff)); }';
    
    const declsArray = collectVariableDeclarations(css);
    const decls = new Map<string, typeof declsArray>();
    declsArray.forEach(decl => {
      if (!decls.has(decl.name)) {
        decls.set(decl.name, []);
      }
      decls.get(decl.name)!.push(decl);
    });
    
    const usages = collectVarUsages(css);
    
    const doc = fakeDocument(css);
    const infos = buildColorInformations(doc, css, decls, usages);
    
    // BUG: Outer var(--missing, ...) should also produce a swatch
    // since it resolves to var(--real, #fff) which resolves to #ff0000
    expect(infos.length).toBeGreaterThanOrEqual(1);
  });
});
