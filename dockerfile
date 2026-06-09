FROM node:22

WORKDIR /app

# System deps (Node + Python tooling for Aider + ripgrep for Aider search)
RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    python3-venv \
    pipx \
    curl \
    ripgrep && \
    rm -rf /var/lib/apt/lists/*

# Ensure pipx binaries are reachable
ENV PATH="/root/.local/bin:$PATH"

# Install Aider via pipx (isolated + stable)
RUN pipx install aider-chat

# Verify install (safe now that PATH is fixed)
RUN aider --version

# Node deps (cached layer)
COPY package*.json ./
RUN npm install

# App source
COPY . .

# Playwright browser install (needed for headless automation)
RUN npx playwright install chromium --with-deps

# Default runtime
CMD ["npm", "start"]