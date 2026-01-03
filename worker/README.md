# Email Forwarder Worker

A Cloudflare Worker that forwards emails via POST request using MailChannels.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure `wrangler.toml`:
   - `SENDER_EMAIL`: The email address emails will be sent from (must be from a domain you control)
   - `DESTINATION_EMAIL`: Where forwarded emails will be sent

3. **Important**: Set up DNS records for MailChannels to work with your domain. Add this TXT record:
   ```
   _mailchannels.yourdomain.com  TXT  "v=mc1 cfid=your-worker-subdomain.workers.dev"
   ```

## Development

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

## API Usage

**POST** `/`

```json
{
  "from": "sender@example.com",
  "subject": "Contact Form Submission",
  "message": "Hello, this is a test message.",
  "replyTo": "optional-reply-to@example.com"
}
```

### Response

Success:
```json
{ "success": true }
```

Error:
```json
{ "error": "Error message", "details": "..." }
```
