import { NextResponse } from "next/server"
import https from "node:https"
import YAML from "yaml"

const UPDATES_BASE_URL = "https://updates.coasty.ai"

interface PlatformInfo {
  version: string
  filename: string
  sha512: string
  size: number
  releaseDate: string
  downloadUrl: string
}

/** Fetch a URL using raw Node.js https — bypasses Next.js fetch cache entirely */
function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Coasty/1.0" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      let body = ""
      res.setEncoding("utf8")
      res.on("data", (chunk) => (body += chunk))
      res.on("end", () => resolve(body))
      res.on("error", reject)
    }).on("error", reject)
  })
}

async function fetchManifest(
  filename: string
): Promise<PlatformInfo | null> {
  try {
    const text = await httpsGet(`${UPDATES_BASE_URL}/${filename}?t=${Date.now()}`)
    const data = YAML.parse(text)

    // electron-builder manifests have `path`, `version`, `sha512`, `releaseDate`
    // and sometimes `files` array. The top-level `path` is the main installer.
    const file = data.path || data.files?.[0]?.url
    const size = data.files?.[0]?.size ?? data.size ?? 0

    if (!file || !data.version) return null

    return {
      version: data.version,
      filename: file,
      sha512: data.sha512 || "",
      size,
      releaseDate: data.releaseDate || "",
      downloadUrl: `${UPDATES_BASE_URL}/${encodeURIComponent(file)}`,
    }
  } catch (err) {
    console.error(`Failed to fetch manifest ${filename}:`, err)
    return null
  }
}

export const dynamic = "force-dynamic"

export async function GET() {
  const [windows, mac] = await Promise.all([
    fetchManifest("latest.yml"),
    fetchManifest("latest-mac.yml"),
  ])

  return NextResponse.json(
    { windows, mac },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    }
  )
}
