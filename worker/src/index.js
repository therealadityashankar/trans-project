import { EmailMessage } from 'cloudflare:email';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/responses') {
      const stub = env.RESPONSES.get(env.RESPONSES.idFromName('default'));
      const res = await stub.fetch('https://responses/list', { method: 'GET' });
      const body = await res.text();
      return new Response(body, { status: res.status, headers: corsHeaders() });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders(),
      });
    }

    if (!request.headers.get('content-type')?.includes('application/json')) {
      return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const raw = await request.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: 'Request body must be valid JSON' }), {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const { subject, message, replyTo, honeypot, files, lang } = body;

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

    const createdAt = Date.now();
    const safeFiles = Array.isArray(files) ? files.slice(0, 10) : [];

    const stub = env.RESPONSES.get(env.RESPONSES.idFromName('default'));
    ctx.waitUntil(
      stub.fetch('https://responses/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createdAt,
          message,
          files: safeFiles,
          lang: lang === 'en' ? 'en' : 'de',
        }),
      })
    );

    const emailMessage = createMimeMessage({
      from: env.SENDER_EMAIL,
      to: env.DESTINATION_EMAIL,
      replyTo: replyTo || env.SENDER_EMAIL,
      subject,
      text: `Submission:\n\n${message}`,
      files: safeFiles,
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

export class ResponsesStore {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/list') {
      const items = (await this.state.storage.get('items')) || [];
      return new Response(JSON.stringify({ items }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'POST' && url.pathname === '/add') {
      const raw = await request.text();
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const items = (await this.state.storage.get('items')) || [];
      items.unshift(body);
      await this.state.storage.put('items', items.slice(0, 100));
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  }
}
