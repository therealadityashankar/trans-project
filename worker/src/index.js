import { sendEmail } from './email.js';
import { updateGithub, getResponses } from './github.js';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    const url = new URL(request.url);

    // GET /responses - List all responses from GitHub
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

    const createdAt = Date.now();
    const safeFiles = Array.isArray(files) ? files.slice(0, 10) : [];

    try {
      // Run both email and GitHub update in parallel
      const results = await Promise.allSettled([
        sendEmail(env, {
          subject: subject || 'New Submission',
          message,
          replyTo,
          files: safeFiles,
        }),
        updateGithub(env, {
          message,
          files: safeFiles,
          lang: lang === 'en' ? 'en' : 'de',
          createdAt,
        }),
      ]);

      const emailResult = results[0];
      const githubResult = results[1];
      const emailSuccess = emailResult.status === 'fulfilled';
      const githubSuccess = githubResult.status === 'fulfilled';

      // Log results for debugging
      if (!emailSuccess) {
        console.error('Email send failed:', emailResult.reason);
      }
      if (!githubSuccess) {
        console.error('GitHub update failed:', githubResult.reason);
      }

      // If both failed, return error
      if (!emailSuccess && !githubSuccess) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to process submission',
            details: 'Both email notification and GitHub update failed. Please try again later.',
          }),
          {
            status: 500,
            headers: corsHeaders(),
          }
        );
      }

      // If only one failed, return partial success with warning
      if (!emailSuccess || !githubSuccess) {
        const failures = [];
        if (!emailSuccess) failures.push('email notification');
        if (!githubSuccess) failures.push('GitHub update');

        ctx.waitUntil(
          Promise.resolve().then(() => {
            console.warn(`Partial failure for submission: ${failures.join(', ')}`);
          })
        );

        return new Response(
          JSON.stringify({
            success: true,
            warning: `Submission received but ${failures.join(' and ')} failed. Your submission may not appear immediately.`,
          }),
          {
            status: 202,
            headers: corsHeaders(),
          }
        );
      }

      // Both succeeded
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders(),
      });
    } catch (error) {
      console.error('Unexpected error processing submission:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unexpected error processing submission',
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
