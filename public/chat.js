const messages = document.getElementById("messages");
const input = document.getElementById("messageInput");
const button = document.getElementById("sendButton");
const locationStatus = document.getElementById("locationStatus");

let cachedAddress = null;
let addressPromise = null;

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
    locationStatus.hidden = !text;
    locationStatus.textContent = text;
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

function setMessageContent(div, text) {
    div.innerHTML = renderMarkdown(text);
}

function addMessage(text, role) {
    const div = document.createElement("div");

    div.classList.add("message");
    div.classList.add(role);

    if (role === "assistant") {
        setMessageContent(div, text);
    } else {
        div.textContent = text;
    }

    messages.appendChild(div);

    messages.scrollTop = messages.scrollHeight;

    return div;
}

function scrollToBottom() {
    messages.scrollTop = messages.scrollHeight;
}

async function consumeStream(response, assistantDiv) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";

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

            if (event.type === "status" && !assistantDiv.dataset.hasTokens) {
                setMessageContent(assistantDiv, event.content);
                scrollToBottom();
            } else if (event.type === "token") {
                if (!assistantDiv.dataset.hasTokens) {
                    content = "";
                    assistantDiv.dataset.hasTokens = "1";
                }
                content += event.content;
                setMessageContent(assistantDiv, content);
                scrollToBottom();
            } else if (event.type === "tool") {
                if (!assistantDiv.dataset.hasTokens) {
                    content = "";
                    assistantDiv.dataset.hasTokens = "1";
                }
                content += `\n[${event.name}…]\n`;
                setMessageContent(assistantDiv, content);
                scrollToBottom();
            } else if (event.type === "error") {
                setMessageContent(assistantDiv, event.content);
            } else if (event.type === "done" && !assistantDiv.dataset.hasTokens) {
                if (assistantDiv.textContent === "Thinking…") {
                    setMessageContent(assistantDiv, "");
                }
            }
        }
    }
}

async function send() {
    const text = input.value.trim();

    if (!text) return;

    addMessage(text, "user");

    input.value = "";
    button.disabled = true;

    const assistantDiv = addMessage("", "assistant");
    const address = await resolveAddress();

    try {
        const body = { message: text };
        if (address) body.address = address;

        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            setMessageContent(assistantDiv, "Error talking to Ollama.");
            return;
        }

        await consumeStream(response, assistantDiv);
    } catch {
        setMessageContent(assistantDiv, "Error talking to Ollama.");
    } finally {
        button.disabled = false;
        input.focus();
    }
}

button.onclick = send;

input.addEventListener("keydown", e => {
    if (e.key === "Enter") send();
});
