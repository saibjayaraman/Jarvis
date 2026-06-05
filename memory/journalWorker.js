import fs from "fs/promises";

const CHAT_DIR = "./memory/previous_chats";
const JOURNAL_DIR = "./memory/journal";

export async function buildDailyJournal(phiModel) {
    const files = await fs.readdir(CHAT_DIR);

    const chats = await Promise.all(
        files.map(f =>
            fs.readFile(`${CHAT_DIR}/${f}`, "utf-8")
        )
    );

    const prompt = `
Convert the following chat logs into a structured daily journal.

Focus on:
- key events
- decisions
- tasks
- project changes
- user intent

Chats:
${chats.join("\n\n---\n\n")}
`;

    const journal = await phiModel(prompt);

    const date = new Date().toISOString().slice(0, 10);

    await fs.writeFile(
        `${JOURNAL_DIR}/${date}.md`,
        journal
    );
}