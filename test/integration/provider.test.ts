// Integration tests invoking provider functions such as collectDeclarations and collectVarUsages

import { collectVariableDeclarations } from '../../src/colorProvider/collectDeclarations';
import { collectVarUsages } from '../../src/colorProvider/collectVarUsages';
import { buildColorInformations } from '../../src/colorProvider/buildColorInformation';

describe('provider integration', () => {
  it('should return color information for a simple stylesheet', () => {
    const css = ':root { --a: #000; } .x { color: var(--a); }';
    // TODO: run through actual functions and assert ranges/values
  });
});
