FROM public.ecr.aws/docker/library/node:20-alpine AS deps
WORKDIR /app
COPY backoffice/package.json ./
RUN npm install --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY backoffice ./
ENV NODE_ENV=production
RUN npm run build
RUN node_modules/.bin/esbuild server/index.ts --bundle --platform=node --format=esm --packages=external --outfile=server/index.mjs

FROM public.ecr.aws/docker/library/node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/index.mjs ./server/index.mjs
COPY --from=build /app/package.json ./package.json
EXPOSE 3001
CMD ["node", "server/index.mjs"]
