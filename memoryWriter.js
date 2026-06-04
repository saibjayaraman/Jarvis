import fs from "fs/promises";

export async function writeMemory(memory) {
    try {
        const today = new Date().toISOString().slice(0, 10);

        // PEOPLE
        if (memory.people?.length) {
            await fs.mkdir("./memory/people", { recursive: true });

            await fs.appendFile(
                "./memory/people/sai.md",
                "\n" + memory.people.map(x => `- ${x}`).join("\n") + "\n"
            );
        }

        // JOURNAL
        if (memory.journal?.length) {
            await fs.mkdir("./memory/journal", { recursive: true });

            await fs.appendFile(
                `./memory/journal/${today}.md`,
                memory.journal.map(x => `- ${x}`).join("\n") + "\n"
            );
        }

        // CHAT SUMMARIES
        if (memory.summary) {
            await fs.mkdir("./memory/previous_chats", { recursive: true });

            await fs.writeFile(
                `./memory/previous_chats/${Date.now()}.md`,
                memory.summary
            );
        }

    } catch (err) {
        console.error("writeMemory failed:", err);
    }
}