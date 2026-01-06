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
    // Get current meta.json
    const metaUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/meta.json`;
    const metaResp = await fetch(metaUrl, {
      headers,
    });

    let meta = { count: 0, responses: [] };
    let sha = null;

    if (metaResp.ok) {
      const data = await metaResp.json();
      sha = data.sha;
      meta = JSON.parse(atob(data.content));
    } else if (metaResp.status !== 404) {
      const text = await metaResp.text();
      let errorMsg = text;
      try {
        const error = JSON.parse(text);
        errorMsg = error.message || error.error || text;
      } catch (e) {
        // Response wasn't JSON, use raw text
      }
      throw new Error(`GitHub API error (${metaResp.status}): ${errorMsg}`);
    }

    const nextId = meta.count + 1;
    const imageNames = files
      .filter((f) => (f.type || '').startsWith('image/'))
      .map((f, i) => {
        const ext = f.type.split('/')[1];
        return `image${i + 1}.${ext}`;
      });

    meta.count = nextId;
    meta.responses.push({
      id: nextId,
      images: imageNames,
    });

    // Update meta.json
    const metaUpdateResp = await fetch(metaUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Add response ${nextId}`,
        content: btoa(JSON.stringify(meta, null, 2)),
        sha,
      }),
    });

    if (!metaUpdateResp.ok) {
      const text = await metaUpdateResp.text();
      let errorMsg = text;
      try {
        const error = JSON.parse(text);
        errorMsg = error.message || error.error || text;
      } catch (e) {
        // Response wasn't JSON, use raw text
      }
      throw new Error(`Failed to update meta.json (${metaUpdateResp.status}): ${errorMsg}`);
    }

    // Add response.md file
    const mdContent = `${message}\n\n_Submitted: ${new Date(createdAt).toLocaleString()}_`;
    const mdResp = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/${nextId}/response.md`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Add response ${nextId}`,
          content: btoa(mdContent),
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
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/responses/${nextId}/${fileName}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `Add response ${nextId}`,
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
    }
  } catch (error) {
    throw new Error(`GitHub update failed: ${error.message}`);
  }
}
