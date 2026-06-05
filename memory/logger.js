import fs from "fs/promises";
import path from "path";

const BASE = "./memory/previous_chats";

export async function logThreadMessage(threadId, userMsg, assistantMsg) {
    const filePath = path.join(BASE, `${threadId}.md`);

    await fs.mkdir(BASE, { recursive: true });

    const block = `
## User
${userMsg}

## Assistant
${assistantMsg}
`;

    await fs.appendFile(filePath, block, "utf-8");
}