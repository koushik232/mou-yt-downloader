# Use Node.js base image
FROM node:18

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Install yt-dlp
RUN apt-get update && apt-get install -y yt-dlp

# Copy app source
COPY . .

# Expose the port your app runs on
EXPOSE 3000

# Command to run your app
CMD ["npm", "start"]
