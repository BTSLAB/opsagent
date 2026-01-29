# OpsAgent — AI Operations Assistant

**OpsAgent** is an AI operations assistant platform by **BTS Labs**. It connects messaging channels (Telegram, WebChat) to AI coding agents via a local WebSocket gateway. Talk to your AI assistant through Telegram or the built-in web interface — it can execute code, browse the web, manage files, schedule tasks, and more.

## Install

Runtime: **Node >= 22**.

```bash
npm install -g opsagent@latest

opsagent onboard --install-daemon
```

## Quick Start

```bash
opsagent gateway --port 18789 --verbose

# Send a message
opsagent message send --to <chat-id> --message "Hello from OpsAgent"

# Talk to the assistant
opsagent agent --message "Ship checklist" --thinking high
```

## Features

- **Telegram** and **WebChat** interfaces
- **AI Agent Runtime** with tool execution (bash, browser, cron, media, web search)
- **Browser Automation** (Playwright/CDP)
- **Cron Scheduling** for recurring agent tasks
- **Plugin System** with lifecycle hooks
- **Memory System** with vector search (LanceDB)
- **Skills Platform** (50+ bundled skills)
- **Docker Support** for containerized deployment

## Development

```bash
git clone <your-repo-url>
cd opsagent
pnpm install
pnpm dev
```

## License

MIT License — See [LICENSE](LICENSE) for details.

Copyright (c) 2025 Peter Steinberger (original work)
Copyright (c) 2026 BTS Labs
