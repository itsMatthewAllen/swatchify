import { collectVariableDeclarations } from '../../src/colorProvider/collectDeclarations';
import { buildColorInformations } from '../../src/colorProvider/buildColorInformation';

// TODO: add helper utilities for normalizing colors if needed

describe('parsing basic color declarations', () => {
  it('should parse a simple hex variable', () => {
    // example skeleton
    const css = ':root { --color1: #fff; }';
    const decls = collectVariableDeclarations(css);
    expect(decls).toBeDefined();
  });

  // more tests will go here following the checklist in TEST_PLAN.md
});
