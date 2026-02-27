import { VariableResolver } from '../../src/variableResolver';
import { VariableDeclarationMap } from '../../src/variableIndex';

describe('variable resolution with fallbacks', () => {
  it('resolves to fallback when variable is undefined', () => {
    // When a variable value contains a fallback like `var(--missing, #123456)`,
    // and the variable --missing doesn't exist in the map, the fallback is used
    const map: VariableDeclarationMap = new Map([
      [
        '--wrapper',
        [
          {
            name: '--wrapper',
            value: 'var(--missing, #123456)',
            startOffset: 0,
            endOffset: 20,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // --wrapper contains a fallback to #123456
    const result = resolver.resolve('--wrapper', 0, ':root');
    expect(result).toBe('#123456');
  });

  it('prefers variable value over fallback when variable exists', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--defined',
        [
          {
            name: '--defined',
            value: '#ff0000',
            startOffset: 0,
            endOffset: 10,
            selector: ':root'
          }
        ]
      ],
      [
        '--wrapper',
        [
          {
            name: '--wrapper',
            value: 'var(--defined, #00ff00)',
            startOffset: 20,
            endOffset: 40,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // Should use the variable value #ff0000, not the fallback #00ff00
    const result = resolver.resolve('--wrapper', 0, ':root');
    expect(result).toBe('#ff0000');
  });

  it('handles nested fallback var(--a, var(--b, #fallback))', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--b',
        [
          {
            name: '--b',
            value: '#00ff00',
            startOffset: 0,
            endOffset: 10,
            selector: ':root'
          }
        ]
      ],
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b, #00ffff)',
            startOffset: 20,
            endOffset: 40,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // --a resolves to var(--b, #00ffff), and --b exists with value #00ff00
    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#00ff00');
  });

  it('falls through nested fallbacks when intermediate var is missing', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b, #0000ff)',
            startOffset: 0,
            endOffset: 20,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // --a resolves to var(--b, #0000ff), and --b does not exist, so use fallback #0000ff
    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#0000ff');
  });
});

describe('var() inside function contexts', () => {
  it('substitutes variable inside function', () => {
    // When --rgb is used inside rgba(var(--rgb), 0.5), the resolver
    // should resolve --rgb and allow it to be substituted
    const map: VariableDeclarationMap = new Map([
      [
        '--rgb',
        [
          {
            name: '--rgb',
            value: '255, 0, 0',
            startOffset: 0,
            endOffset: 15,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // var(--rgb) should resolve to "255, 0, 0"
    const result = resolver.resolve('--rgb', 0, ':root');
    expect(result).toBe('255, 0, 0');
  });

  it('resolves var with fallback inside function context', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--rgb-fallback',
        [
          {
            name: '--rgb-fallback',
            value: 'var(--missing, 100, 100, 255)',
            startOffset: 0,
            endOffset: 30,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // var(--missing, 100, 100, 255) should resolve to the fallback
    const result = resolver.resolve('--rgb-fallback', 0, ':root');
    expect(result).toBe('100, 100, 255');
  });
});

describe('simple variable chains', () => {
  it('resolves a simple two-level chain (A -> B)', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--b',
        [
          {
            name: '--b',
            value: '#0000ff',
            startOffset: 30,
            endOffset: 40,
            selector: ':root'
          }
        ]
      ],
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b)',
            startOffset: 0,
            endOffset: 12,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#0000ff');
  });

  it('resolves a three-level chain (A -> B -> C)', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--c',
        [
          {
            name: '--c',
            value: '#00ff00',
            startOffset: 60,
            endOffset: 70,
            selector: ':root'
          }
        ]
      ],
      [
        '--b',
        [
          {
            name: '--b',
            value: 'var(--c)',
            startOffset: 30,
            endOffset: 42,
            selector: ':root'
          }
        ]
      ],
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b)',
            startOffset: 0,
            endOffset: 12,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#00ff00');
  });

  it('resolves a five-level deep chain (A -> B -> C -> D -> E)', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--e',
        [
          {
            name: '--e',
            value: '#ff00ff',
            startOffset: 100,
            endOffset: 110,
            selector: ':root'
          }
        ]
      ],
      [
        '--d',
        [
          {
            name: '--d',
            value: 'var(--e)',
            startOffset: 80,
            endOffset: 92,
            selector: ':root'
          }
        ]
      ],
      [
        '--c',
        [
          {
            name: '--c',
            value: 'var(--d)',
            startOffset: 60,
            endOffset: 72,
            selector: ':root'
          }
        ]
      ],
      [
        '--b',
        [
          {
            name: '--b',
            value: 'var(--c)',
            startOffset: 30,
            endOffset: 42,
            selector: ':root'
          }
        ]
      ],
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b)',
            startOffset: 0,
            endOffset: 12,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#ff00ff');
  });
});

