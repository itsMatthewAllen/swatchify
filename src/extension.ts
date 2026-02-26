import * as vscode from 'vscode';
import { collectVariableDeclarations } from './colorProvider/collectDeclarations';
import { collectVarUsages } from './colorProvider/collectVarUsages';
import { buildColorInformations } from './colorProvider/buildColorInformation';
import { buildVariableDeclarationMap } from './variableIndex';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('Color Variable Swatches is active.');

	const provider: vscode.DocumentColorProvider = {
		provideDocumentColors(document: vscode.TextDocument): vscode.ProviderResult<vscode.ColorInformation[]> {
			const text = document.getText();
			
			const varDeclarations = collectVariableDeclarations(text);
			const varDeclarationMap = buildVariableDeclarationMap(varDeclarations);

			const varUsages = collectVarUsages(text);

			return buildColorInformations(
				document,
				text,
				varDeclarationMap,
				varUsages
			);
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

