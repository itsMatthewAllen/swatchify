import { findVarFunctions } from "../helper";

export interface VarUsage {
    start: number;
    end: number;
    content: string;
}

export function collectVarUsages(text: string): VarUsage[] {
    return findVarFunctions(text);
}