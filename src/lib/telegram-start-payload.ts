const REGISTRATION_PREFIX = 'regb64_'

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function decodeBase64Url(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8')
  } catch {
    return null
  }
}

export function buildStartRegistrationPayload(accessCode: string): string {
  const normalized = accessCode.trim()
  if (!normalized) return ''

  const encoded = Buffer.from(normalized, 'utf8').toString('base64url')
  const payload = `${REGISTRATION_PREFIX}${encoded}`

  if (payload.length <= 64) return payload

  // Telegram deep-link payload has a hard 64-char limit.
  // If it is exceeded, fallback to plain /start without payload.
  return ''
}

export function parseStartRegistrationPayload(args: string): string | null {
  const rawToken = args.trim().split(/\s+/)[0]?.trim()
  if (!rawToken) return null

  const token = safeDecodeURIComponent(rawToken)

  if (token.startsWith(REGISTRATION_PREFIX)) {
    const encoded = token.slice(REGISTRATION_PREFIX.length).trim()
    if (!encoded) return null
    const decoded = decodeBase64Url(encoded)?.trim()
    return decoded || null
  }

  if (token.startsWith('reg_')) return token.slice(4).trim() || null
  if (token.startsWith('register_')) return token.slice(9).trim() || null

  return token
}
