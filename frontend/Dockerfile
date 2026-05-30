FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

# Next.js dev server uses port 3000
EXPOSE 3000

CMD ["npm", "run", "dev"]
