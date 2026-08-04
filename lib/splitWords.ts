export function splitWords(
    text: string,
    participants: number
) {
    const words = text.split(/\s+/);

    const size = Math.ceil(words.length / participants);

    const chunks = [];

    for (let i = 0; i < participants; i++) {
        chunks.push(
            words
                .slice(i * size, (i + 1) * size)
                .join(" ")
        );
    }

    return chunks;
}
