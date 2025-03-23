FROM node:20

WORKDIR /app

COPY package*.json ./

COPY . .

EXPOSE 5173

CMD sh -c "npm install --include=dev && npm run dev -- --host 0.0.0.0"
