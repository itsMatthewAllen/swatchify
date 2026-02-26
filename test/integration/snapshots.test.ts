// Snapshot tests for provider output

describe('snapshot tests', () => {
  it('should generate consistent snapshot for a sample file', () => {
    const sample = ':root { --x: #f00; } .a { color: var(--x); }';
    expect(sample).toMatchSnapshot();
    // TODO: replace sample with real provider output
  });
});
