let _config = null;

async function loadConfig() {
  if (_config) return _config;
  let api = {}, file = {};
  try { const r = await fetch('/api/config'); if (r.ok) api = await r.json(); } catch(e) {}
  try { const r = await fetch('config/git_config.json'); if (r.ok) file = await r.json(); } catch(e) {}
  const apiTok = String(api.github_token || '').trim();
  const fileTok = String(file.github_token || '').trim();
  _config = {
    github_token: (apiTok && apiTok !== 'YOUR_GITHUB_TOKEN') ? apiTok : fileTok,
    github_owner: file.github_owner || '',
    github_repo: file.github_repo || '',
    data_file_path: file.data_file_path || 'data/posts.json',
    admin_password: api.admin_password || file.admin_password || 'admin1234'
  };
  return _config;
}

function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true';
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'admin.html';
  }
}

function handleAgentLogin(e) {
  if (e) e.preventDefault();
  window.location.href = 'admin.html';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToText(md) {
  if (!md) return '';
  let text = String(md);
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^#+\s+/gm, '');
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/~~([^~]+)~~/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/^>\s+/gm, '');
  text = text.replace(/^[-*+]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');
  text = text.replace(/---/g, '');
  return text.trim();
}

function renderMarkdown(src) {
  if (!src) return '';
  const escaped = escapeHtml(src);
  const lines = escaped.split(/\r?\n/);
  let html = '';
  let inList = false;
  let listType = null;
  let inCodeBlock = false;
  let codeBlockBuffer = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre class="bg-surface-container p-4 rounded-lg my-4 overflow-x-auto text-body-sm font-mono"><code>${codeBlockBuffer.join('\n')}</code></pre>`;
        codeBlockBuffer = [];
        inCodeBlock = false;
      } else {
        if (inList) { html += listType === 'ol' ? '</ol>' : '</ul>'; inList = false; }
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockBuffer.push(line);
      continue;
    }

    if (line.trim() === '') {
      if (inList) { html += listType === 'ol' ? '</ol>' : '</ul>'; inList = false; }
      continue;
    }

    if (line.startsWith('---')) {
      if (inList) { html += listType === 'ol' ? '</ol>' : '</ul>'; inList = false; }
      html += `<hr class="my-6 border-outline-variant/40" />`;
      continue;
    }

    const h3Match = line.match(/^###\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h1Match = line.match(/^#\s+(.+)$/);

    if (h3Match || h2Match || h1Match) {
      if (inList) { html += listType === 'ol' ? '</ol>' : '</ul>'; inList = false; }
      let content = parseInline(h3Match ? h3Match[1] : h2Match ? h2Match[1] : h1Match[1]);
      if (h1Match) html += `<h1 class="text-headline-xl font-bold my-4 text-on-surface">${content}</h1>`;
      else if (h2Match) html += `<h2 class="text-headline-lg font-bold my-3 text-on-surface">${content}</h2>`;
      else html += `<h3 class="text-headline-md font-bold my-2 text-on-surface">${content}</h3>`;
      continue;
    }

    const quoteMatch = line.match(/^&gt;\s+(.+)$/);
    if (quoteMatch) {
      if (inList) { html += listType === 'ol' ? '</ol>' : '</ul>'; inList = false; }
      html += `<blockquote class="border-l-4 border-primary pl-4 py-2 my-4 bg-weak-background/50 rounded-r text-secondary font-medium">${parseInline(quoteMatch[1])}</blockquote>`;
      continue;
    }

    const ulMatch = line.match(/^[-*+]\s+(.+)$/);
    const olMatch = line.match(/^\d+\.\s+(.+)$/);

    if (ulMatch || olMatch) {
      const type = olMatch ? 'ol' : 'ul';
      const itemContent = parseInline(olMatch ? olMatch[1] : ulMatch[1]);
      if (!inList || listType !== type) {
        if (inList) html += listType === 'ol' ? '</ol>' : '</ul>';
        html += type === 'ol' ? `<ol class="list-decimal list-inside my-3 space-y-1 text-secondary">` : `<ul class="list-disc list-inside my-3 space-y-1 text-secondary">`;
        inList = true;
        listType = type;
      }
      html += `<li>${itemContent}</li>`;
      continue;
    }

    if (inList) { html += listType === 'ol' ? '</ol>' : '</ul>'; inList = false; }
    html += `<p class="my-3 text-body-md text-secondary leading-relaxed">${parseInline(line)}</p>`;
  }

  if (inList) { html += listType === 'ol' ? '</ol>' : '</ul>'; }
  if (inCodeBlock) {
    html += `<pre class="bg-surface-container p-4 rounded-lg my-4 overflow-x-auto text-body-sm font-mono"><code>${codeBlockBuffer.join('\n')}</code></pre>`;
  }

  return html;
}

function parseInline(text) {
  if (!text) return '';
  const parts = text.split(/`([^`]+)`/g);
  let result = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      result += `<code class="bg-surface-variant px-1.5 py-0.5 rounded text-label-sm font-mono text-primary">${parts[i]}</code>`;
    } else {
      let sub = parts[i];
      sub = sub.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-on-surface">$1</strong>');
      sub = sub.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
      sub = sub.replace(/~~([^~]+)~~/g, '<del class="line-through">$1</del>');
      sub = sub.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:opacity-80">$1</a>');
      result += sub;
    }
  }
  return result;
}

