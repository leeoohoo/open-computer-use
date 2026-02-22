import { desktopCapturer, screen } from 'electron'
import { hideForScreenshot, showAfterScreenshot } from './window-manager'

const MAX_WIDTH = 1280
const JPEG_QUALITY = 70

export async function captureScreenshot(): Promise<any> {
  // Hide the overlay so it doesn't appear in the screenshot
  await hideForScreenshot()

  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    // Use Electron's built-in desktopCapturer — works reliably in packaged apps
    // unlike screenshot-desktop which needs asar-unpacked .bat files on Windows
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    })

    if (!sources || sources.length === 0) {
      throw new Error('No screen sources found')
    }

    const thumbnail = sources[0].thumbnail
    const thumbSize = thumbnail.getSize()

    // Guard against empty captures (e.g. Screen Recording permission denied)
    if (thumbSize.width === 0 || thumbSize.height === 0) {
      throw new Error('Empty screenshot — check Screen Recording permission')
    }

    // Resize to max 1280px wide and compress to JPEG to keep WebSocket
    // payloads small (~100-200 KB instead of 5-10 MB uncompressed PNG)
    let image = thumbnail
    if (thumbSize.width > MAX_WIDTH) {
      const scale = MAX_WIDTH / thumbSize.width
      image = thumbnail.resize({
        width: MAX_WIDTH,
        height: Math.round(thumbSize.height * scale),
      })
    }

    const base64 = image.toJPEG(JPEG_QUALITY).toString('base64')

    showAfterScreenshot()

    return {
      success: true,
      screenshot: `data:image/jpeg;base64,${base64}`,
      frontendScreenshot: `data:image/jpeg;base64,${base64}`,
      resolution: `${width}x${height}`,
    }
  } catch (error: any) {
    // Always re-show the overlay even if screenshot fails
    showAfterScreenshot()
    return {
      success: false,
      error: `Screenshot failed: ${error.message}`,
    }
  }
}
