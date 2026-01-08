import { renderIndexHtml } from './render.js';

export async function getResponses(env) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  const GITHUB_REPO = env.GITHUB_REPO;
  const GITHUB_OWNER = env.GITHUB_OWNER;

  if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_OWNER) {
    throw new Error('GitHub configuration missing: GITHUB_TOKEN, GITHUB_REPO, or GITHUB_OWNER not set');
  }

  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Cloudflare-Worker',
  };

  try {
    // List all items in responses directory
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
      } catch (e) {}
      throw new Error(`Failed to list responses (${listResp.status}): ${errorMsg}`);
    }

    const items = await listResp.json();
    if (!Array.isArray(items)) {
      throw new Error('Expected array response from GitHub API');
    }

    // Filter for directories and sort by timestamp descending (newest first)
    const responseTimestamps = items
      .filter((item) => item.type === 'dir')
      .map((item) => item.name)
      .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

    // Fetch details for each response
    const responses = [];
    for (const timestamp of responseTimestamps) {
      try {
        const dirUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/${timestamp}`;
        const dirResp = await fetch(dirUrl, { headers });

        if (!dirResp.ok) continue;

        const dirItems = await dirResp.json();
        if (!Array.isArray(dirItems)) continue;

        // Get response.md content
        const mdFile = dirItems.find((item) => item.name === 'response.md');
        let message = '';
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

        // Get image files
        const images = dirItems
          .filter((item) => item.type === 'file' && /^image\d+\.(jpg|jpeg|png|gif|webp)$/i.test(item.name))
          .map((item) => ({
            name: item.name,
            path: `responses/${timestamp}/${item.name}`,
            downloadUrl: item.download_url,
          }))
          .sort((a, b) => {
            // Sort images by number
            const numA = parseInt(a.name.match(/\d+/)[0], 10);
            const numB = parseInt(b.name.match(/\d+/)[0], 10);
            return numA - numB;
          });

        responses.push({
          id: timestamp,
          message: message.trim(),
          images: images.map((img) => img.downloadUrl),
          createdAt: new Date(parseInt(timestamp, 10) * 1000).toISOString(),
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

export async function updateGithub(env, { message, files, lang, createdAt }) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  const GITHUB_REPO = env.GITHUB_REPO;
  const GITHUB_OWNER = env.GITHUB_OWNER;

  if (!GITHUB_TOKEN || !GITHUB_REPO || !GITHUB_OWNER) {
    throw new Error('GitHub configuration missing: GITHUB_TOKEN, GITHUB_REPO, or GITHUB_OWNER not set');
  }

  const headers = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Cloudflare-Worker',
  };

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const imageUrls = [];

    // Add response.md file
    const mdContent = message;
    const encoder = new TextEncoder();
    const mdContentBase64 = btoa(String.fromCharCode(...encoder.encode(mdContent)));
    const mdResp = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/${timestamp}/response.md`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Add response ${timestamp}`,
          content: mdContentBase64,
        }),
      }
    );

    if (!mdResp.ok) {
      const text = await mdResp.text();
      let errorMsg = text;
      try {
        const error = JSON.parse(text);
        errorMsg = error.message || error.error || text;
      } catch (e) {
        // Response wasn't JSON, use raw text
      }
      throw new Error(`Failed to create response.md (${mdResp.status}): ${errorMsg}`);
    }

    // Add image files
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!(file.type || '').startsWith('image/')) continue;

      const ext = file.type.split('/')[1];
      const fileName = `image${i + 1}.${ext}`;

      const imgResp = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/${timestamp}/${fileName}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `Add response ${timestamp}`,
            content: file.data,
          }),
        }
      );

      if (!imgResp.ok) {
        const text = await imgResp.text();
        let errorMsg = text;
        try {
          const error = JSON.parse(text);
          errorMsg = error.message || error.error || text;
        } catch (e) {
          // Response wasn't JSON, use raw text
        }
        throw new Error(`Failed to upload image ${fileName} (${imgResp.status}): ${errorMsg}`);
      }

      imageUrls.push(`https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/responses/${timestamp}/${fileName}`);
    }

    // Rebuild index.html with all responses
    await rebuildIndexHtml(env, headers);

    return { timestamp, imageUrls };
  } catch (error) {
    throw new Error(`GitHub update failed: ${error.message}`);
  }
}

async function rebuildIndexHtml(env, headers) {
  const GITHUB_OWNER = env.GITHUB_OWNER;
  const GITHUB_REPO = env.GITHUB_REPO;

  // Fetch pre-index.html template
  const templateUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/pre-index.html`;
  const templateResp = await fetch(templateUrl, { headers });
  if (!templateResp.ok) {
    throw new Error(`Failed to fetch pre-index.html: ${templateResp.status}`);
  }
  const templateData = await templateResp.json();
  const template = atob(templateData.content);

  // Fetch all responses
  const { items } = await getResponses(env);

  // Convert download URLs to jsdelivr URLs for pre-rendered content
  const itemsWithJsdelivr = items.map(item => ({
    ...item,
    images: item.images.map(url => {
      // Convert raw.githubusercontent.com URL to jsdelivr
      const match = url.match(/responses\/(\d+)\/(image\d+\.\w+)/);
      if (match) {
        return `https://cdn.jsdelivr.net/gh/${GITHUB_OWNER}/${GITHUB_REPO}@main/responses/${match[1]}/${match[2]}`;
      }
      return url;
    }),
  }));

  // Render the new index.html
  const newIndexHtml = renderIndexHtml(template, itemsWithJsdelivr);

  // Get current index.html sha (if it exists)
  const indexUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/index.html`;
  const indexResp = await fetch(indexUrl, { headers });
  let indexSha = null;
  if (indexResp.ok) {
    const indexData = await indexResp.json();
    indexSha = indexData.sha;
  }

  // Commit the new index.html
  const encoder = new TextEncoder();
  const indexBase64 = btoa(String.fromCharCode(...encoder.encode(newIndexHtml)));
  const commitResp = await fetch(indexUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: 'Rebuild index.html with latest responses',
      content: indexBase64,
      sha: indexSha,
    }),
  });

  if (!commitResp.ok) {
    const text = await commitResp.text();
    throw new Error(`Failed to commit index.html: ${commitResp.status} - ${text}`);
  }
}