async function getPosts() {
  try {
    const res = await fetch('data/posts.json?t=' + Date.now());
    if (res.ok) {
      const posts = await res.json();
      localStorage.setItem('local_posts', JSON.stringify(posts));
      return posts;
    }
  } catch (e) {}
  const cached = localStorage.getItem('local_posts');
  return cached ? JSON.parse(cached) : [];
}

async function getPostById(id) {
  const posts = await getPosts();
  return posts.find(p => String(p.id) === String(id)) || null;
}

function utf8ToBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode('0x' + p1)));
}

async function savePost(postData) {
  const posts = await getPosts();
  let updatedPost = null;
  const numId = Number(postData.id);

  if (postData.id && posts.some(p => Number(p.id) === numId)) {
    const idx = posts.findIndex(p => Number(p.id) === numId);
    posts[idx] = { ...posts[idx], ...postData, id: numId };
    updatedPost = posts[idx];
  } else {
    const newId = Date.now();
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '.');
    updatedPost = {
      id: newId,
      category: postData.category || '보도자료',
      title: postData.title || '제목 없음',
      date: postData.date || today,
      content: postData.content || '',
      thumbnail: postData.thumbnail || ''
    };
    posts.unshift(updatedPost);
  }

  localStorage.setItem('local_posts', JSON.stringify(posts));
  await syncToGithub(posts);
  return updatedPost;
}

async function deletePost(id) {
  let posts = await getPosts();
  posts = posts.filter(p => String(p.id) !== String(id));
  localStorage.setItem('local_posts', JSON.stringify(posts));
  await syncToGithub(posts);
  return true;
}

async function syncToGithub(posts) {
  const config = await loadConfig();
  const token = String(config.github_token || '').replace(/\s+/g, '').trim();
  const owner = config.github_owner;
  const repo = config.github_repo;
  const path = config.data_file_path || 'data/posts.json';

  if (!token || token === 'YOUR_GITHUB_TOKEN' || !owner || !repo) {
    return;
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  let sha = null;

  try {
    const getRes = await fetch(url, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    }
  } catch (e) {}

  const jsonStr = JSON.stringify(posts, null, 2);
  const contentBase64 = utf8ToBase64(jsonStr);

  const body = {
    message: 'feat: update board posts via web admin',
    content: contentBase64
  };
  if (sha) body.sha = sha;

  try {
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });
    if (!putRes.ok) {
      const errText = await putRes.text();
      console.warn('GitHub Sync status:', putRes.status, errText);
    }
  } catch (e) {
    console.error('GitHub Sync network error:', e);
  }
}
