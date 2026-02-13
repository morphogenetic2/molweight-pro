const UUID_BYTE_LENGTH = 16;

function bytesToUuid(bytes: Uint8Array): string {
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
    return [
        hex.slice(0, 4).join(""),
        hex.slice(4, 6).join(""),
        hex.slice(6, 8).join(""),
        hex.slice(8, 10).join(""),
        hex.slice(10, 16).join(""),
    ].join("-");
}

export function createId(): string {
    if (typeof crypto !== "undefined") {
        if (typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }

        if (typeof crypto.getRandomValues === "function") {
            const bytes = new Uint8Array(UUID_BYTE_LENGTH);
            crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 0x0f) | 0x40; // UUID v4
            bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
            return bytesToUuid(bytes);
        }
    }

    throw new Error("Secure UUID generation is not available in this runtime.");
}
