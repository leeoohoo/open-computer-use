import { desktopCapturer, screen } from 'electron'
import { hideForScreenshot, showAfterScreenshot } from './window-manager'

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

    const base64 = sources[0].thumbnail.toPNG().toString('base64')

    showAfterScreenshot()

    return {
      success: true,
      screenshot: `data:image/png;base64,${base64}`,
      frontendScreenshot: `data:image/png;base64,${base64}`,
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
