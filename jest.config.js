module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  moduleNameMapper: {
    '^vscode$': '<rootDir>/test/__mocks__/vscode.ts'
  }
};