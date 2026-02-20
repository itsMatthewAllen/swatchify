import * as vscode from 'vscode';
import { parseColor } from './colorParser';
import { splitColorArgs, parseAlpha, findVarFunctions, splitVarArguments, findEnclosingSelector } from './helper';
import { VariableDeclaration, resolveVariableAtPosition, resolveVariableAtPositionFromString } from './variableResolver';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('Color Variable Swatches is active.');

	const provider: vscode.DocumentColorProvider = {
		provideDocumentColors(document: vscode.TextDocument): vscode.ProviderResult<vscode.ColorInformation[]> {
			const text = document.getText();
			const colors: vscode.ColorInformation[] = [];

			// Prevent duplicate decorators
			const emitted = new Set<string>();

			function pushColor(range: vscode.Range, color: vscode.Color) {
				const key = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
				if (emitted.has(key)) {
					return;
				}
				emitted.add(key);
				colors.push(new vscode.ColorInformation(range, color));
			}

			// Collect all variable declarations within the file
			const varDeclarations: VariableDeclaration[] = [];
			const definitionRegex = /(--[\w-]+)\s*:\s*((?:[^;()]|\((?:[^()]|\([^()]*\))*\))+)\s*;/g;
			let defMatch: RegExpExecArray | null;

			const blockRegex = /([^{}]+)\{([\s\S]*?)\}/g;
			
			let blockMatch: RegExpExecArray | null;

			while ((blockMatch = blockRegex.exec(text))) {
				const selector = blockMatch[1].trim();
				const body = blockMatch[2];
				const blockStart = blockMatch.index + blockMatch[0].indexOf(body);

				let defMatch: RegExpExecArray | null;
				definitionRegex.lastIndex = 0;

				while ((defMatch = definitionRegex.exec(body))) {
					const name = defMatch[1];
					const valueRaw = defMatch[2];
					const valueTrimmed = valueRaw.trim();
					// const valueOffsetInMatch = valueRaw.indexOf(valueTrimmed);
					const startOffset = blockStart + defMatch.index + defMatch[0].indexOf(valueRaw);
					const endOffset = startOffset + valueRaw.length;

					varDeclarations.push({
						name,
						value: valueTrimmed,
						startOffset,
						endOffset,
						selector
					});
				}
			}

			// Pass 1: computed declarations (var(...) inside declarations)
			for (const decl of varDeclarations) {
				if (!decl.value.includes("var(")) {
					continue;
				}

				const usageSelector = decl.selector ?? null;

				const resolved = resolveVariableAtPositionFromString(
					decl.value,
					varDeclarations,
					decl.startOffset,
					usageSelector,
					new Set()
				);
				if (!resolved) {
					continue;
				}

				const color = parseColor(resolved.trim());
				if (!color) {
					continue;
				}

				const start = document.positionAt(decl.startOffset);
				const end = document.positionAt(decl.endOffset);

				pushColor(new vscode.Range(start, end), color);
			}

			// Pass 2: nested var() inside declarations (fallback chains)
			for (const decl of varDeclarations) {
				if (!decl.value.includes("var(")) {
					continue;
				}

				const localVars = findVarFunctions(decl.value);

				for (const v of localVars) {
					const [nameRaw, fallbackRaw] = splitVarArguments(v.content);
					const varName = nameRaw.trim();

					const resolvedValue = resolveVariableAtPosition(
						varName,
						varDeclarations,
						decl.startOffset,
						decl.selector ?? null,
						new Set()
					) ?? (
						fallbackRaw
							? resolveVariableAtPositionFromString(
								fallbackRaw.trim(),
								varDeclarations,
								decl.startOffset,
								decl.selector ?? null,
								new Set()
							) : null
					);

					if (!resolvedValue) {
						continue;
					}

					const color = parseColor(resolvedValue.trim());
					if (!color) {
						continue;
					}

					const absoluteStart = decl.startOffset + v.start;
					const absoluteEnd = decl.startOffset + v.end;

					const range = new vscode.Range(
						document.positionAt(absoluteStart),
						document.positionAt(absoluteEnd)
					);

					pushColor(range, color);
				}
			}

			// Pass 3: all var() usages outside declarations
			const vars = findVarFunctions(text);

			for (const v of vars) {
				const inDecl = varDeclarations.some(d => v.start >= d.startOffset && v.start <= d.endOffset);
				if (inDecl) {
					continue;
				}

				const [nameRaw, fallbackRaw] = splitVarArguments(v.content);
				const varName = nameRaw.trim();

				const usageSelector = findEnclosingSelector(text, v.start);

				let resolvedValue = resolveVariableAtPosition(
					varName,
					varDeclarations,
					v.start,
					usageSelector,
					new Set()
				);

				if (!resolvedValue && fallbackRaw) {
					resolvedValue = resolveVariableAtPositionFromString(
						fallbackRaw.trim(),
						varDeclarations,
						v.start,
						usageSelector,
						new Set()
					);
				}

				if (!resolvedValue) {
					continue;
				}

				const color = parseColor(resolvedValue.trim());
				if (!color) {
					continue;
				}

				const range = new vscode.Range(
					document.positionAt(v.start),
					document.positionAt(v.end)
				);

				pushColor(range, color);
			}

			return colors;
		},

		provideColorPresentations(color: vscode.Color): vscode.ProviderResult<vscode.ColorPresentation[]> {
			const r = Math.round(color.red * 255);
			const g = Math.round(color.green * 255);
			const b = Math.round(color.blue * 255);

			return [new vscode.ColorPresentation(`rgb(${r}, ${g}, ${b})`)];
		}
	};

	const selector: vscode.DocumentSelector = [
		{ language: 'css'},
		{ language: 'scss'},
		{ language: 'less'}
	];

	context.subscriptions.push(
		vscode.languages.registerColorProvider(selector, provider)
	);
}

export function deactivate() {}

