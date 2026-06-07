FROM node:22

WORKDIR /app

RUN apt-get update && apt-get install -y \
    git \
    python3 \
    python3-pip \
    ripgrep

COPY package*.json ./

RUN npm install

COPY . .

RUN npx playwright install --with-deps

RUN npm run add_collections

CMD ["npm", "start"]