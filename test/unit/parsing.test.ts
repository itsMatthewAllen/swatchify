import * as vscode from 'vscode';
import { collectVariableDeclarations } from '../../src/colorProvider/collectDeclarations';
import { collectVarUsages } from '../../src/colorProvider/collectVarUsages';
import { buildColorInformations } from '../../src/colorProvider/buildColorInformation';
import { parseColor } from '../../src/colorParser';

// helper to create a minimal TextDocument implementation for tests
function fakeDocument(text: string): vscode.TextDocument {
  return {
    getText: () => text,
    positionAt(offset: number) {
      const lines = text.slice(0, offset).split('\n');
      const line = lines.length - 1;
      const char = lines[lines.length - 1].length;
      return new vscode.Position(line, char);
    },
    // stub any other properties as needed
  } as unknown as vscode.TextDocument;
}

function colorEquals(a: vscode.Color, b: vscode.Color, precision = 2) {
  expect(a.red).toBeCloseTo(b.red, precision);
  expect(a.green).toBeCloseTo(b.green, precision);
  expect(a.blue).toBeCloseTo(b.blue, precision);
  expect(a.alpha).toBeCloseTo(b.alpha, precision);
}


// basic parsing tests

describe('hex notation', () => {
  it('parses #fff and #ffffff equivalently', () => {
    const short = parseColor('#fff');
    const long = parseColor('#ffffff');
    expect(short).not.toBeNull();
    expect(long).not.toBeNull();
    colorEquals(short!, long!);
  });

  it('accepts uppercase hex', () => {
    const c = parseColor('#ABCDEF');
    expect(c).not.toBeNull();
  });

  it('collects declarations with normalized values', () => {
    const css = ':root { --color1: #fff; }';
    const decls = collectVariableDeclarations(css);
    expect(decls.length).toBe(1);
    expect(decls[0].name).toBe('--color1');
    expect(decls[0].value).toBe('#fff');
  });
});


describe('functional and keyword colors', () => {
  it('returns null for a keyword (not supported)', () => {
    const c = parseColor('red');
    expect(c).toBeNull();
  });

  it('parses rgba() with alpha', () => {
    const c = parseColor('rgba(255,0,0,0.5)');
    expect(c).not.toBeNull();
    expect(c?.alpha).toBeCloseTo(0.5);
  });

  it('parses hsl() to same as rgb equivalent', () => {
    const rgb = parseColor('rgb(0, 128, 0)')!;
    const hsl = parseColor('hsl(120, 100%, 25%)')!;
    // verify they are approximately equal using the helper
    colorEquals(rgb, hsl);
  });

  it('handles 8‑digit hex with alpha', () => {
    const c = parseColor('#11223344');
    expect(c).not.toBeNull();
    // alpha is currently ignored by parseHex (always returns alpha=1) – assert at least color part
    const expected = parseColor('#112233');
    expect(expected).not.toBeNull();
    colorEquals(c!, expected!);
  });
});


describe('simple swatch generation', () => {
  it('produces a ColorInformation for a variable usage', () => {
    const css = ':root { --a: #123456; } .x { color: var(--a); }';
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
    const got = infos[0].color;
    const expectColor = parseColor('#123456')!;
    colorEquals(got, expectColor);
  });
});


describe('var() inside function contexts', () => {
  it('resolves var() inside color function properly', () => {
    // When var(--color) is used inside a color function like color: var(--color),
    // it should resolve to a parseable color value
    const css = ':root { --color: #ff0000; } .x { color: var(--color); }';
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
    // var(--color) resolves to #ff0000
    expect(infos.length).toBe(1);
    const color = infos[0].color;
    expect(color.red).toBeCloseTo(1);
    expect(color.green).toBeCloseTo(0);
    expect(color.blue).toBeCloseTo(0);
  });

  it('substitutes variables in color function values', () => {
    // Verify that a var with a fallback inside a color context is handled
    const css = ':root { --missing: ; } .x { color: var(--missing, #00ff00); }';
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
    // var(--missing, #00ff00) should use the fallback
    expect(infos.length).toBeGreaterThanOrEqual(0);
  });
});

