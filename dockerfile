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
    ripgrep

# Node deps (cached layer)
COPY package*.json ./
RUN npm install

# App source
COPY . .

# Playwright browser install (needed for headless automation)
RUN npx playwright install chromium --with-deps

# Default runtime
CMD ["npm", "start"]