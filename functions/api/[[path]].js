const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function pathParts(params) {
  const p = params?.path;
  if (Array.isArray(p)) return p;
  if (!p) return [];
  return String(p).split('/').filter(Boolean);
}

function parseCookies(request) {
  const raw = request.headers.get('cookie') || '';
  const out = {};
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function bytesToHex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function randomHex(n = 32) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return bytesToHex(b);
}

async function passwordHash(password, saltHex) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations: 120000 }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}

async function ensureSchema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS site_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    salt TEXT NOT NULL,
    pass_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`).run();
}

async function getSession(request, env) {
  const token = parseCookies(request).fx_session;
  if (!token) return null;
  const now = Date.now();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  return await env.DB.prepare(`SELECT s.token, s.user_id, u.username
    FROM sessions s JOIN admin_users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at >= ?`).bind(token, now).first();
}

function sessionCookie(token, maxAge = 604800) {
  return `fx_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

function clearSessionCookie() {
  return 'fx_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

async function handleAuth(parts, request, env) {
  const action = parts[1] || 'status';
  const method = request.method.toUpperCase();
  const countRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_users').first();
  const configured = Number(countRow?.n || 0) > 0;
  const session = await getSession(request, env);

  if (action === 'status' && method === 'GET') {
    return json({ ok: true, configured, authenticated: !!session, username: session?.username || null });
  }

  if (action === 'register' && method === 'POST') {
    const body = await readJson(request);
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');
    if (username.length < 3 || password.length < 6) return json({ ok: false, error: 'Use login com 3+ caracteres e senha com 6+ caracteres.' }, 400);
    if (configured && !session) return json({ ok: false, error: 'O acesso já foi configurado. Faça login para alterá-lo.' }, 403);
    const salt = randomHex(16);
    const passHash = await passwordHash(password, salt);
    let userId;
    if (!configured) {
      const insertResult = await env.DB.prepare('INSERT INTO admin_users (username, salt, pass_hash, created_at) VALUES (?, ?, ?, ?)')
        .bind(username, salt, passHash, new Date().toISOString()).run();
      userId = Number(insertResult?.meta?.last_row_id || 0);
      if (!userId) {
        const urow = await env.DB.prepare('SELECT id FROM admin_users WHERE username = ?').bind(username).first();
        userId = Number(urow?.id || 0);
      }
      if (!userId) return json({ ok: false, error: 'Não foi possível criar o usuário administrativo.', detail: 'Usuário inserido sem ID retornado pelo D1.' }, 500);
    } else {
      userId = session.user_id;
      await env.DB.prepare('UPDATE admin_users SET username = ?, salt = ?, pass_hash = ? WHERE id = ?')
        .bind(username, salt, passHash, userId).run();
      await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
    }
    const token = randomHex(32);
    await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(token, userId, Date.now() + 7 * 86400000).run();
    return json({ ok: true, username }, 200, { 'set-cookie': sessionCookie(token) });
  }

  if (action === 'login' && method === 'POST') {
    const body = await readJson(request);
    const username = String(body?.username || '').trim();
    const password = String(body?.password || '');
    const user = await env.DB.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username).first();
    if (!user) return json({ ok: false, error: 'Login ou senha incorretos.' }, 401);
    const h = await passwordHash(password, user.salt);
    if (h !== user.pass_hash) return json({ ok: false, error: 'Login ou senha incorretos.' }, 401);
    const token = randomHex(32);
    await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(token, user.id, Date.now() + 7 * 86400000).run();
    return json({ ok: true, username: user.username }, 200, { 'set-cookie': sessionCookie(token) });
  }

  if (action === 'logout' && method === 'POST') {
    const token = parseCookies(request).fx_session;
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() });
  }

  return json({ ok: false, error: 'Rota de autenticação inválida.' }, 404);
}

