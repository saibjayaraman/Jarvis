const messagesEl = document.getElementById("messages");
const emptyState = document.getElementById("emptyState");
const input = document.getElementById("messageInput");
const button = document.getElementById("sendButton");
const locationStatus = document.getElementById("locationStatus");
const livePill = document.querySelector(".live-pill");

let cachedAddress = null;
let addressPromise = null;
let isBusy = false;

function formatAddress(data) {
    const a = data?.address;
    if (!a) return data?.display_name ?? null;

    const street = [a.house_number, a.road].filter(Boolean).join(" ");
    const city = a.city || a.town || a.village || a.hamlet || a.suburb;
    const parts = [street, city, a.state, a.postcode, a.country].filter(Boolean);
    return parts.join(", ");
}

function setLocationStatus(text) {
    if (!locationStatus) return;
    const textEl = locationStatus.querySelector(".status-text");
    locationStatus.hidden = !text;
    if (textEl) textEl.textContent = text;
    else locationStatus.textContent = text;
}

function setBusy(busy) {
    isBusy = busy;
    button.disabled = busy;
    if (livePill) {
        livePill.classList.toggle("busy", busy);
        const label = livePill.querySelector("span:last-child");
        if (label) label.textContent = busy ? "Working" : "Ready";
    }
}

function hideEmptyState() {
    messagesEl.classList.add("has-chat");
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderMarkdown(text) {
    const escaped = escapeHtml(text);
    const withBold = escaped.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    return withBold.replace(/\n/g, "<br>");
}

function autoResizeTextarea() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
}

function resolveAddress() {
    if (cachedAddress) return Promise.resolve(cachedAddress);
    if (addressPromise) return addressPromise;

    if (!navigator.geolocation) {
        setLocationStatus("Location unavailable");
        return Promise.resolve(null);
    }

    setLocationStatus("Locating…");
    addressPromise = new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                    const params = new URLSearchParams({
                        lat: String(latitude),
                        lon: String(longitude),
                        format: "json"
                    });
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?${params}`,
                        { headers: { "Accept-Language": "en" } }
                    );
                    const data = await res.json();
                    cachedAddress =
                        formatAddress(data) ??
                        `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                    setLocationStatus(cachedAddress);
                    resolve(cachedAddress);
                } catch {
                    cachedAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                    setLocationStatus(cachedAddress);
                    resolve(cachedAddress);
                } finally {
                    addressPromise = null;
                }
            },
            () => {
                setLocationStatus("Location denied");
                addressPromise = null;
                resolve(null);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
        );
    });

    return addressPromise;
}

resolveAddress();

function createMessageRow(role) {
    const row = document.createElement("div");
    row.className = `message-row ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = role === "user" ? "You" : "AI";

    const body = document.createElement("div");
    body.className = "message-body";

    const label = document.createElement("div");
    label.className = "message-label";
    label.textContent = role === "user" ? "You" : "Assistant";

    const bubble = document.createElement("div");
    bubble.className = "message";

    const content = document.createElement("div");
    content.className = "message-content";
    bubble.appendChild(content);

    const toolsEl = document.createElement("div");
    toolsEl.className = "message-tools";
    toolsEl.hidden = true;

    body.append(label, bubble, toolsEl);
    row.append(avatar, body);
    messagesEl.appendChild(row);

    return { row, bubble, content, toolsEl };
}

function setMessageContent(contentEl, bubble, text, { thinking = false } = {}) {
    bubble.classList.toggle("status-thinking", thinking);
    contentEl.innerHTML = thinking ? escapeHtml(text) : renderMarkdown(text);
}

function addToolChip(toolsEl, name, running = true) {
    toolsEl.hidden = false;
    const chip = document.createElement("span");
    chip.className = "tool-chip" + (running ? " running" : "");
    chip.textContent = name;
    chip.dataset.tool = name;
    toolsEl.appendChild(chip);
    return chip;
}

function finishToolChip(chip) {
    if (chip) chip.classList.remove("running");
}

function addMessage(text, role) {
    hideEmptyState();
    const { row, bubble, content } = createMessageRow(role);

    if (role === "assistant") {
        setMessageContent(content, bubble, text);
    } else {
        content.textContent = text;
    }

    scrollToBottom();
    return { row, bubble, content, toolsEl: row.querySelector(".message-tools") };
}

function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function consumeStream(response, assistant) {
    const { bubble, content, toolsEl } = assistant;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let textContent = "";
    const activeTools = new Map();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;

            const event = JSON.parse(line.slice(6));

            if (event.type === "status" && !bubble.dataset.hasTokens) {
                setMessageContent(content, bubble, event.content, { thinking: true });
                scrollToBottom();
            } else if (event.type === "token") {
                if (!bubble.dataset.hasTokens) {
                    textContent = "";
                    bubble.dataset.hasTokens = "1";
                    bubble.classList.remove("status-thinking");
                }
                textContent += event.content;
                setMessageContent(content, bubble, textContent);
                scrollToBottom();
            } else if (event.type === "tool") {
                if (!bubble.dataset.hasTokens) {
                    textContent = "";
                    bubble.dataset.hasTokens = "1";
                    bubble.classList.remove("status-thinking");
                }
                const chip = addToolChip(toolsEl, event.name, true);
                activeTools.set(event.name, chip);
                scrollToBottom();
            } else if (event.type === "error") {
                bubble.classList.add("error");
                bubble.classList.remove("status-thinking");
                setMessageContent(content, bubble, event.content);
            } else if (event.type === "done") {
                for (const chip of activeTools.values()) {
                    finishToolChip(chip);
                }
                if (!bubble.dataset.hasTokens && content.textContent === "Thinking…") {
                    setMessageContent(content, bubble, "");
                }
            }
        }
    }
}

async function send() {
    const text = input.value.trim();
    if (!text || isBusy) return;

    hideEmptyState();
    addMessage(text, "user");

    input.value = "";
    autoResizeTextarea();
    setBusy(true);

    const assistant = addMessage("", "assistant");
    setMessageContent(assistant.content, assistant.bubble, "Thinking…", { thinking: true });

    const address = await resolveAddress();

    try {
        const body = { message: text };
        if (address) body.address = address;

        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            assistant.bubble.classList.add("error");
            setMessageContent(assistant.content, assistant.bubble, "Something went wrong. Check the server logs.");
            return;
        }

        await consumeStream(response, assistant);
    } catch {
        assistant.bubble.classList.add("error");
        setMessageContent(assistant.content, assistant.bubble, "Could not reach the server.");
    } finally {
        setBusy(false);
        input.focus();
    }
}

button.addEventListener("click", send);

input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
    }
});

input.addEventListener("input", autoResizeTextarea);

document.querySelectorAll(".suggestion").forEach((btn) => {
    btn.addEventListener("click", () => {
        const prompt = btn.dataset.prompt;
        if (prompt) {
            input.value = prompt;
            autoResizeTextarea();
            input.focus();
        }
    });
});

autoResizeTextarea();
input.focus();
