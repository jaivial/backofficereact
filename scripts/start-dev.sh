#!/bin/bash
export PATH="/root/.bun/bin:$PATH"
cd /projects/newvillacarmen/backofficereact
bun --env-file .env.local server/index.ts