describe('recursive variable resolution with fallbacks', () => {
  it('resolves a chain where var points to another var with fallback', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--b',
        [
          {
            name: '--b',
            value: '#0000ff',
            startOffset: 30,
            endOffset: 40,
            selector: ':root'
          }
        ]
      ],
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b, #fallback-a)',
            startOffset: 0,
            endOffset: 20,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // --a resolves to var(--b, #fallback-a), and --b exists with value #0000ff
    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#0000ff');
  });

  it('uses fallback when intermediate var in chain is undefined', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b, #fallback-a)',
            startOffset: 0,
            endOffset: 20,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // --a resolves to var(--b, #fallback-a), and --b does not exist, so use fallback
    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#fallback-a');
  });

  it('resolves deep chain with fallback at the end', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--c',
        [
          {
            name: '--c',
            value: '#ff0000',
            startOffset: 60,
            endOffset: 70,
            selector: ':root'
          }
        ]
      ],
      [
        '--b',
        [
          {
            name: '--b',
            value: 'var(--c)',
            startOffset: 30,
            endOffset: 42,
            selector: ':root'
          }
        ]
      ],
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b, #fallback)',
            startOffset: 0,
            endOffset: 24,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // --a -> var(--b, #fallback) -> var(--c) -> #ff0000
    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#ff0000');
  });

  it('stops at first fallback that resolves to a color', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--c',
        [
          {
            name: '--c',
            value: '#00ff00',
            startOffset: 60,
            endOffset: 70,
            selector: ':root'
          }
        ]
      ],
      [
        '--b',
        [
          {
            name: '--b',
            value: 'var(--c, #fallback-b)',
            startOffset: 30,
            endOffset: 50,
            selector: ':root'
          }
        ]
      ],
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--nonexistent, var(--b, #fallback-a))',
            startOffset: 0,
            endOffset: 44,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // --a falls back to var(--b, #fallback-b) which resolves to #00ff00
    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#00ff00');
  });
});

describe('cycle detection', () => {
  it('detects direct self-reference and returns null', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--a)',
            startOffset: 0,
            endOffset: 12,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBeNull();
  });

  it('detects two-node cycle (A -> B -> A) and returns null', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b)',
            startOffset: 0,
            endOffset: 12,
            selector: ':root'
          }
        ]
      ],
      [
        '--b',
        [
          {
            name: '--b',
            value: 'var(--a)',
            startOffset: 20,
            endOffset: 32,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBeNull();
  });

  it('detects three-node cycle (A -> B -> C -> A) and returns null', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b)',
            startOffset: 0,
            endOffset: 12,
            selector: ':root'
          }
        ]
      ],
      [
        '--b',
        [
          {
            name: '--b',
            value: 'var(--c)',
            startOffset: 20,
            endOffset: 32,
            selector: ':root'
          }
        ]
      ],
      [
        '--c',
        [
          {
            name: '--c',
            value: 'var(--a)',
            startOffset: 40,
            endOffset: 52,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBeNull();
  });

  it('uses fallback when cycle is detected in primary var', () => {
    const map: VariableDeclarationMap = new Map([
      [
        '--a',
        [
          {
            name: '--a',
            value: 'var(--b, #fallback)',
            startOffset: 0,
            endOffset: 26,
            selector: ':root'
          }
        ]
      ],
      [
        '--b',
        [
          {
            name: '--b',
            value: 'var(--a)',
            startOffset: 30,
            endOffset: 42,
            selector: ':root'
          }
        ]
      ]
    ]);
    const resolver = new VariableResolver(map);

    // --a -> var(--b, #fallback) but --b points back to --a, so use fallback
    const result = resolver.resolve('--a', 0, ':root');
    expect(result).toBe('#fallback');
  });
});
