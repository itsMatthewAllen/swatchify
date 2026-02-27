import { VariableResolver } from '../../src/variableResolver';
import { VariableDeclarationMap } from '../../src/variableIndex';
import { collectVariableDeclarations } from '../../src/colorProvider/collectDeclarations';
import { collectVarUsages } from '../../src/colorProvider/collectVarUsages';
import { buildColorInformations } from '../../src/colorProvider/buildColorInformation';

// minimal TextDocument stub used by several tests
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

describe('variable scoping and cascade', () => {
  it('prefers local scope over :root', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--color',
        [
          {
            name: '--color',
            value: '#ff0000',
            startOffset: 10,
            endOffset: 20,
            selector: ':root'
          },
          {
            name: '--color',
            value: '#00ff00',
            startOffset: 50,
            endOffset: 60,
            selector: '.myclass'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // When resolved at a position within .myclass, should use local declaration (#00ff00)
    // Assuming position 55 is within the .myclass block
    const result = resolver.resolve('--color', 55, '.myclass');
    expect(result).toBe('#00ff00');
  });

  it('falls back to :root when no local declaration exists', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--color',
        [
          {
            name: '--color',
            value: '#0000ff',
            startOffset: 10,
            endOffset: 20,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // No .myclass declaration, should use :root
    const result = resolver.resolve('--color', 100, '.myclass');
    expect(result).toBe('#0000ff');
  });

  it('respects CSS cascade: last declaration wins at same specificity', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--color',
        [
          {
            name: '--color',
            value: '#ff0000',
            startOffset: 10,
            endOffset: 20,
            selector: ':root'
          },
          {
            name: '--color',
            value: '#00ff00',
            startOffset: 30,
            endOffset: 40,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // When both declarations are in :root, later one wins
    const result = resolver.resolve('--color', 100, ':root');
    expect(result).toBe('#00ff00');
  });

  it('uses highest specificity: .class > element', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--color',
        [
          {
            name: '--color',
            value: '#0000ff',
            startOffset: 10,
            endOffset: 20,
            selector: 'div'
          },
          {
            name: '--color',
            value: '#ff00ff',
            startOffset: 50,
            endOffset: 60,
            selector: '.container'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // .container has higher specificity than div; should pick .container
    const result = resolver.resolve('--color', 55, '.container');
    expect(result).toBe('#ff00ff');
  });

  it('applies document order within same selector', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--color',
        [
          {
            name: '--color',
            value: '#111111',
            startOffset: 100,
            endOffset: 110,
            selector: '.item'
          },
          {
            name: '--color',
            value: '#222222',
            startOffset: 120,
            endOffset: 130,
            selector: '.item'
          },
          {
            name: '--color',
            value: '#333333',
            startOffset: 140,
            endOffset: 150,
            selector: '.item'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // At position 145 (inside the third .item block), use the latest one before position
    const result = resolver.resolve('--color', 145, '.item');
    expect(result).toBe('#333333');
  });

  it('scopes variable usage to declaration positions', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--color',
        [
          {
            name: '--color',
            value: '#aaaaaa',
            startOffset: 50,
            endOffset: 60,
            selector: '.early'
          },
          {
            name: '--color',
            value: '#bbbbbb',
            startOffset: 100,
            endOffset: 110,
            selector: '.late'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // A usage at position 75 (between the two) in .early scope should use #aaaaaa
    const resultEarly = resolver.resolve('--color', 75, '.early');
    expect(resultEarly).toBe('#aaaaaa');

    // A usage at position 105 in .late scope should use #bbbbbb
    const resultLate = resolver.resolve('--color', 105, '.late');
    expect(resultLate).toBe('#bbbbbb');
  });

  it('handles variable shadowing: redefinition in same selector after previous', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--x',
        [
          {
            name: '--x',
            value: 'var(--y)',
            startOffset: 10,
            endOffset: 22,
            selector: '.box'
          },
          {
            name: '--x',
            value: '#ff0000',
            startOffset: 30,
            endOffset: 40,
            selector: '.box'
          }
        ]
      ],
      [
        '--y',
        [
          {
            name: '--y',
            value: '#00ff00',
            startOffset: 50,
            endOffset: 60,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // At position 35 (within the second, literal declaration), use #ff0000
    const result = resolver.resolve('--x', 35, '.box');
    expect(result).toBe('#ff0000');
  });

  it('resolves variable from matching scope (current scope matching behavior)', () => {
    // NOTE: This test documents the current scope-matching behavior.
    // The resolver uses selectorMatches() which may be too permissive.
    const map: VariableDeclarationMap = new Map([
      [
        '--width',
        [
          {
            name: '--width',
            value: '100px',
            startOffset: 10,
            endOffset: 20,
            selector: ':root'
          },
          {
            name: '--width',
            value: '50px',
            startOffset: 50,
            endOffset: 60,
            selector: '.parent'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // Current behavior: With a .child selector and position 80,
    // the scoping logic picks the .parent declaration (which may be overly broad matching)
    const result = resolver.resolve('--width', 80, '.child');
    // This test documents what actually happens; a future fix may change this
    expect(result).toBe('50px');
  });

  it('ignores media query declaration when usage is outside of it', () => {
    const css = `
      :root { --color1: #ff0000; }
      @media screen and (min-width: 500px) {
        body { --color1: #00ff00; }
      }
      body { color: var(--color1); }
    `;

    const decls = collectVariableDeclarations(css).reduce((m, d) => {
      if (!m.has(d.name)) m.set(d.name, []);
      m.get(d.name)!.push(d);
      return m;
    }, new Map<string, any>());

    const usages = collectVarUsages(css);
    const doc = fakeDocument(css);
    const infos = buildColorInformations(doc, css, decls, usages);

    // red should win because usage is outside the media block
    expect(infos.length).toBe(1);
    const rgb = infos[0].color;
    expect(rgb.red * 255).toBeCloseTo(255, 0);
    expect(rgb.green * 255).toBeCloseTo(0, 0);
    expect(rgb.blue * 255).toBeCloseTo(0, 0);
  });

  it('still respects selector specificity even inside the query', () => {
    const css = `
      :root { --color1: #ff0000; }
      @media screen and (min-width: 500px) {
        body { --color1: #00ff00; }
        body { color: var(--color1); }
      }
    `;

    const decls = collectVariableDeclarations(css).reduce((m, d) => {
      if (!m.has(d.name)) m.set(d.name, []);
      m.get(d.name)!.push(d);
      return m;
    }, new Map<string, any>());

    const usages = collectVarUsages(css);
    const doc = fakeDocument(css);
    const infos = buildColorInformations(doc, css, decls, usages);

    // despite being inside the media query, :root is more specific than body
    // so the red value still wins
    expect(infos.length).toBe(1);
    const rgb = infos[0].color;
    expect(rgb.red * 255).toBeCloseTo(255, 0);
    expect(rgb.green * 255).toBeCloseTo(0, 0);
    expect(rgb.blue * 255).toBeCloseTo(0, 0);
  });

  it('allows a more specific selector inside media to override :root', () => {
    const css = `
      :root { --color1: #ff0000; }
      @media screen and (min-width: 500px) {
        body.foo { --color1: #00ff00; }
        body.foo { color: var(--color1); }
      }
    `;

    const decls = collectVariableDeclarations(css).reduce((m, d) => {
      if (!m.has(d.name)) m.set(d.name, []);
      m.get(d.name)!.push(d);
      return m;
    }, new Map<string, any>());

    const usages = collectVarUsages(css);
    const doc = fakeDocument(css);
    const infos = buildColorInformations(doc, css, decls, usages);

    // now the selector body.foo is more specific than :root, so green should win
    expect(infos.length).toBe(1);
    const rgb = infos[0].color;
    expect(rgb.red * 255).toBeCloseTo(0, 0);
    expect(rgb.green * 255).toBeCloseTo(255, 0);
    expect(rgb.blue * 255).toBeCloseTo(0, 0);
  });
});
