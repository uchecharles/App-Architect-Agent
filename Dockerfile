# Base image with Node.js LTS
FROM node:20-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set default port for Cloud Run
ENV PORT=8080
EXPOSE 8080

# Run the TypeScript agent
CMD ["npx", "tsx", "index.ts"]