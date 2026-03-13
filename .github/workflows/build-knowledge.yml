name: Build Knowledge Base

on:
  push:
    paths:
      - "docs/**"
      - "tools/build-knowledge.js"
      - "package.json"

jobs:
  build:
    runs-on: ubuntu-latest

    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Install dependencies
        run: npm install

      - name: Build knowledge base
        run: npm run build

      - name: Commit knowledge.json
        run: |
          git config --global user.name "github-actions"
          git config --global user.email "actions@github.com"
          git add data/knowledge.json
          git commit -m "Update knowledge base" || echo "No changes"
          git push
