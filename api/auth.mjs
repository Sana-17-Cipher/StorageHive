import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import pg from 'pg'

const db = new pg.Pool()
const deriveKey = promisify(scrypt)
const passwordOptions = {
  N: 2 ** 17,
  r: 8,
  p: 1,
  maxmem: 160 * 1024 * 1024,
}
const sessionAgeSeconds = 8 * 60 * 60
const cookieName = 'storagehive_session'

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function readToken(request) {
  const match = (request.headers.cookie ?? '')
    .match(/(?:^|;\s*)storagehive_session=([a-f0-9]{64})(?=;|$)/)
  return match?.[1]
}

function setSessionCookie(response, token, maxAge) {
  response.setHeader(
    'Set-Cookie',
    `${cookieName}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`
  )
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const key = await deriveKey(password, salt, 64, passwordOptions)
  return `${salt}:${key.toString('hex')}`
}

async function verifyPassword(password, storedHash) {
  const [salt, expected] = (storedHash ?? '').split(':')
  const valid = /^[a-f0-9]{32}$/.test(salt) && /^[a-f0-9]{128}$/.test(expected)
  const key = await deriveKey(password, valid ? salt : '0'.repeat(32), 64, passwordOptions)
  return valid && timingSafeEqual(key, Buffer.from(expected, 'hex'))
}

async function readCredentials(request) {
  const contentType = request.headers['content-type']?.split(';')[0].trim()
  if (contentType !== 'application/json') return null

  const chunks = []
  let size = 0

  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length
    if (size > 4096) return null
    chunks.push(chunk)
  }

  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return null
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = body?.password

  if (
    email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    typeof password !== 'string' || password.length < 15 || password.length > 128
  ) {
    return null
  }

  return { email, password }
}

export async function currentUser(request) {
  const token = readToken(request)
  if (!token) return null

  const { rows } = await db.query(
    `SELECT users.email, users.storage_key
       FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1 AND sessions.expires_at > CURRENT_TIMESTAMP`,
    [tokenHash(token)]
  )
  return rows[0] ?? null
}

export async function handleAuth(request, response, pathname, sendJson) {
  response.setHeader('Cache-Control', 'no-store')

  if (pathname === '/api/auth/me' && request.method === 'GET') {
    const user = await currentUser(request)
    return user
      ? sendJson(response, 200, { email: user.email })
      : sendJson(response, 401, { error: 'Sign in first' })
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', pathname === '/api/auth/me' ? 'GET' : 'POST')
    return sendJson(response, 405, { error: 'Method not supported' })
  }

  if (pathname === '/api/auth/logout') {
    const token = readToken(request)
    if (token) {
      await db.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)])
    }
    setSessionCookie(response, '', 0)
    return sendJson(response, 200, { signedOut: true })
  }

  if (!['/api/auth/signup', '/api/auth/login'].includes(pathname)) {
    return sendJson(response, 404, { error: 'Route not found' })
  }

  const credentials = await readCredentials(request)
  if (!credentials) {
    return sendJson(response, 400, {
      error: 'Send a valid email and a password of 15 to 128 characters as JSON',
    })
  }

  const { email, password } = credentials

  if (pathname === '/api/auth/signup') {
    const passwordHash = await hashPassword(password)
    const result = await db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING`,
      [email, passwordHash]
    )
    if (!result.rowCount) {
      return sendJson(response, 409, { error: 'That account already exists' })
    }
    return sendJson(response, 201, { email })
  }

  const { rows } = await db.query(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email]
  )
  const user = rows[0]

  if (!(await verifyPassword(password, user?.password_hash))) {
    return sendJson(response, 401, { error: 'Invalid email or password' })
  }

  const token = randomBytes(32).toString('hex')
  await db.query(
    'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash(token), user.id, new Date(Date.now() + sessionAgeSeconds * 1000)]
  )
  setSessionCookie(response, token, sessionAgeSeconds)
  return sendJson(response, 200, { email })
}