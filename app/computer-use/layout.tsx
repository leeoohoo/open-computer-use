import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Computer Use AI Agent — #1 Ranked Desktop, Browser & Terminal Automation",
  description: "Coasty is the best computer use AI agent, ranked #1 on OSWorld (82%). Automate any desktop, browser, or terminal task with autonomous AI that controls computers like a human. Free trial available.",
  keywords: [
    "computer use", "computer use agent", "computer use AI", "best computer use agent",
    "AI computer use", "computer-using agent", "desktop automation AI", "browser automation AI",
    "autonomous computer control", "AI desktop agent", "computer use software",
    "best AI agent", "AI employee", "computer use automation", "RPA alternative",
    "AI agent for computer", "computer use tool", "AI that uses computer",
    "automated computer use", "computer use platform", "Coasty computer use",
    "AI computer control", "computer use benchmark", "OSWorld", "computer use API",
  ],
  openGraph: {
    title: "Coasty — The #1 Computer Use AI Agent",
    description: "The best computer use agent ranked #1 on OSWorld. Automate any desktop, browser, or terminal task with AI.",
    url: "https://coasty.ai/computer-use",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Coasty Computer Use AI Agent" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coasty — The #1 Computer Use AI Agent",
    description: "The best computer use agent ranked #1 on OSWorld. Automate any task with AI.",
  },
  alternates: { canonical: "https://coasty.ai/computer-use" },
}

export default function ComputerUseLayout({ children }: { children: React.ReactNode }) {
  return children
}
