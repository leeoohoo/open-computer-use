import { desktopCapturer, screen } from 'electron'
import { hideForScreenshot, showAfterScreenshot } from './window-manager'
import { hideRainbowForScreenshot, showRainbowAfterScreenshot } from './rainbow-border'

const JPEG_QUALITY = 70

export async function captureScreenshot(): Promise<any> {
  // Hide the overlay and rainbow border so they don't appear in the screenshot
  hideRainbowForScreenshot()
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

    // Send at full logical resolution — do NOT resize here.
    // The backend's detect_screen_resolution() reads the image dimensions to
    // learn the actual screen size, then GroundAgent.resize_coordinates()
    // scales from grounding space (1280x720) to screen space. Pre-resizing
    // to 1280 defeated that scaling and caused inaccurate clicks on Windows.
    const base64 = thumbnail.toJPEG(JPEG_QUALITY).toString('base64')

    showAfterScreenshot()
    showRainbowAfterScreenshot()

    return {
      success: true,
      screenshot: `data:image/jpeg;base64,${base64}`,
      frontendScreenshot: `data:image/jpeg;base64,${base64}`,
      resolution: `${width}x${height}`,
    }
  } catch (error: any) {
    // Always re-show the overlay even if screenshot fails
    showAfterScreenshot()
    showRainbowAfterScreenshot()
    return {
      success: false,
      error: `Screenshot failed: ${error.message}`,
    }
  }
}
