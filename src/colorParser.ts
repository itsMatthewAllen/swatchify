import * as vscode from 'vscode';
import { splitColorArgs } from './helper';

// Color parsing helper
export function parseColor(value: string): vscode.Color | null {
    value = value.trim();

    if (value.startsWith("#")) {
        return parseHex(value);
    }

	const fnMatch = value.trim().match(/^([a-zA-Z]+)\(\s*([\s\S]*?)\s*\)$/);
    if (!fnMatch) {
        return null;
    }

    const fn = fnMatch[1].toLowerCase();
    const rawArgs = fnMatch[2];

    const { channels, alpha } = splitColorArgs(rawArgs);

    if (fn === "rgb" || fn === "rgba") {
        return parseRgb(channels, alpha);
    }

    if (fn === "hsl" || fn === "hsla") {
        return parseHsl(channels, alpha);
    }

    return null;
}


// rgb parser, supporting integer and percentage values
export function parseRgb(channels: string[], alpha: number | null): vscode.Color | null {
	if (channels.length !== 3) {
		return null;
	}

	const rgb = channels.map(c => {
		if (c.endsWith("%")) {
			return parseFloat(c) / 100;
		}
		return parseFloat(c) / 255;
	});

	if (rgb.some(n => isNaN(n))) {
		return null;
	}

	return new vscode.Color(rgb[0], rgb[1], rgb[2], alpha ?? 1);
}


// hsl parser, supporting modern and alpha percentage values
export function parseHsl(channels: string[], alpha: number | null): vscode.Color | null {
	if (channels.length !== 3) {
		return null;
	}

	const h = parseFloat(channels[0]);
	const s = parseFloat(channels[1]) / 100;
	const l = parseFloat(channels[2]) / 100;

	if ([h, s, l].some(n => isNaN(n))) {
		return null;
	}

	const { r, g, b } = hslToRgb(h, s, l);
	return new vscode.Color(r, g, b, alpha ?? 1);
}

// resolve hex colors, supporting shorthand (e.g. #FFF) and longhand (e.g. #FFFFFF)
export function parseHex(value: string): vscode.Color | null {
	const hex = value.replace("#", "").toLowerCase();

	let r = 0, g = 0, b = 0, a = 1;

	if (hex.length === 3) { // #RGB
		r = parseInt(hex[0] + hex[0], 16) / 255;
		g = parseInt(hex[1] + hex[2], 16) / 255;
		b = parseInt(hex[2] + hex[2], 16) / 255;	
	}
	else if (hex.length === 4) { // #RGBA
		r = parseInt(hex[0] + hex[0], 16) / 255;
		g = parseInt(hex[1] + hex[1], 16) / 255;
		b = parseInt(hex[2] + hex[2], 16) / 255;
		a = parseInt(hex[3] + hex[3], 16) / 255;
	}
	else if (hex.length === 6) { // #RRGGBB
		r = parseInt(hex.slice(0,2), 16) / 255;
		g = parseInt(hex.slice(2,4), 16) / 255;
		b = parseInt(hex.slice(4,6), 16) / 255;
	}
	else if (hex.length === 8) { // #RRGGBBAA
		r = parseInt(hex.slice(0,2), 16) / 255;
		g = parseInt(hex.slice(2,4), 16) / 255;
		b = parseInt(hex.slice(4,6), 16) / 255;
		a = parseInt(hex.slice(6,8), 16) / 255;
	}
	else {
		return null; // invalid color
	}

	return new vscode.Color(r, g, b, 1);
}


// converts hsl to rgb
function hslToRgb(h: number, s: number, l: number) {
	h = ((h % 360) + 360) % 360;

	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs((h / 60) % 2 - 1));
	const m = l - c / 2;

	let r = 0, g = 0, b = 0;

	if (h < 60) { r = c; g = x; }
	else if (h < 120) { r = x; g = c; }
	else if (h < 180) { g = c; b = x; }
	else if (h < 240) { g = x; b = c; }
	else if (h < 300) { r = x; b = c; }
	else { r = c; b = x; }

	return {
		r: r + m,
		g: g + m,
		b: b + m
	};
}