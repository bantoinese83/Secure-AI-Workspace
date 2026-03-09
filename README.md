# Secure AI Workspace

A single-user AI chat workspace using Amazon Bedrock (Claude), AWS Amplify, Cognito, S3, DynamoDB, and Tavily. Minimal dark UI with streaming responses, per-chat instructions, and PDF context.

**Repository:** [github.com/bantoinese83/Secure-AI-Workspace](https://github.com/bantoinese83/Secure-AI-Workspace)

---

## Quick start (no AWS)

Run the app in under a minute with in-memory data and mock AI:

```bash
git clone https://github.com/bantoinese83/Secure-AI-Workspace.git
cd Secure-AI-Workspace
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You’re in as a dev user; no login required.

---

## Full setup (with AWS)

For real login, persistent chats, PDF storage, and Claude via Bedrock:

1. **Clone and install** (same as above).
2. **Copy env file:** `cp .env.example .env.local`
3. **Follow the step-by-step guide:** [docs/SETUP.md](docs/SETUP.md)  
   It walks you through:
   - **Cognito** — User pool + app client for login
   - **DynamoDB** — One table (PK + SK) for chats and messages
   - **S3** — One bucket for PDFs
   - **Bedrock** — Enable Claude model access
   - **IAM** — User or role with access to DynamoDB, S3, Bedrock
   - **Tavily** — API key for web search (optional)
4. **Fill `.env.local`** with the values from the guide.
5. **Run:** `npm run dev` and open [http://localhost:3000](http://localhost:3000).

Deploy to **AWS Amplify** when ready — instructions are in [docs/SETUP.md](docs/SETUP.md).

---

## Features

- **Chat management**: Create, open, rename, and delete chats
- **Streaming AI responses**: Live streaming from Claude via Bedrock
- **Per-chat instruction box**: Custom instructions that apply to every response
- **PDF attachments**: Upload PDFs, mark as Active/Inactive, remove
- **Web search**: Explicit web search via Tavily (when user requests it)
- **Dark mode**: Near-black, minimalist design

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React 18, shadcn/ui, Tailwind |
| Auth | AWS Amplify Auth (Cognito) |
| Hosting | AWS Amplify |
| API | Next.js API routes (dev) / Lambda + API Gateway (prod) |
| AI | Amazon Bedrock (Claude) |
| Storage | S3 (PDFs), DynamoDB (chats, messages) |
| Web Search | Tavily API |

## Prerequisites

- **Node.js 18+** (for all setups)
- **AWS account** (only for full setup: Cognito, DynamoDB, S3, Bedrock)
- **Tavily API key** (optional; only for web search)

## Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_COGNITO_USER_POOL_ID` | For login | From Cognito User Pool |
| `NEXT_PUBLIC_COGNITO_CLIENT_ID` | For login | From Cognito App client |
| `AWS_REGION` | For AWS | e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | For AWS | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | For AWS | IAM secret key |
| `DYNAMODB_TABLE` | For persistence | Your DynamoDB table name |
| `S3_BUCKET` | For PDFs | Your S3 bucket name |
| `BEDROCK_MODEL_ID` | For AI | e.g. `anthropic.claude-3-5-sonnet-20241022-v2:0` |
| `TAVILY_API_KEY` | For web search | From tavily.com |

**If you leave AWS vars empty:** the app runs with in-memory storage and mock AI (no AWS needed).  
**If you leave Cognito vars empty:** you’re signed in as a dev user with no password.

## Quality Checks

Run all checks (lint, typecheck, format, build):

```bash
npm run check
```

Individual scripts:

- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript (strict, noUnusedLocals)
- `npm run format:check` - Prettier
- `npm run format` - Auto-format with Prettier
- `npm run test` - Vitest (unit + API route tests)
- `npm run test:watch` - Vitest watch mode

## Project Structure

```
src/
├── app/
│   ├── api/              # Next.js API routes (DynamoDB/S3 when configured)
│   ├── (auth)/login/     # Login page
│   └── workspace/        # Main workspace (protected)
├── components/
│   ├── auth/             # ProtectedRoute
│   ├── chat/             # ChatSidebar, ChatPanel, RightPanel, MessageBubble
│   └── layout/           # WorkspaceLayout
├── contexts/             # AuthContext, ToastContext
├── lib/                  # api, aws-config, db, s3, bedrock, tavily, pdf-extract
├── store/                # Zustand chat store
└── types/                # Chat, Message, PDF types
```

### DynamoDB schema

Single table with composite key `PK` (String) + `SK` (String):

| Entity | PK | SK |
|--------|----|----|
| Chat | `USER#<userId>` | `CHAT#<chatId>` |
| Message | `CHAT#<chatId>` | `MSG#<msgId>` |
| PDF | `CHAT#<chatId>` | `PDF#<pdfId>` |

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

**AWS Amplify:** Connect the GitHub repo, set build command `npm run build`, Node 18, and add the same env vars as in `.env.local`. Full steps: [docs/SETUP.md](docs/SETUP.md).

**Lambda (serverless API):** You can run the backend entirely on AWS Lambda + API Gateway (and S3 for PDFs). Three Lambdas are provided under `lambda/`:

| Lambda | Purpose | Trigger |
|--------|---------|--------|
| **chat-api** | CRUD for chats, messages, PDF list; presigned upload URL; PDF state and delete | API Gateway HTTP API (all non-stream chat/PDF routes) |
| **chat-stream** | Bedrock streaming + optional Tavily web search | API Gateway POST `/chats/{chatId}/stream` |
| **pdf-process** | Extract text from uploaded PDFs and write to DynamoDB | S3 Put on the PDF bucket (key: `userId/chatId/pdfId.pdf`) |

**Environment variables** (set on each Lambda, same as app):

- `DYNAMODB_TABLE`, `S3_BUCKET`, `AWS_REGION` (all three Lambdas)
- `BEDROCK_MODEL_ID` (chat-stream; default Claude model if omitted)
- `TAVILY_API_KEY` (chat-stream; optional, for web search)

**API Gateway (HTTP API):**

- Route **GET/POST** `/chats` → chat-api  
- Route **GET/PATCH/DELETE** `/chats/{chatId}` → chat-api  
- Route **GET** `/chats/{chatId}/messages` → chat-api  
- Route **GET** `/chats/{chatId}/pdfs` → chat-api  
- Route **POST** `/chats/{chatId}/pdfs/upload-url` → chat-api  
- Route **PATCH/DELETE** `/chats/{chatId}/pdfs/{pdfId}` → chat-api  
- Route **POST** `/chats/{chatId}/stream` → chat-stream  

Send **`x-user-id`** on every request (e.g. Cognito sub); chat-api and chat-stream use it for scoping.

**S3 trigger for pdf-process:**

- Bucket: same `S3_BUCKET` used for PDF uploads  
- Event: Object Create (Put)  
- Prefix/suffix: optional (e.g. no prefix so all `.pdf` keys are processed)  
- Lambda expects key format: `{userId}/{chatId}/{pdfId}.pdf` (matches presigned-URL upload path)

**Build and deploy each Lambda:**

```bash
cd lambda/chat-api && npm install && cd ../..
cd lambda/chat-stream && npm install && cd ../..
cd lambda/pdf-process && npm install && cd ../..
```

Zip each `lambda/<name>` directory (node_modules + index.mjs + package.json) and create/update the Lambda in the AWS Console or via CLI. Point API Gateway routes to the corresponding Lambda and add the S3 trigger for pdf-process.

## Acceptance Checklist

The build is complete when these all pass:

- [x] I can log in and see the workspace.
- [x] I can create a new chat, open an old chat, rename a chat, and delete a chat.
- [x] The center chat area is the largest part of the screen.
- [x] AI responses stream live.
- [x] Each AI response has a Copy button that copies plain text to the clipboard.
- [x] The instruction box is visible in the right panel and stays with that chat.
- [x] Changing instruction box text changes the AI behavior from the next response onward.
- [x] I can upload a PDF to a chat.
- [x] I can see each PDF listed with its Active or Inactive state.
- [x] I can change a PDF from Active to Inactive and back.
- [x] I can remove a PDF from a chat.
- [x] When I paste text and ask for editing, the AI edits the pasted text and does not pull from attached PDFs unless I ask it to.
- [x] Web search only happens when I explicitly ask for it.
- [x] When I reopen an old chat, the conversation, instructions, and PDFs are still there.
- [x] The interface is dark, clean, and uncluttered on desktop.
- [x] The interface is usable on a smaller screen without breaking.

## Security

Run `npm audit` to check for vulnerabilities. Some transitive dependencies (Next.js, ESLint) may report issues; fixes may require major version upgrades. Keep dependencies updated.

## Contributing

Clone the repo, create a branch, and open a pull request. Run `npm run check` before submitting.

## License

MIT — single user workspace.
