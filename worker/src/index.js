import { sendEmail } from './email.js';
import { updateGithub, getResponses } from './github.js';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);

    // GET /responses - List The Stories from GitHub
    if (request.method === 'GET' && url.pathname === '/responses') {
      try {
        const data = await getResponses(env);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: corsHeaders(),
        });
      } catch (error) {
        console.error('Error fetching responses:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to fetch responses',
            details: error.message,
          }),
          {
            status: 500,
            headers: corsHeaders(),
          }
        );
      }
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
        JSON.stringify({ error: 'Missing required fields: message' }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const safeFiles = Array.isArray(files) ? files.slice(0, 10) : [];

    try {
      // First, commit to GitHub
      const { imageUrls } = await updateGithub(env, {
        message,
        files: safeFiles,
        lang: lang === 'en' ? 'en' : 'de',
      });

      // Then send email with jsdelivr URLs
      try {
        await sendEmail(env, {
          subject: subject || 'New Submission',
          message,
          replyTo,
          imageUrls,
        });
      } catch (emailError) {
        console.error('Email send failed:', emailError);
        return new Response(
          JSON.stringify({
            success: true,
            warning: 'Submission saved but email notification failed.',
          }),
          {
            status: 202,
            headers: corsHeaders(),
          }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error('GitHub update failed:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to save submission',
          details: error.message,
        }),
        {
          status: 500,
          headers: corsHeaders(),
        }
      );
    }
  },
};

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
