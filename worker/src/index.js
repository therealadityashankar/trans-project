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

    const body = await request.json();
    const { from, subject, message, replyTo, honeypot } = body;

    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders(),
      });
    }

    if (!from || !subject || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: from, subject, message' }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const emailMessage = createMimeMessage({
      from: env.SENDER_EMAIL,
      to: env.DESTINATION_EMAIL,
      replyTo: replyTo || from,
      subject,
      text: `From: ${from}\n\n${message}`,
    });

    await env.EMAIL.send(emailMessage);


    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders(),
    });
  },
};

function createMimeMessage({ from, to, replyTo, subject, text }) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    text,
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
