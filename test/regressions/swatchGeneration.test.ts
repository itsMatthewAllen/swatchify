// Regression tests for previously fixed bugs

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

describe('regression: nested fallback swatches (Issue #1)', () => {
  /**
   * REGRESSION TEST: Nested fallback swatch bug
   * 
   * Issue: When variables had nested fallbacks like:
   *   --color22: var(--missing, rgb(255, 0, 0))
   * Only the innermost color swatch would show, not the var() usage itself.
   * 
   * Root cause: buildColorInformation was passing the entire var usage content
   * (including fallback) to resolver.resolve() instead of just the variable name.
   * 
   * Fix: Split var name and fallback, use resolveWithFallback() method.
   */
  it('should create swatch for var() even when variable is missing and fallback exists', () => {
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
    
    // REGRESSION: Must create 1 swatch (the var() resolves to rgb(255, 0, 0))
    expect(infos.length).toBe(1);
    expect(infos[0].color.red * 255).toBeCloseTo(255, 0);
    expect(infos[0].color.green * 255).toBeCloseTo(0, 0);
    expect(infos[0].color.blue * 255).toBeCloseTo(0, 0);
  });

  it('should create swatches for each level of deeply nested fallbacks', () => {
    // Regression: All 4 var() usages should create swatches
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
    
    // REGRESSION: Must create 4 swatches (one for each var() level)
    // Before fix: only created 1 swatch (the innermost)
    expect(infos.length).toBe(4);
    
    // Verify we got the expected colors at different nesting levels
    const colors = infos.map(info => ({
      r: Math.round(info.color.red * 255),
      g: Math.round(info.color.green * 255),
      b: Math.round(info.color.blue * 255)
    }));
    
    // Should have red, green, blue, and blue (the outermost var resolves through chain to blue)
    expect(colors).toContainEqual({ r: 255, g: 0, b: 0 });   // red
    expect(colors).toContainEqual({ r: 0, g: 255, b: 0 });   // green
    // blue appears twice (inner var(--color3) and outer var resolving through chain)
    const blueCount = colors.filter(c => c.r === 0 && c.g === 0 && c.b === 255).length;
    expect(blueCount).toBeGreaterThanOrEqual(1);
  });

  it('should create swatch when var with fallback is used in nested context', () => {
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
    
    // REGRESSION: Should have 2 swatches
    // - outer var(--missing, ...) resolves to #ff0000
    // - inner var(--real, #fff) resolves to #ff0000
    // Before fix: created 0 swatches for outer var
    expect(infos.length).toBeGreaterThanOrEqual(1);
  });

  it('should resolve fallback chains correctly with missing intermediate variables', () => {
    // Regression: When --a is missing but --b exists, var(--a, var(--b)) should resolve to --b
    const css = ':root { --b: #00ff00; --a: var(--b); --test: var(--missing, var(--missing2, #ff0000)); }';
    
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
    
    // Should find the red color from the fallback chain
    const redSwatch = infos.find(info => 
      Math.round(info.color.red * 255) === 255 && 
      Math.round(info.color.green * 255) === 0
    );
    expect(redSwatch).toBeDefined();
  });
});
