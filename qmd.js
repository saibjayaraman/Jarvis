import { createStore } from "@tobilu/qmd";

export const store = await createStore({
    dbPath: "./memory.sqlite",
    config: {
        collections: {
            chats: { path: "./memory/previous_chats" },
            people: { path: "./memory/people" },
            journal: { path: "./memory/journal" }
        }
    }
});