export function splitWords(
    text: string | null | undefined,
    participants: number
) {
    const safeText = typeof text === "string" ? text : "";
    const normalized = safeText.replace(/\s+/g, " ").trim();

    if (!normalized) {
        return Array.from({ length: participants }, () => "");
    }

    const sentences = normalized
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);

    if (sentences.length === 0) {
        return Array.from({ length: participants }, () => "");
    }

    const chunks: string[] = [];
    const perParticipant = Math.max(1, Math.ceil(sentences.length / participants));

    for (let i = 0; i < participants; i++) {
        const start = i * perParticipant;
        const end = start + perParticipant;
        chunks.push(sentences.slice(start, end).join(" "));
    }

    return chunks;
}
