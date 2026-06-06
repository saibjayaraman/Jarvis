export async function extractMemory(brainChat, messages) {
    const prompt = `Analyze this conversation.

Return JSON:

{
  "people": [],
  "journal": [],
  "summary": ""
}

Only include durable information.
`;

    const response = await brainChat(
        {
            messages: [
                {
                    role: "system",
                    content: prompt
                },
                ...messages
            ]
        },
        process.env.QMD_SEARCH_MODEL_PROVIDER,
        process.env.QMD_SEARCH_MODEL,
        false
    );

    try {
        return JSON.parse(response.content);
    } catch {
        return null;
    }
}