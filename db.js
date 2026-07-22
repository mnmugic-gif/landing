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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToText(src) {
  if (!src) return '';
  let text = src;
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/#+\s+/g, '');
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/^\s*>\s+/gm, '');
  return text.trim();
}

function renderMarkdown(src) {
  if (!src) return '';
  const escaped = escapeHtml(src);
  let html = escaped;

  html = html.replace(/```([\s\S]*?)```/g, function(match, code) {
    return '<pre class="bg-surface-variant/50 p-4 rounded-lg my-4 overflow-x-auto text-body-sm font-mono"><code>' + code.trim() + '</code></pre>';
  });

  const parts = html.split(/(`[^`]+`)/g);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('`') && parts[i].endsWith('`') && parts[i].length >= 2) {
      const codeContent = parts[i].slice(1, -1);
      parts[i] = '<code class="bg-surface-variant/60 px-1.5 py-0.5 rounded text-body-sm font-mono text-primary">' + codeContent + '</code>';
    }
  }
  html = parts.join('');

  html = html.replace(/^### (.*$)/gim, '<h3 class="text-headline-md font-headline-md font-bold mt-6 mb-3 text-on-surface">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-headline-lg font-headline-lg font-bold mt-8 mb-4 text-on-surface">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-headline-xl font-headline-xl font-bold mt-8 mb-4 text-on-surface">$1</h1>');

  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-on-surface">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
  html = html.replace(/~~(.*?)~~/g, '<del class="line-through text-muted">$1</del>');

  html = html.replace(/^\s*>\s*(.*$)/gim, '<blockquote class="border-l-4 border-primary pl-4 py-2 my-4 bg-weak-background/30 rounded-r-lg text-secondary italic">$1</blockquote>');
  html = html.replace(/^---$/gim, '<hr class="my-6 border-outline-variant/40"/>');

  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, function(match, text, url) {
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="text-primary underline hover:opacity-80">' + text + '</a>';
  });

  const lines = html.split(/\r?\n/);
  let result = [];
  let inList = false;
  let listType = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const isUnordered = /^\s*[-*+]\s+(.*)/.test(line);
    const isOrdered = /^\s*\d+\.\s+(.*)/.test(line);

    if (isUnordered || isOrdered) {
      const currentType = isUnordered ? 'ul' : 'ol';
      const content = line.replace(/^\s*([-*+]|\d+\.)\s+/, '');
      if (!inList) {
        inList = true;
        listType = currentType;
        result.push(currentType === 'ul' ? '<ul class="list-disc list-inside space-y-1.5 my-3 text-secondary">' : '<ol class="list-decimal list-inside space-y-1.5 my-3 text-secondary">');
      }
      result.push('  <li>' + content + '</li>');
    } else {
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      if (line.trim() !== '' && !line.startsWith('<h') && !line.startsWith('<pre') && !line.startsWith('<blockquote') && !line.startsWith('<hr')) {
        result.push('<p class="my-3 text-body-md text-secondary leading-relaxed">' + line + '</p>');
      } else {
        result.push(line);
      }
    }
  }
  if (inList) {
    result.push(listType === 'ul' ? '</ul>' : '</ol>');
  }

  return result.join('\n');
}

function utf8ToBase64(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
    return String.fromCharCode('0x' + p1);
  }));
}

function base64ToUtf8(str) {
  return decodeURIComponent(Array.from(atob(str.replace(/\s+/g, ''))).map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
}

async function getPosts() {
  const local = localStorage.getItem('realty_board_posts');
  if (local) {
    try { return JSON.parse(local); } catch(e) {}
  }
  try {
    const res = await fetch('data/posts.json');
    if (res.ok) {
      const posts = await res.json();
      localStorage.setItem('realty_board_posts', JSON.stringify(posts));
      return posts;
    }
  } catch(e) {}
  return [];
}

async function syncToGitHub(posts) {
  const cfg = await loadConfig();
  const rawToken = String(cfg.github_token || '').replace(/\s+/g, '');
  if (!rawToken || rawToken === 'YOUR_GITHUB_TOKEN' || !cfg.github_owner || !cfg.github_repo) {
    return { success: false, error: 'GitHub 토큰 또는 저장소 정보가 설정되지 않았습니다.' };
  }

  const url = `https://api.github.com/repos/${cfg.github_owner}/${cfg.github_repo}/contents/${cfg.data_file_path}`;
  const headers = {
    'Authorization': `token ${rawToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  let sha = null;
  try {
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }
  } catch(e) {}

  const contentStr = JSON.stringify(posts, null, 2);
  const base64Content = utf8ToBase64(contentStr);

  const payload = {
    message: 'feat: update posts data via admin board',
    content: base64Content
  };
  if (sha) payload.sha = sha;

  try {
    const putRes = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });
    if (putRes.ok) {
      return { success: true };
    } else {
      const errJson = await putRes.json().catch(() => ({}));
      return { success: false, error: errJson.message || `GitHub API 오류 (${putRes.status})` };
    }
  } catch(e) {
    return { success: false, error: e.message || '네트워크 오류가 발생했습니다.' };
  }
}

async function savePost(postData) {
  const posts = await getPosts();
  let updatedPosts;
  if (postData.id) {
    updatedPosts = posts.map(p => p.id === postData.id ? { ...p, ...postData } : p);
  } else {
    const newPost = {
      ...postData,
      id: 'post-' + Date.now(),
      date: postData.date || new Date().toISOString().split('T')[0]
    };
    updatedPosts = [newPost, ...posts];
  }

  localStorage.setItem('realty_board_posts', JSON.stringify(updatedPosts));
  const syncResult = await syncToGitHub(updatedPosts);
  return { posts: updatedPosts, syncResult };
}

async function deletePost(postId) {
  const posts = await getPosts();
  const updatedPosts = posts.filter(p => p.id !== postId);
  localStorage.setItem('realty_board_posts', JSON.stringify(updatedPosts));
  const syncResult = await syncToGitHub(updatedPosts);
  return { posts: updatedPosts, syncResult };
}
