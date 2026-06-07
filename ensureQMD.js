import { execSync } from "child_process";

function ensureCollection(path, name) {
    try {
        const collections = execSync("qmd collection list", {
            encoding: "utf8"
        });

        if (!collections.includes(name)) {
            console.log(`[QMD] Adding collection ${name}`);
            execSync(
                `qmd collection add ${path} --name ${name}`,
                { stdio: "inherit" }
            );
        }
    } catch (err) {
        console.error(`[QMD] Failed to ensure collection ${name}`, err);
    }
}

ensureCollection("./memory/journals", "journal");
ensureCollection("./memory/people", "people");
ensureCollection("./memory/previous_chats", "previous_chats");