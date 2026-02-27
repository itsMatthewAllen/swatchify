import * as vscode from "vscode";
import { parseColor } from "../colorParser";
import { findEnclosingSelector, splitVarArguments } from "../helper";
import { VarUsage } from "./collectVarUsages";
import { VariableDeclarationMap } from "../variableIndex";
import { VariableResolver } from "../variableResolver";

export function buildColorInformations(
    document: vscode.TextDocument,
    text: string,
    varDeclarationMap: VariableDeclarationMap,
    varUsages: VarUsage[]
): vscode.ColorInformation[] {

    const resolver = new VariableResolver(varDeclarationMap);

    const colors: vscode.ColorInformation[] = [];
    const emitted = new Set<string>();

    function pushColor(range: vscode.Range, color: vscode.Color) {
        const key = `${range.start.line}:${range.start.character}-${range.end.line}:${range.end.character}`;
        if (emitted.has(key)) {
            return;
        }
        emitted.add(key);
        colors.push(new vscode.ColorInformation(range, color));
    }

    for (const usage of varUsages) {

        const usageSelector = findEnclosingSelector(text, usage.start);

        // Extract variable name and fallback from usage content
        // E.g., "--missing, rgb(255, 0, 0)" -> ["--missing", " rgb(255, 0, 0)"]
        const [varName, fallback] = splitVarArguments(usage.content);

        // Try to resolve the variable with fallback support
        let resolved = resolver.resolveWithFallback(
            varName.trim(),
            fallback,
            usage.start,
            usageSelector
        );

        if (!resolved) {
            continue;
        }

        console.log("RESOLVED:", usage.content, "=>", resolved);

        const color = parseColor(resolved.trim());
        if (!color) {
            continue;
        }

        const range = new vscode.Range(
            document.positionAt(usage.start),
            document.positionAt(usage.end)
        );

        pushColor(range, color);
    }

    return colors;
}