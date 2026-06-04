import {
    Client,
    GatewayIntentBits,
    ChannelType
} from "discord.js";

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// threadId -> first user prompt only
const threadRoots = new Map();

client.once("clientReady", (c) => {
    console.log(`Logged in as ${c.user.tag}`);
});

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // -------------------------
    // NEW CONVERSATION
    // -------------------------
    if (
        message.channel.type === ChannelType.GuildText &&
        message.mentions.has(client.user)
    ) {
        const prompt = message.content
            .replace(
                new RegExp(`<@!?${client.user.id}>`, "g"),
                ""
            )
            .trim();

        const thread = await message.startThread({
            name: prompt.slice(0, 60) || "Jarvis Thread",
            autoArchiveDuration: 1440
        });

        threadRoots.set(thread.id, prompt);

        await runThread(thread);

        return;
    }

    // -------------------------
    // THREAD CONTINUATION
    // -------------------------
    if (message.channel.isThread()) {
        await runThread(message.channel);
    }
});

async function runThread(thread) {
    await thread.sendTyping();

    const root = threadRoots.get(thread.id);

    const fetched = await thread.messages.fetch({ limit: 100 });

    const history = [...fetched.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)

        // remove empty / junk / retry noise
        .filter(m =>
            m.content &&
            m.content.trim().length > 0 &&
            !m.content.includes("try again") &&
            !m.content.includes("restarted")
        )

        .map(m => ({
            role: m.author.id === client.user.id
                ? "assistant"
                : "user",
            content: m.content
        }));

    // -------------------------
    // FORCE STABLE ROOT CONTEXT
    // -------------------------
    const messages = [
        ...(root
            ? [{ role: "user", content: root }]
            : []),
        ...history
    ];

    const res = await fetch("http://localhost:3000/chat-json", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            address: "Discord",
            messages
        })
    });

    if (!res.ok) {
        const err = await res.text();
        console.error(err);
        await thread.send("Backend error.");
        return;
    }

    const data = await res.json();

    if (data.response?.trim()) {
        await thread.send(data.response);
    }
}

client.login(process.env.DISCORD_TOKEN);