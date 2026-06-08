FROM node:22

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    ripgrep

COPY package*.json ./

RUN npm install

RUN curl -LsSf https://aider.chat/install.sh | sh

COPY . .

RUN npx playwright install chromium --with-deps

CMD ["npm", "start"]