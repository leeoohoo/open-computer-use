import { screen } from 'electron'
import { hideForScreenshot, showAfterScreenshot } from './window-manager'

export async function captureScreenshot(): Promise<any> {
  // Hide the overlay so it doesn't appear in the screenshot
  await hideForScreenshot()

  try {
    // Use screenshot-desktop for cross-platform support
    const screenshot = require('screenshot-desktop')
    const imgBuffer: Buffer = await screenshot({ format: 'png' })
    const base64 = imgBuffer.toString('base64')

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

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
