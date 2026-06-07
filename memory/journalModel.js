import { Ollama } from "ollama";

const ollama = new Ollama({
    host: process.env.OLLAMA_URL
})

const MODEL =
    process.env.JOURNAL_MODEL ??
    "phi3.5:3.8b";

export async function generateJournal(
    chats
) {
    const prompt = `You are creating an episodic memory journal.

Your job is NOT to create a profile of the user.

Your job is to record NEW information from today's conversations. Here is the format:

# Daily Journal

## New Decisions

## New Project Updates

## New Knowledge

## New Preferences Learned

## Problems Encountered

## Open Tasks

Stick rigidly to the format, omitting sections if there is no information for them but never adding new ones.

DO NOT include:

- Existing user profile information
- Personality traits already known
- Existing project descriptions
- Existing long-term preferences
- Information that was not newly discovered today

ONLY include:

- New decisions made
- New project changes
- New goals
- New tasks
- New preferences discovered
- New facts learned
- Problems encountered
- Important discussions that may matter later

INFORMATION FROM USERS IS MUCH MORE IMPORTANT THAN INFORMATION FROM THE ASSISTANT. FOCUS MAINLY ON THAT.

If nothing new was learned, write:

# Daily Journal

No significant new information today.

Conversations:

${chats}
`;

    const response =
        await ollama.chat({
            model: MODEL,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        });
    return response.message.content.trim();
}