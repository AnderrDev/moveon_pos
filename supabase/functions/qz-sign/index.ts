import { createClient } from 'npm:@supabase/supabase-js@2'

interface SigningRequest {
  action?: 'certificate' | 'sign'
  request?: string
}

const textEncoder = new TextEncoder()
const defaultAllowedOrigins = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'https://bespoke-sopapillas-b3e7dc.netlify.app',
]
let signingKeyPromise: Promise<CryptoKey> | null = null

Deno.serve(async (request) => {
  const origin = request.headers.get('origin')
  const corsHeaders = buildCorsHeaders(origin)

  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders)
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  try {
    const authorized = await hasActiveStoreMembership(request)
    if (!authorized) {
      return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
    }

    const body = (await request.json()) as SigningRequest
    if (body.action === 'certificate') {
      const certificate = normalizePem(requiredEnv('QZ_CERTIFICATE'))
      if (!certificate.includes('BEGIN CERTIFICATE')) {
        throw new Error('QZ_CERTIFICATE is not a valid PEM certificate')
      }
      return jsonResponse({ certificate }, 200, corsHeaders)
    }

    if (body.action === 'sign') {
      const value = body.request?.trim() ?? ''
      if (!/^[a-f0-9]{64}$/i.test(value)) {
        return jsonResponse({ error: 'Invalid QZ signing request' }, 400, corsHeaders)
      }

      const signature = await sign(value)
      return jsonResponse({ signature }, 200, corsHeaders)
    }

    return jsonResponse({ error: 'Invalid action' }, 400, corsHeaders)
  } catch (error) {
    console.error('qz-sign failed', error)
    return jsonResponse({ error: 'Signing service unavailable' }, 500, corsHeaders)
  }
})

async function hasActiveStoreMembership(request: Request): Promise<boolean> {
  const authorization = request.headers.get('authorization')
  if (!authorization) return false

  const supabase = createClient(requiredEnv('SUPABASE_URL'), getPublishableKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return false

  const { data, error } = await supabase
    .from('user_tiendas')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  return !error && Boolean(data)
}

async function sign(value: string): Promise<string> {
  const key = await getSigningKey()
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    textEncoder.encode(value),
  )
  return bytesToBase64(new Uint8Array(signature))
}

function getSigningKey(): Promise<CryptoKey> {
  signingKeyPromise ??= importSigningKey().catch((error) => {
    signingKeyPromise = null
    throw error
  })
  return signingKeyPromise
}

async function importSigningKey(): Promise<CryptoKey> {
  const privateKey = normalizePem(requiredEnv('QZ_PRIVATE_KEY'))
  const keyData = pemBodyToBytes(privateKey, 'PRIVATE KEY')

  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
    false,
    ['sign'],
  )
}

function pemBodyToBytes(pem: string, label: string): Uint8Array {
  const body = pem
    .replace(`-----BEGIN ${label}-----`, '')
    .replace(`-----END ${label}-----`, '')
    .replace(/\s/g, '')

  if (!body) throw new Error(`Missing ${label} PEM body`)

  const binary = atob(body)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function getPublishableKey(): string {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (legacyKey) return legacyKey

  const keysValue = requiredEnv('SUPABASE_PUBLISHABLE_KEYS')
  const keys = JSON.parse(keysValue) as Record<string, string>
  const key = keys.default ?? Object.values(keys)[0]
  if (!key) throw new Error('No Supabase publishable key is configured')
  return key
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim()
}

function isAllowedOrigin(origin: string): boolean {
  return allowedOrigins().has(origin)
}

function allowedOrigins(): Set<string> {
  const configured = Deno.env.get('QZ_ALLOWED_ORIGINS') ?? ''
  return new Set([
    ...defaultAllowedOrigins,
    ...configured.split(',').map((origin) => origin.trim()).filter(Boolean),
  ])
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  }
  if (origin && isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), { status, headers })
}
