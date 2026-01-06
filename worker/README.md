# Submission Handler Worker

A Cloudflare Worker that processes form submissions by sending email notifications and automatically syncing responses to a GitHub repository.

## Features

- 📧 Send email notifications for new submissions
- 📝 Automatically create response files in GitHub
- 🖼️ Handle and upload submission images
- 🔄 Parallel processing of email and GitHub updates
- ❌ Graceful error handling with detailed feedback
- 🚫 Built-in honeypot spam protection

## Architecture

The worker is split into modular components:

- **`index.js`** - Main entry point, request handling, and error orchestration
- **`email.js`** - Email sending via MailChannels
- **`github.js`** - GitHub API integration for syncing responses

## Prerequisites

- Node.js 16+
- npm
- Cloudflare account with Workers enabled
- GitHub personal access token
- A custom domain for email sending (MailChannels requirement)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Edit `wrangler.toml` and add the following environment variables:

```toml
[env.production]
vars = {
  SENDER_EMAIL = "noreply@yourdomain.com",
  DESTINATION_EMAIL = "your-email@example.com",
  GITHUB_OWNER = "your-github-username",
  GITHUB_REPO = "your-repo-name",
  GITHUB_TOKEN = "your-github-token"
}
```

**Required Variables:**
- `SENDER_EMAIL` - Email address to send from (must be from a domain you control)
- `DESTINATION_EMAIL` - Email address to receive notifications
- `GITHUB_OWNER` - GitHub username or organization
- `GITHUB_REPO` - Repository name where responses will be stored
- `GITHUB_TOKEN` - GitHub personal access token with `repo` scope

### 3. Set Up MailChannels DNS

For email sending to work, add this TXT record to your domain's DNS:

```
_mailchannels.yourdomain.com  TXT  "v=mc1 cfid=your-worker-subdomain.workers.dev"
```

Replace `yourdomain.com` with your domain and `your-worker-subdomain` with your actual worker subdomain.

### 4. Create GitHub Token

1. Go to [GitHub Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Create a new token with `repo` scope
3. Add it to `wrangler.toml` as `GITHUB_TOKEN`

### 5. Initialize GitHub Response Directory

Create the responses directory structure in your repository:

```bash
mkdir -p responses
echo '{"count": 0, "responses": []}' > responses/meta.json
```

## Development

Run the local development server:

```bash
npm run dev
```

The worker will be available at `http://localhost:8787`

## Deployment

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

Or with a specific environment:

```bash
npm run deploy -- --env production
```

## API Reference

### POST `/`

Submit a new response with optional files.

#### Request

```json
{
  "subject": "Submission Title (optional)",
  "message": "The user's response text",
  "replyTo": "optional-email@example.com",
  "files": [
    {
      "name": "photo.jpg",
      "type": "image/jpeg",
      "data": "base64-encoded-file-content"
    }
  ],
  "honeypot": "",
  "lang": "en"
}
```

**Fields:**
- `message` - **Required**. The submission text
- `subject` - Optional. Email subject line
- `replyTo` - Optional. Reply-to email address
- `files` - Optional. Array of file objects (max 10 files)
- `honeypot` - Optional. Spam protection field (should be empty)
- `lang` - Optional. Language code (`en` or `de`)

#### Responses

**Success (200)**
```json
{
  "success": true
}
```

**Partial Success (202)**
```json
{
  "success": true,
  "warning": "Submission received but email notification failed. Your submission may not appear immediately."
}
```

**Client Error (400)**
```json
{
  "error": "Missing required fields: message",
  "details": "..."
}
```

**Server Error (500)**
```json
{
  "success": false,
  "error": "Failed to process submission",
  "details": "Both email notification and GitHub update failed. Please try again later."
}
```

## How It Works

### Submission Flow

1. Client sends POST request with message and optional files
2. Worker validates the request (honeypot check, required fields)
3. Both operations run in parallel:
   - **Email**: Sends notification to configured email address
   - **GitHub**: Creates/updates files in responses directory
4. Returns appropriate status and message to client

### GitHub Response Structure

Each submission creates files in a numbered directory:

```
responses/
├── meta.json          # Metadata with submission count
├── 1/
│   ├── response.md    # Submission text
│   └── image1.jpg     # Uploaded images
├── 2/
│   ├── response.md
│   ├── image1.jpg
│   └── image2.png
...
```

The `meta.json` automatically tracks:
- Number of submissions
- Associated image files for each submission

## Error Handling

The worker handles various failure scenarios:

| Scenario | Status | Response |
|----------|--------|----------|
| Both services fail | 500 | Error with details |
| Email fails only | 202 | Warning in success response |
| GitHub fails only | 202 | Warning in success response |
| Missing config | 500 | "Configuration missing" error |
| Invalid request | 400 | Validation error |
| Unexpected error | 500 | Error with details |

## Debugging

Check Cloudflare Worker logs:

```bash
npm run tail
```

Or in Cloudflare Dashboard → Workers → your-worker → Logs

## Troubleshooting

**Email not sending:**
- Verify DNS TXT record is correct
- Check `SENDER_EMAIL` is from a domain you control
- Ensure MailChannels is enabled in your Cloudflare plan

**GitHub sync failing:**
- Verify `GITHUB_TOKEN` has `repo` scope
- Ensure `GITHUB_OWNER` and `GITHUB_REPO` are correct
- Check that responses directory exists in repository

**Honeypot triggering:**
- Legitimate submissions with filled honeypot field will return success (202)
- Check client-side implementation

## Security

- Honeypot field prevents basic bot spam
- CORS headers are configured for the expected origin
- All file uploads are limited to 10 files
- Email and GitHub operations use environment variables (never hardcoded)
- No sensitive data is returned in error messages to clients

## License

MIT
