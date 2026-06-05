import fs from "fs/promises";
import path from "path";

import { generateJournal } from "./journalModel.js";

const CHATS_DIR = "./memory/previous_chats";
const JOURNAL_DIR = "./memory/journal";

const STATE_FILE = "./memory/state/journal.json";

const HOURS =
    Number(process.env.JOURNAL_INTERVAL ?? 24);

const INTERVAL =
    HOURS * 60 * 60 * 1000;

console.log(
    `[JOURNAL] worker running every ${HOURS}h`
);

async function getState() {
    try {
        const raw =
            await fs.readFile(
                STATE_FILE,
                "utf8"
            );

        return JSON.parse(raw);
    } catch {
        return {
            lastJournaled: null
        };
    }
}

async function saveState(state) {
    await fs.mkdir(
        "./memory/state",
        { recursive: true }
    );

    await fs.writeFile(
        STATE_FILE,
        JSON.stringify(
            state,
            null,
            2
        ),
        "utf8"
    );
}

async function getNewChats(lastJournaled) {
    const files =
        await fs.readdir(CHATS_DIR);

    const entries = [];

    for (const file of files) {
        if (!file.endsWith(".md"))
            continue;

        const content =
            await fs.readFile(
                path.join(
                    CHATS_DIR,
                    file
                ),
                "utf8"
            );

        const chunks =
            content.split(
                "## Timestamp"
            );

        for (const chunk of chunks) {
            const match =
                chunk.match(
                    /^\s*(.+?)\n/m
                );

            if (!match) continue;

            const timestamp =
                new Date(
                    match[1].trim()
                );

            if (
                lastJournaled &&
                timestamp <=
                    new Date(
                        lastJournaled
                    )
            ) {
                continue;
            }

            entries.push(
                `## Timestamp\n${chunk}`
            );
        }
    }

    return entries.join("\n\n");
}

async function run() {
    try {
        await fs.mkdir(
            JOURNAL_DIR,
            {
                recursive: true
            }
        );

        const state =
            await getState();

        const chats =
            await getNewChats(
                state.lastJournaled
            );

        if (!chats.trim()) {
            console.log(
                "[JOURNAL] no new chats"
            );
            return;
        }

        console.log(
            "[JOURNAL] generating..."
        );

        const journal =
            await generateJournal(
                chats
            );

        const now =
            new Date();

        const date =
            now
                .toISOString()
                .split("T")[0];

        await fs.writeFile(
            path.join(
                JOURNAL_DIR,
                `${date}.md`
            ),
            journal,
            "utf8"
        );

        state.lastJournaled =
            now.toISOString();

        await saveState(state);

        console.log(
            `[JOURNAL] wrote ${date}.md`
        );

    } catch (err) {
        console.error(
            "[JOURNAL] failed:",
            err
        );
    }
}

run();
setInterval(run, INTERVAL);