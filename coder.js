import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

export async function runCoder({ prompt, repo = "/app/workspace" }) {
    const provider = process.env.CODER_MODEL_PROVIDER;

    switch (provider) {

        case "ollama_local":
            return runAider({
                model: process.env.CODER_MODEL,
                prompt,
                repo,
                baseUrl: "http://localhost:11434"
            });

        case "ollama_remote":
            return runAider({
                model: process.env.CODER_MODEL,
                prompt,
                repo,
                baseUrl: process.env.OLLAMA_REMOTE_URL
            });

        case "claude":
            return runAiderClaude(prompt, repo);

        default:
            throw new Error("Unknown CODER_MODEL_PROVIDER: " + provider);
    }
}

async function runAiderOllama(prompt, repo, provider) {
    const url =
        provider === "ollama_remote"
            ? process.env.OLLAMA_REMOTE_URL
            : "http://localhost:11434";

    const cmd = `
        cd ${repo} && \
        OLLAMA_API_BASE=${url} \
        aider \
        --model ${process.env.CODER_MODEL} \
        --message "${escapeShell(prompt)}"
    `;

    return execAsync(cmd);
}