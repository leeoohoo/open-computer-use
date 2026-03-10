import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Compare Coasty — AI Agent Alternatives & Competitor Comparison",
  description: "See how Coasty's #1 ranked computer-using AI agent compares to Anthropic Computer Use, OpenAI Operator, Adept AI, Multion, UiPath, Automation Anywhere, and hiring virtual assistants. Feature-by-feature comparisons with pricing.",
  keywords: [
    "Coasty vs Anthropic Computer Use",
    "Coasty vs OpenAI Operator",
    "Coasty vs Adept AI",
    "Coasty vs UiPath",
    "AI agent comparison",
    "computer use agent alternatives",
    "best AI agent 2026",
    "RPA vs AI agent",
    "virtual assistant alternative",
  ],
  openGraph: {
    title: "Compare Coasty with AI Agent Alternatives",
    description: "Feature-by-feature comparison of the #1 computer-using AI agent vs competitors. Benchmark scores, pricing, capabilities.",
    url: "https://coasty.ai/compare",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  alternates: { canonical: "https://coasty.ai/compare" },
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children
}
