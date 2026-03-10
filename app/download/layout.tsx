import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Download Coasty Desktop App — AI Agent for Mac & Windows",
  description: "Download Coasty Desktop, the #1 computer-using AI agent that controls your local machine. Browser automation, desktop control, terminal access, and file operations. Available for Windows and macOS. No VM required — runs directly on your computer.",
  keywords: ["Coasty desktop app", "AI desktop agent", "download AI agent", "computer use agent desktop app", "AI automation desktop app", "Mac AI agent", "Windows AI agent", "desktop automation software", "AI employee app download", "browser automation app"],
  openGraph: {
    title: "Download Coasty Desktop — AI Agent for Mac & Windows",
    description: "AI that controls your computer like a human. Browser, desktop, and terminal automation in one native app. #1 on OSWorld benchmark.",
    url: "https://coasty.ai/download",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Download Coasty Desktop App" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Download Coasty Desktop — AI Agent for Mac & Windows",
    description: "AI that controls your computer like a human. Browser, desktop, and terminal automation in one native app.",
  },
  alternates: { canonical: "https://coasty.ai/download" },
}

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children
}
