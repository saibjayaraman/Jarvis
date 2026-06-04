import { store } from "./qmd.js";

const HOURS = Number(process.env.INDEXING_FREQUENCY ?? 24);
const INTERVAL = HOURS * 60 * 60 * 1000;

console.log(`[QMD] Indexer running every ${HOURS}h`);

const run = async () => {
    try {
        console.log("[QMD] Updating collections...");

        await store.update({
            collections: ["chats", "people", "journal"]
        });

        console.log("[QMD] Embedding documents...");

        await store.embed({
            chunkStrategy: "auto",
            force: false
        });

        console.log("[QMD] Indexing complete");
    } catch (err) {
        console.error("[QMD] Indexing failed:", err);
    }
};

// run once at startup
run();

// schedule repeats
setInterval(run, INTERVAL);