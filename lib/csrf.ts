import { cookies } from "next/headers"

const CSRF_SECRET = process.env.CSRF_SECRET!

// Convert ArrayBuffer to hex string
function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// Generate random bytes using Web Crypto API
function generateRandomBytes(length: number): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return arrayBufferToHex(array.buffer)
}

// Hash using Web Crypto API
async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8)
  return arrayBufferToHex(hashBuffer)
}

export async function generateCsrfToken(): Promise<string> {
  const raw = generateRandomBytes(32)
  const token = await sha256(`${raw}${CSRF_SECRET}`)
  return `${raw}:${token}`
}

export async function validateCsrfToken(fullToken: string): Promise<boolean> {
  const [raw, token] = fullToken.split(":")
  if (!raw || !token) return false
  const expected = await sha256(`${raw}${CSRF_SECRET}`)
  return expected === token
}

export async function setCsrfCookie() {
  const cookieStore = await cookies()
  const token = await generateCsrfToken()
  cookieStore.set("csrf_token", token, {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
  })
}
