export function parseDilutionFactor(raw: string): number | null {
    const token = raw
        .trim()
        .toLowerCase()
        .replace(/[\u00d7*]/g, "x")
        .replace(/\s+/g, "");
    if (!token) return null;

    const simpleMatch = token.match(/^x?(\d*\.?\d+)$/);
    if (simpleMatch) {
        const factor = Number.parseFloat(simpleMatch[1]);
        return factor > 1 ? factor : null;
    }

    const oneToNMatch = token.match(/^1[:/](\d*\.?\d+)$/);
    if (oneToNMatch) {
        const factor = Number.parseFloat(oneToNMatch[1]);
        return factor > 1 ? factor : null;
    }

    const ratioMatch = token.match(/^(\d*\.?\d+)[:/](\d*\.?\d+)$/);
    if (!ratioMatch) return null;

    const left = Number.parseFloat(ratioMatch[1]);
    const right = Number.parseFloat(ratioMatch[2]);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
        return null;
    }

    const factor = right / left;
    return factor > 1 ? factor : null;
}
