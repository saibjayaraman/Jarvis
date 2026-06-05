import { store } from "./qmd.js";

export async function searchMemory(query) {
    try {
        if (!query?.trim()) return "";

        const [lex, vec] = await Promise.all([
            store.search({
                query,
                limit: 10,
                rerank: false
            }),
            store.searchVector(query, {
                limit: 10,
                rerank: false
            })
        ]);

        const merged = [...lex, ...vec];

        console.log(
            `[MEMORY] lex=${lex.length} vec=${vec.length} merged=${merged.length}`
        );

        const unique = [
            ...new Map(
                merged.map(r => [r.filepath || r.docid, r])
            ).values()
        ];

        unique.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

        const selected = unique.slice(0, 5);

        const memory = selected
            .map(r => {
                const body = r.body || "";

                return [
                    r.title && `# ${r.title}`,
                    body.slice(0, 1200)
                ]
                    .filter(Boolean)
                    .join("\n");
            })
            .join("\n\n---\n\n");

        console.log(
            `[MEMORY] returning ${memory.length} chars from ${selected.length} docs`
        );

        return memory;
    } catch (err) {
        console.error("searchMemory failed:", err);
        return "";
    }
}