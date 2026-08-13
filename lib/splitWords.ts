export function splitWords(
    text: string | null | undefined,
    participants: number
) {
    const safeText = typeof text === "string" ? text : "";

    const normalized = safeText
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

    if (!normalized) {
        return Array.from({ length: participants }, () => "");
    }

    const blocks = normalized
        .split(/\n\s*\n+/)
        .map((block) => block.replace(/[ \t]+$/gm, "").trim())
        .filter((block) => block.length > 0);

    if (blocks.length === 0) {
        return Array.from({ length: participants }, () => "");
    }

    const chunks: string[] = Array.from({ length: participants }, () => "");

    blocks.forEach((block, index) => {
        const targetIndex = index % participants;
        chunks[targetIndex] = chunks[targetIndex]
            ? `${chunks[targetIndex]}\n\n${block}`
            : block;
    });

    return chunks;
}
