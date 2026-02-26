import { VariableResolver } from '../../src/variableResolver';
import { VariableDeclarationMap } from '../../src/variableIndex';

describe('VariableResolver utility helpers', () => {
  const resolver = new VariableResolver(new Map() as VariableDeclarationMap);
  const extract = (resolver as any).extractVarFunction.bind(resolver);

  it('extracts the contents of a simple var()', () => {
    expect(extract('var(--a)', 0)).toEqual({
      innerContent: '--a',
      endIndex: 8          // closing parenthesis is at index 7
    });
  });

  it('handles fallbacks and nested parentheses', () => {
    expect(extract('var(--x, rgb(1,2,3)) foo', 0)).toEqual({
      innerContent: '--x, rgb(1,2,3)',
      endIndex: 20         // matches the actual position in the string
    });
  });
});
