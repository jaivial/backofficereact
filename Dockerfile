FROM oven/bun:1-alpine
WORKDIR /app
COPY backoffice/package.json backoffice/bun.lock ./
RUN bun install --frozen-lockfile
COPY backoffice ./
ENV NODE_ENV=production
RUN bun run build
EXPOSE 3001
CMD ["bun", "run", "start"]
