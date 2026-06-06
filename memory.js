import { store } from "./qmd.js";

export async function searchMemory(query) {
    try {
        if (!query?.trim()) return "";

        const [lex, vec] = await Promise.all([
            store.searchLex(query, {
                limit: 5
            }),
            store.searchVector(query, {
                limit: 5
            })
        ]);

        const merged = [...lex, ...vec];

        console.log(
            `[MEMORY] lex=${lex.length} vec=${vec.length} merged=${merged.length}`
        );

        // dedupe by filepath
        const unique = new Map();

        for (const doc of merged) {
            unique.set(doc.filepath, doc);
        }

        const docs = [...unique.values()];

        // sort by score
        docs.sort(
            (a, b) =>
                (b.score ?? 0) -
                (a.score ?? 0)
        );

        // keep best few docs
        const selected = docs.slice(0, 5);

        // build limited context
        const maxChars =
            Number(process.env.MAX_MEMORY_CHARS ?? 4000);

        let output = "";

        for (const doc of selected) {
            const chunk =
                (doc.body ||
                    doc.content ||
                    doc.context ||
                    "") + "\n\n";

            if (
                output.length + chunk.length >
                maxChars
            ) {
                break;
            }

            output += chunk;
        }

        console.log(
            `[MEMORY] returning ${output.length} chars from ${selected.length} docs`
        );

return output;
    } catch (err) {
        console.error("searchMemory failed:", err);
        return "";
    }
}