import { store } from "./qmd.js";

export async function refreshMemory() {
    try {
        await store.update({
            collections: ["chats", "people", "journal"]
        });

        await store.embed({
            chunkStrategy: "auto"
        });

    } catch (err) {
        console.error("QMD refresh failed:", err);
    }
}