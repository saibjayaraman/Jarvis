import fs from "fs/promises";
import path from "path";

const BASE = "./memory/previous_chats";

export async function logThreadMessage(
    threadId,
    userMsg,
    assistantMsg
) {
    await fs.mkdir(BASE, { recursive: true });

    const filePath = path.join(
        BASE,
        `${threadId}.md`
    );

    const block = `## Timestamp
    ${new Date().toISOString()}

## User
${userMsg}

## Assistant
${assistantMsg}

`;

    await fs.appendFile(
        filePath,
        block,
        "utf-8"
    );
}