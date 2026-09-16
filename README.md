# NOVA AI — Ask anything. Build anything.

NOVA AI is a polished full-stack AI assistant for everyday questions, coding, learning, research, document analysis, image understanding, and creative work.

## What is included

- Premium responsive landing page at `/`
- Authenticated ChatGPT-style workspace at `/chat`
- Manus OAuth session handling with protected server procedures
- Persistent conversations and messages in the project database
- Conversation history, search, rename, delete, and keyboard shortcuts
- Server-side LLM calls through the built-in Manus provider abstraction
- Model selector for NOVA Fast, NOVA Balanced, and NOVA Reasoning
- Chat, Search, Study, Coding, Analyze, and Creative modes
- Markdown assistant responses with copy and text-to-speech controls
- Image and document attachment upload through secure object storage
- Browser voice input where Speech Recognition is supported
- Dark/light theme support and reduced-motion handling
- Responsive sidebar/drawer layouts for desktop and mobile

## Technology

The project uses the Manus full-stack WebDev scaffold: React 19, Vite, TypeScript, Tailwind CSS, Framer Motion, Lucide React, tRPC, Drizzle ORM, MySQL/TiDB, Manus OAuth, built-in LLM APIs, and S3-compatible object storage.

## Local development

```bash
pnpm install
pnpm dev
```

Run the checks used before delivery:

```bash
pnpm check
pnpm test
pnpm build
```

## Data model

The schema in `drizzle/schema.ts` includes:

- `users` — authenticated Manus users
- `conversations` — user-owned chat metadata, mode, and model
- `messages` — chronological user and assistant messages
- `files` — secure object-storage metadata
- `usage` — provider token usage records

The migration is in `drizzle/0001_youthful_praxagora.sql` and has been applied to the project database.

## AI configuration

NOVA calls the server-side helper at `server/_core/llm.ts`, so provider credentials never reach browser code. The project runtime supplies the built-in Forge URL and key through its managed environment. The current mapping is:

| UI model | Built-in model |
| --- | --- |
| NOVA Fast | `gemini-3-flash-preview` |
| NOVA Balanced | `gemini-3-flash-preview` |
| NOVA Reasoning | `gemini-3.1-pro-preview` |

Provider failures are returned as friendly user-facing errors rather than raw stack traces.

## Storage and attachments

Uploads are validated to 12 MB, stored under a user-scoped key, and persisted as metadata in the `files` table. Image attachments are passed to the vision-capable model when available. Private documents are not made publicly readable by the application UI.

## Authentication

The scaffold uses Manus OAuth. The client calls `startLogin()` only from user actions, and protected tRPC procedures validate the authenticated user before reading or mutating conversations, messages, or files.

## Notes on streaming

The built-in `invokeLLM()` helper currently returns a completed response rather than exposing an SSE stream. NOVA preserves the intended interaction by progressively revealing the returned assistant response in the chat UI and providing a stop control. The server abstraction is isolated in `server/routers.ts`, so native SSE streaming can be added later without changing the product surface.

## Verification

The delivered build was verified with:

- `pnpm check`
- `pnpm test` — 2 test files, 4 tests passing
- `pnpm build`
- Desktop and mobile preview screenshots
- Live landing-page navigation and browser-console inspection
