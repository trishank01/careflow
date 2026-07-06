# Frontend UI Dockerfile
# --- Stage 1: Build static assets ---

FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: Serve static files with Nginx ---
FROM nginx:1.25-alpine

#copy the built React application files the builder stage

COPY --from=builder /app/dist /usr/share/nginx/html

#Copy the custom Nginx configuration
COPY  nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD [ "nginx", "-g" , "daemon off;" ]


