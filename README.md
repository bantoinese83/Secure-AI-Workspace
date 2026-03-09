# Secure AI Workspace

A single-user AI chat workspace using Amazon Bedrock (Claude), AWS Amplify, Cognito, S3, DynamoDB, and Tavily. Minimal dark UI with streaming responses, per-chat instructions, and PDF context.

**Repository:** [github.com/bantoinese83/Secure-AI-Workspace](https://github.com/bantoinese83/Secure-AI-Workspace)

```bash
git clone https://github.com/bantoinese83/Secure-AI-Workspace.git
cd Secure-AI-Workspace && npm install && npm run dev
```

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

- Node.js 18+
- AWS account with Bedrock, Cognito, S3, DynamoDB provisioned
- Tavily API key

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
# Cognito (required for auth)
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_IDENTITY_POOL_ID=your-identity-pool-id  # optional

# API (optional - uses /api for local dev)
NEXT_PUBLIC_API_URL=https://your-api-gateway-url

# AWS (required for production - DynamoDB, S3, Bedrock)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
DYNAMODB_TABLE=your-table-name
S3_BUCKET=your-bucket-name
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Tavily (for web search)
TAVILY_API_KEY=your-tavily-key
```

Without AWS env vars (`DYNAMODB_TABLE`, `S3_BUCKET`), the app uses in-memory storage and mock AI responses.

### 3. Run locally

```bash
npm run dev
```

Without Cognito env vars, the app runs in mock mode with a dev user.

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

## Deployment

### AWS Amplify

1. Connect your repo to Amplify
2. Set build settings:
   - Build command: `npm run build`
   - Output directory: `.next`
   - Node version: 18
3. Add environment variables in Amplify Console

### Lambda Backend (production)

Replace Next.js API routes with Lambda functions:

- `chat-api`: CRUD chats, messages, instruction box
- `chat-stream`: Bedrock streaming
- `pdf-upload`: S3 trigger for PDF text extraction
- `pdf-remove`: Delete PDF from S3 and DynamoDB

See `lambda/` directory for structure (to be implemented).

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
