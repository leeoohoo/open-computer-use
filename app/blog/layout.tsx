import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Blog - AI Agent Insights, Computer Use Research & Case Studies",
  description: "Deep dives into autonomous AI agents, computer use technology, real-world automation case studies, OSWorld benchmark analysis, browser agent architecture, and the future of AI employees. From the team behind the #1 computer-using agent.",
  keywords: ["AI agent blog", "computer use agent articles", "autonomous AI insights", "AI employee blog", "OSWorld benchmark analysis", "browser automation blog", "AI automation articles", "desktop agent engineering", "AI agent research"],
  openGraph: {
    title: "Coasty Blog - AI Agent Insights & Case Studies",
    description: "Deep dives into autonomous AI agents, computer use technology, and real-world automation case studies from the #1 ranked computer-using agent.",
    url: "https://coasty.ai/blog",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Coasty Blog" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Coasty Blog - AI Agent Insights & Case Studies",
    description: "Deep dives into autonomous AI agents, computer use technology, and real-world automation case studies.",
  },
  alternates: { canonical: "https://coasty.ai/blog" },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
