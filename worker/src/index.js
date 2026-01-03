import { EmailMessage } from 'cloudflare:email';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders(),
      });
    }

    const body = await request
      .json()
      .catch(() =>
        new Response(
          JSON.stringify({ error: 'Request body must be valid JSON' }),
          { status: 400, headers: corsHeaders() }
        )
      );

    if (!body) {
      return new Response(
        JSON.stringify({ error: 'Request body must be valid JSON' }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const { subject, message, replyTo, honeypot, files } = body;

    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders(),
      });
    }

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: from, subject, message' }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const emailMessage = createMimeMessage({
      from: env.SENDER_EMAIL,
      to: env.DESTINATION_EMAIL,
      replyTo: replyTo || env.SENDER_EMAIL,
      subject,
      text: `Submission:\n\n${message}`,
      files: files || [],
    });

    await env.EMAIL.send(emailMessage);


    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders(),
    });
  },
};

function createMimeMessage({ from, to, replyTo, subject, text, files }) {
  const messageId = `<${Date.now()}.${crypto.randomUUID()}@${from.split('@')[1]}>`;
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join('\r\n');

  const textPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`,
    '',
    text,
  ].join('\r\n');

  const attachmentParts = files.map((file) => [
    `--${boundary}`,
    `Content-Type: ${file.type || 'application/octet-stream'}; name="${file.name}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${file.name}"`,
    '',
    file.data,
  ].join('\r\n')).join('\r\n');

  const message = [
    headers,
    '',
    textPart,
    attachmentParts,
    `--${boundary}--`,
  ].join('\r\n');

  return new EmailMessage(from, to, message);
}

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function handleCORS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
