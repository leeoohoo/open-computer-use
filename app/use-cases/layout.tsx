import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Use Cases - Coasty AI Agent for Business Operations",
  description: "Discover 12 ways Coasty's AI agent automates your operations — competitor research, QA testing, lead generation, email outreach, and more. Real results with specific numbers.",
  keywords: ["AI agent use cases", "computer use agent", "business automation", "AI competitor research", "automated QA testing", "AI lead generation", "AI email outreach", "AI data extraction"],
  openGraph: {
    title: "Use Cases - Coasty AI Agent",
    description: "12 ways to 10x your output on autopilot. Real results, real numbers.",
    url: "https://coasty.ai/use-cases",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  alternates: { canonical: "https://coasty.ai/use-cases" },
}

export default function UseCasesLayout({ children }: { children: React.ReactNode }) {
  return children
}
