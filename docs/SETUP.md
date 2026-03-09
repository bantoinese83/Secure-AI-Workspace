# Setup Guide — Secure AI Workspace

Step-by-step instructions to run the app locally and in production with AWS.

---

## Option A: Run in 5 minutes (no AWS)

Use this to try the app with in-memory data and mock AI responses.

1. **Clone and install**
   ```bash
   git clone https://github.com/bantoinese83/Secure-AI-Workspace.git
   cd Secure-AI-Workspace
   npm install
   ```

2. **Start the app**
   ```bash
   npm run dev
   ```

3. **Open in browser**  
   Go to [http://localhost:3000](http://localhost:3000). You’ll be signed in as a dev user with no password. Chats and PDFs are stored in memory (lost when you stop the server).

---

## Option B: Full setup with AWS

Follow these steps in order. You need an AWS account and Node.js 18+.

---

### Step 1: Clone and install

```bash
git clone https://github.com/bantoinese83/Secure-AI-Workspace.git
cd Secure-AI-Workspace
npm install
```

---

### Step 2: Create environment file

Copy the example file and open it in an editor:

```bash
cp .env.example .env.local
```

You will fill in values in the steps below. Keep `.env.local` private (it is in `.gitignore`).

---

### Step 3: AWS — Cognito (login)

1. In **AWS Console**, go to **Cognito** → **User Pools** → **Create user pool**.
2. **Sign-in options**: choose **Email**.
3. **Configure security requirements**: set password policy (e.g. default).
4. **Sign-up experience**: leave self-registration on if you want to sign up from the app, or turn it off and create a user in the console.
5. **Integrate your app**:  
   - **User pool name**: e.g. `secure-ai-workspace`.  
   - **App client**: Create an app client.  
     - App type: **Public client**.  
     - No client secret.  
     - Enable **Username password auth** (ALLOW_USER_PASSWORD_AUTH).  
   - Note the **User pool ID** and **App client ID**.
6. Create the pool.

**Add to `.env.local`:**
```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

(Optional) If you use an Identity Pool: create it in Cognito → Identity pools and set `NEXT_PUBLIC_IDENTITY_POOL_ID`.

---

### Step 4: AWS — DynamoDB (chats and messages)

1. In **AWS Console**, go to **DynamoDB** → **Tables** → **Create table**.
2. **Table name**: e.g. `secure-ai-workspace`.
3. **Partition key**: `PK` (String).
4. **Sort key**: `SK` (String).
5. **Table settings**: Default or on-demand capacity.
6. Create the table.

**Add to `.env.local`:**
```env
DYNAMODB_TABLE=secure-ai-workspace
```

---

### Step 5: AWS — S3 (PDF storage)

1. In **AWS Console**, go to **S3** → **Create bucket**.
2. **Bucket name**: e.g. `secure-ai-workspace-pdfs-<your-account-id>` (must be globally unique).
3. **Region**: Same as your other resources (e.g. `us-east-1`).
4. Block public access: keep **Block all public access** on (the app uses IAM, not public URLs).
5. Create the bucket.

**Add to `.env.local`:**
```env
S3_BUCKET=secure-ai-workspace-pdfs-xxxxxxxx
```

---

### Step 6: AWS — Bedrock (Claude)

1. In **AWS Console**, go to **Bedrock** → **Model access** (or **Get started**).
2. In **Manage model access**, enable **Anthropic** → **Claude 3.5 Sonnet** (or the model you want).
3. Wait until access is **Access granted**.

**Add to `.env.local`** (optional; app has a default):
```env
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

Use the exact model ID shown in Bedrock → Model access.

---

### Step 7: AWS — IAM (permissions)

The app needs an IAM user (or role) with permissions for Cognito, DynamoDB, S3, and Bedrock.

1. Go to **IAM** → **Users** → **Create user** (e.g. `secure-ai-workspace-app`).
2. **Attach policies** (or create one custom policy). Minimum permissions:
   - **AmazonDynamoDBFullAccess** (or restrict to your table and indexes).
   - **AmazonS3FullAccess** (or restrict to your bucket).
   - **AmazonBedrockFullAccess** (or restrict to `InvokeModel` / `InvokeModelWithResponseStream` on your model).
   - For Cognito: **AmazonCognitoPowerUser** or scoped to your User Pool (e.g. read User Pool, no Identity Pool needed for basic auth).
3. **Create access key** for this user (Access key → Create access key → Application running outside AWS).
4. Save the **Access key ID** and **Secret access key** (you can’t see the secret again).

**Add to `.env.local`:**
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

Use the same region as your DynamoDB table, S3 bucket, and Bedrock.

---

### Step 8: Tavily (web search, optional)

1. Go to [tavily.com](https://tavily.com), sign up, and get an API key.
2. **Add to `.env.local`:**
   ```env
   TAVILY_API_KEY=tvly-...
   ```
   Without this, web search in the app won’t call Tavily (you can still use the rest of the app).

---

### Step 9: Run the app locally

1. Ensure `.env.local` has at least:
   - `NEXT_PUBLIC_COGNITO_USER_POOL_ID`, `NEXT_PUBLIC_COGNITO_CLIENT_ID`
   - `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
   - `DYNAMODB_TABLE`, `S3_BUCKET`
   - (Optional) `BEDROCK_MODEL_ID`, `TAVILY_API_KEY`

2. Start the app:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000), sign up or sign in with Cognito, and use the workspace. Chats and PDFs are stored in DynamoDB and S3; AI uses Bedrock.

---

### Step 10: Run tests and build

```bash
npm run test
npm run build
```

Or run everything (lint, typecheck, format, tests, build):

```bash
npm run check
```

---

## Deploy to AWS Amplify (optional)

1. In **AWS Console**, go to **Amplify** → **Hosting** → **Get started** with GitHub (or your Git provider).
2. **Connect repository**: choose `bantoinese83/Secure-AI-Workspace` and branch `main`.
3. **Build settings** (Amplify usually detects Next.js):
   - Build command: `npm run build`
   - Output directory: `.next` (or leave default if Amplify uses Next.js SSR).
   - Node version: 18.
4. **Environment variables**: Add the same variables from `.env.local` in the Amplify Console (e.g. **Environment variables** in App settings). Do not commit `.env.local`.
5. Save and deploy. Amplify will build and give you a URL.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| "Chat not found" or empty list | `DYNAMODB_TABLE` and IAM permissions for DynamoDB. Same region as table. |
| PDF upload fails | `S3_BUCKET` and IAM permissions for S3. Bucket in same region. |
| No AI response / stream error | Bedrock model access enabled; `BEDROCK_MODEL_ID` correct; IAM has Bedrock invoke. |
| Login fails | `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_CLIENT_ID`; app client allows USER_PASSWORD_AUTH. |
| Web search does nothing | `TAVILY_API_KEY` set and valid. |

---

## Reference: `.env.local` template

After copying from `.env.example`, your `.env.local` can look like this (replace values):

```env
# Cognito
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# API (leave empty for local dev)
NEXT_PUBLIC_API_URL=

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
DYNAMODB_TABLE=secure-ai-workspace
S3_BUCKET=secure-ai-workspace-pdfs-xxxxxxxx
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0

# Tavily (optional)
TAVILY_API_KEY=tvly-...
```