async function handleState(request, env) {
  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT data, updated_at FROM site_state WHERE id = 1').first();
    if (!row) return json({ ok: true, state: null, updatedAt: null });
    try { return json({ ok: true, state: JSON.parse(row.data), updatedAt: row.updated_at }); }
    catch { return json({ ok: false, error: 'Estado salvo inválido.' }, 500); }
  }
  if (request.method === 'PUT') {
    if (!await getSession(request, env)) return json({ ok: false, error: 'Não autorizado.' }, 401);
    const body = await readJson(request);
    const state = body?.state;
    if (!state || typeof state !== 'object') return json({ ok: false, error: 'Estado inválido.' }, 400);
    const raw = JSON.stringify(state);
    if (raw.length > 900000) return json({ ok: false, error: 'Os dados do painel ficaram grandes demais. Mídias devem ir para o R2.' }, 413);
    const now = new Date().toISOString();
    await env.DB.prepare(`INSERT INTO site_state (id, data, updated_at) VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).bind(raw, now).run();
    return json({ ok: true, updatedAt: now });
  }
  return json({ ok: false, error: 'Método não permitido.' }, 405);
}

async function handleLead(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);
  const body = await readJson(request);
  if (!body) return json({ ok: false, error: 'Dados inválidos.' }, 400);
  const row = await env.DB.prepare('SELECT data FROM site_state WHERE id = 1').first();
  let state = row?.data ? JSON.parse(row.data) : { projects: [], videos: [], images: [], restorations: [], reviews: [], leads: [], ideas: [], campaigns: [], settings: {} };
  if (!Array.isArray(state.leads)) state.leads = [];
  state.leads.unshift({
    id: crypto.randomUUID(),
    name: String(body.name || '').slice(0, 120),
    whatsapp: String(body.whatsapp || '').slice(0, 80),
    email: String(body.email || '').slice(0, 160),
    service: String(body.service || '').slice(0, 100),
    idea: String(body.idea || '').slice(0, 2000),
    status: 'Novo'
  });
  const now = new Date().toISOString();
  await env.DB.prepare(`INSERT INTO site_state (id, data, updated_at) VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`).bind(JSON.stringify(state), now).run();
  return json({ ok: true });
}

function safeFileName(name = 'arquivo') {
  return String(name).normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(-100) || 'arquivo';
}

async function handleUpload(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Método não permitido.' }, 405);
  if (!await getSession(request, env)) return json({ ok: false, error: 'Não autorizado.' }, 401);
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ ok: false, error: 'Arquivo ausente.' }, 400);
  if (file.size > 25 * 1024 * 1024) return json({ ok: false, error: 'Arquivo maior que 25 MB.' }, 413);
  const key = `${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
  await env.MEDIA.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } });
  return json({ ok: true, key, url: `/api/media/${encodeURIComponent(key)}`, size: file.size, type: file.type || '' });
}

async function handleMedia(parts, request, env) {
  const key = decodeURIComponent(parts.slice(1).join('/'));
  if (!key) return json({ ok: false, error: 'Arquivo não informado.' }, 400);
  if (request.method === 'DELETE') {
    if (!await getSession(request, env)) return json({ ok: false, error: 'Não autorizado.' }, 401);
    await env.MEDIA.delete(key);
    return json({ ok: true });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'Método não permitido.' }, 405);
  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  if (request.method === 'HEAD') return new Response(null, { headers });
  return new Response(obj.body, { headers });
}

export async function onRequest(context) {
  const { request, env, params } = context;
  try {
    if (!env.DB) return json({ ok: false, error: 'Binding D1 DB não encontrado.' }, 500);
    await ensureSchema(env);
    const parts = pathParts(params);
    const root = parts[0] || '';
    if (root === 'health') return json({ ok: true, d1: !!env.DB, r2: !!env.MEDIA, service: 'Frame X Cloud API' });
    if (root === 'auth') return await handleAuth(parts, request, env);
    if (root === 'state') return await handleState(request, env);
    if (root === 'leads') return await handleLead(request, env);
    if (root === 'upload') {
      if (!env.MEDIA) return json({ ok: false, error: 'Binding R2 MEDIA não encontrado.' }, 500);
      return await handleUpload(request, env);
    }
    if (root === 'media') {
      if (!env.MEDIA) return json({ ok: false, error: 'Binding R2 MEDIA não encontrado.' }, 500);
      return await handleMedia(parts, request, env);
    }
    return json({ ok: false, error: 'API não encontrada.' }, 404);
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: 'Erro interno da API.', detail: String(error?.message || error) }, 500);
  }
}
