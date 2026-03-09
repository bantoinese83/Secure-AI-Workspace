# Architecture

## Overview

Single-user AI workspace with Claude via Bedrock, designed for HIPAA compliance.

## Data Flow

```
User → Next.js → API Gateway → Lambda → Bedrock
                    ↓
              DynamoDB
                    ↓
              S3 (PDFs)
```

## DynamoDB Schema (Single Table)

| Entity | PK | SK | Attributes |
|--------|----|----|------------|
| User | `USER#<userId>` | `PROFILE` | email, createdAt |
| Chat | `USER#<userId>` | `CHAT#<chatId>` | title, instructionBox, createdAt, updatedAt |
| Message | `CHAT#<chatId>` | `MSG#<timestamp>` | role, content, order |
| PDF | `CHAT#<chatId>` | `PDF#<pdfId>` | fileName, s3Key, extractedText, state |

## Message Assembly Order

1. Base system prompt
2. Instruction box text (per chat)
3. Text of Active PDFs
4. Recent conversation (last N messages)
5. User message

## PDF Extraction

- Upload: Presigned URL → S3 Put
- S3 trigger: Lambda extracts text (pdf-parse or Textract)
- Store extracted text in DynamoDB PDF item

## Web Search

- Only when user explicitly requests (e.g. "search the web")
- Tavily API called in Lambda
- Results passed as context to Claude
