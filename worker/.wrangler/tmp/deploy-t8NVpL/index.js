var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/email.js
import { EmailMessage } from "cloudflare:email";
function createMimeMessage({ from, to, replyTo, subject, text }) {
  const messageId = `<${Date.now()}.${crypto.randomUUID()}@${from.split("@")[1]}>`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${(/* @__PURE__ */ new Date()).toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: 7bit`
  ].join("\r\n");
  const message = [headers, "", text].join("\r\n");
  return new EmailMessage(from, to, message);
}
__name(createMimeMessage, "createMimeMessage");
async function sendEmail(env, { subject, message, replyTo, imageUrls }) {
  if (!env.SENDER_EMAIL || !env.DESTINATION_EMAIL) {
    throw new Error("Email configuration missing: SENDER_EMAIL or DESTINATION_EMAIL not set");
  }
  if (!env.EMAIL) {
    throw new Error("Email binding not configured");
  }
  try {
    let text = `Submission:

${message}`;
    if (imageUrls && imageUrls.length > 0) {
      text += "\n\nImages:\n" + imageUrls.join("\n");
    }
    const emailMessage = createMimeMessage({
      from: env.SENDER_EMAIL,
      to: env.DESTINATION_EMAIL,
      replyTo: replyTo || env.SENDER_EMAIL,
      subject: subject || "New Submission",
      text
    });
    await env.EMAIL.send(emailMessage);
  } catch (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }
}
__name(sendEmail, "sendEmail");

// src/github.js
async function getResponses(env) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  const GITHUB_REPO = env.GITHUB_REPO;
  const GITHUB_OWNER = env.GITHUB_OWNER;
  if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_OWNER) {
    throw new Error("GitHub configuration missing: GITHUB_TOKEN, GITHUB_REPO, or GITHUB_OWNER not set");
  }
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Cloudflare-Worker"
  };
  try {
    const listUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses`;
    const listResp = await fetch(listUrl, { headers });
    if (!listResp.ok) {
      if (listResp.status === 404) {
        return { items: [] };
      }
      const text = await listResp.text();
      let errorMsg = text;
      try {
        const error = JSON.parse(text);
        errorMsg = error.message || error.error || text;
      } catch (e) {
      }
      throw new Error(`Failed to list responses (${listResp.status}): ${errorMsg}`);
    }
    const items = await listResp.json();
    if (!Array.isArray(items)) {
      throw new Error("Expected array response from GitHub API");
    }
    const responseTimestamps = items.filter((item) => item.type === "dir").map((item) => item.name).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    const responses = [];
    for (const timestamp of responseTimestamps) {
      try {
        const dirUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/${timestamp}`;
        const dirResp = await fetch(dirUrl, { headers });
        if (!dirResp.ok)
          continue;
        const dirItems = await dirResp.json();
        if (!Array.isArray(dirItems))
          continue;
        const mdFile = dirItems.find((item) => item.name === "response.md");
        let message = "";
        if (mdFile && mdFile.download_url) {
          try {
            const mdResp = await fetch(mdFile.download_url);
            if (mdResp.ok) {
              message = await mdResp.text();
            }
          } catch (e) {
            console.error(`Failed to fetch response.md for ${timestamp}:`, e);
          }
        }
        const images = dirItems.filter((item) => item.type === "file" && /^image\d+\.(jpg|jpeg|png|gif|webp)$/i.test(item.name)).map((item) => ({
          name: item.name,
          path: `responses/${timestamp}/${item.name}`,
          downloadUrl: item.download_url
        })).sort((a, b) => {
          const numA = parseInt(a.name.match(/\d+/)[0], 10);
          const numB = parseInt(b.name.match(/\d+/)[0], 10);
          return numA - numB;
        });
        responses.push({
          id: timestamp,
          message: message.trim(),
          images: images.map((img) => img.downloadUrl),
          createdAt: new Date(parseInt(timestamp, 10) * 1e3).toISOString()
        });
      } catch (e) {
        console.error(`Failed to fetch response ${timestamp}:`, e);
        continue;
      }
    }
    return { items: responses };
  } catch (error) {
    throw new Error(`Failed to list responses: ${error.message}`);
  }
}
__name(getResponses, "getResponses");
async function updateGithub(env, { message, files, lang, createdAt }) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  const GITHUB_REPO = env.GITHUB_REPO;
  const GITHUB_OWNER = env.GITHUB_OWNER;
  if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_OWNER) {
    throw new Error("GitHub configuration missing: GITHUB_TOKEN, GITHUB_REPO, or GITHUB_OWNER not set");
  }
  const headers = {
    "Authorization": `token ${GITHUB_TOKEN}`,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "Cloudflare-Worker"
  };
  try {
    const timestamp = Math.floor(Date.now() / 1e3).toString();
    const imageUrls = [];
    const mdContent = message;
    const encoder = new TextEncoder();
    const mdContentBase64 = btoa(String.fromCharCode(...encoder.encode(mdContent)));
    const mdResp = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/${timestamp}/response.md`,
      {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Add response ${timestamp}`,
          content: mdContentBase64
        })
      }
    );
    if (!mdResp.ok) {
      const text = await mdResp.text();
      let errorMsg = text;
      try {
        const error = JSON.parse(text);
        errorMsg = error.message || error.error || text;
      } catch (e) {
      }
      throw new Error(`Failed to create response.md (${mdResp.status}): ${errorMsg}`);
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!(file.type || "").startsWith("image/"))
        continue;
      const ext = file.type.split("/")[1];
      const fileName = `image${i + 1}.${ext}`;
      const imgResp = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/${timestamp}/${fileName}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            message: `Add response ${timestamp}`,
            content: file.data
          })
        }
      );
      if (!imgResp.ok) {
        const text = await imgResp.text();
        let errorMsg = text;
        try {
          const error = JSON.parse(text);
          errorMsg = error.message || error.error || text;
        } catch (e) {
        }
        throw new Error(`Failed to upload image ${fileName} (${imgResp.status}): ${errorMsg}`);
      }
      imageUrls.push(`https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/responses/${timestamp}/${fileName}`);
    }
    return { timestamp, imageUrls };
  } catch (error) {
    throw new Error(`GitHub update failed: ${error.message}`);
  }
}
__name(updateGithub, "updateGithub");

// src/index.js
var src_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleCORS();
    }
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/responses") {
      try {
        const data = await getResponses(env);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: corsHeaders()
        });
      } catch (error) {
        console.error("Error fetching responses:", error);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Failed to fetch responses",
            details: error.message
          }),
          {
            status: 500,
            headers: corsHeaders()
          }
        );
      }
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: corsHeaders()
      });
    }
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), {
        status: 400,
        headers: corsHeaders()
      });
    }
    const raw = await request.text();
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response(JSON.stringify({ error: "Request body must be valid JSON" }), {
        status: 400,
        headers: corsHeaders()
      });
    }
    const { subject, message, replyTo, honeypot, files, lang } = body;
    if (honeypot) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders()
      });
    }
    if (!message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message" }),
        { status: 400, headers: corsHeaders() }
      );
    }
    const safeFiles = Array.isArray(files) ? files.slice(0, 10) : [];
    try {
      const { imageUrls } = await updateGithub(env, {
        message,
        files: safeFiles,
        lang: lang === "en" ? "en" : "de"
      });
      try {
        await sendEmail(env, {
          subject: subject || "New Submission",
          message,
          replyTo,
          imageUrls
        });
      } catch (emailError) {
        console.error("Email send failed:", emailError);
        return new Response(
          JSON.stringify({
            success: true,
            warning: "Submission saved but email notification failed."
          }),
          {
            status: 202,
            headers: corsHeaders()
          }
        );
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: corsHeaders()
      });
    } catch (error) {
      console.error("GitHub update failed:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to save submission",
          details: error.message
        }),
        {
          status: 500,
          headers: corsHeaders()
        }
      );
    }
  }
};
function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(corsHeaders, "corsHeaders");
function handleCORS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}
__name(handleCORS, "handleCORS");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
