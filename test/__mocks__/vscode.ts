// minimal mock implementation of the vscode module for unit tests
export class Color {
  constructor(public red: number, public green: number, public blue: number, public alpha: number) {}
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export class Range {
  constructor(public start: any, public end: any) {}
}

export class ColorInformation {
  constructor(public range: any, public color: Color) {}
}

// other vscode stubs (if needed) can be added here
