import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_AUTH_COOKIE_NAME = 'admin-auth'

const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

type AdminSessionPayload = {
  exp: number
}

function getAdminSessionSecret(): string | null {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim() ||
    ''

  return secret ? secret : null
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }

  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }

  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padding = normalized.length % 4
  const padded =
    padding === 0 ? normalized : normalized + '='.repeat(4 - padding)
  return fromBase64(padded)
}

function encodePayload(payload: AdminSessionPayload): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
}

function decodePayload(value: string): AdminSessionPayload | null {
  try {
    const decoded = new TextDecoder().decode(fromBase64Url(value))
    const parsed = JSON.parse(decoded) as Partial<AdminSessionPayload>
    if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp)) {
      return null
    }
    return { exp: parsed.exp }
  } catch {
    return null
  }
}

async function signValue(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  )

  return toBase64Url(new Uint8Array(signature))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let result = 0
  for (let index = 0; index < a.length; index++) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }

  return result === 0
}

export function getAdminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    path: '/',
  }
}

export async function createAdminSessionToken(): Promise<string> {
  const secret = getAdminSessionSecret()
  if (!secret) {
    throw new Error('Missing admin session secret')
  }

  const payload: AdminSessionPayload = {
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  }

  const encodedPayload = encodePayload(payload)
  const signature = await signValue(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export async function verifyAdminSessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false

  const secret = getAdminSessionSecret()
  if (!secret) return false

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return false

  const expectedSignature = await signValue(encodedPayload, secret)
  if (!timingSafeEqual(expectedSignature, signature)) return false

  const payload = decodePayload(encodedPayload)
  if (!payload) return false

  return payload.exp > Math.floor(Date.now() / 1000)
}

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(ADMIN_AUTH_COOKIE_NAME)?.value
  return verifyAdminSessionToken(token)
}

export async function requireAdmin(
  req: NextRequest,
): Promise<NextResponse | null> {
  const ok = await isAdminRequest(req)
  if (ok) return null
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
