# {{ projectName }}

## Moost WebSocket Template

This template provides a standalone WebSocket application using Moost WS. It demonstrates how to handle WebSocket connections and messages with decorators.

## Prerequisites

- Node.js (v18 or later)
- A package manager like [npm](https://www.npmjs.com/)

## Installation

This template is installed via:

```bash
npm create moost@latest -- --ws
```

After the setup, navigate into the project folder and install dependencies:

```bash
cd {{ packageName }}
npm install
```

## Running Locally

### Development Mode

```bash
npm run dev
```

This command builds the project and starts the WebSocket server on port 3000.

### Build for Production

```bash
npm run build
node ./dist/main.js
```

## WebSocket Protocol

The server uses a JSON-based message protocol. Send messages in this format:

```json
{
  "event": "message",
  "data": { "text": "Hello!" }
}
```

The server will reply with:

```json
{
  "event": "message",
  "data": { "echo": { "text": "Hello!" } }
}
```

## Files Overview

- **`src/main.ts`** - Defines WebSocket handlers using decorators.
- **`rolldown.config.ts`** - Build configuration (including SWC for decorators).
- **`package.json`** - Contains scripts, dependencies, and configuration.

## Customization

- **Add New Message Handlers:** Use `@Message(event, path?)` to handle different event types.
- **Access Connection Info:** Use `@ConnectionId()` to get the connection UUID.
- **Use Rooms:** Import `useWsRooms()` from `@moostjs/event-ws` for room-based messaging.
