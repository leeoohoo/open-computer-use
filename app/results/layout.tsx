import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Demos & Results — Watch Coasty AI Agent Work Autonomously",
  description: "Watch Coasty autonomously run Reddit marketing campaigns, apply to jobs, fill out YC applications, QA test products, send personalized emails, recruit on LinkedIn, and more. Real case studies with video demos of the #1 computer-using AI agent.",
  keywords: ["AI agent case studies", "computer use agent demo", "autonomous AI examples", "AI employee results", "Coasty demos", "AI automation examples", "browser automation demo", "AI marketing automation", "AI job application", "AI QA testing"],
  openGraph: {
    title: "Demos — Watch Coasty AI Agent Work Autonomously",
    description: "Real demos of AI controlling a computer: Reddit marketing, job applications, QA testing, email outreach, and more. #1 on OSWorld benchmark.",
    url: "https://coasty.ai/results",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Coasty AI Agent Demos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Demos — Watch Coasty AI Agent Work Autonomously",
    description: "Real demos of AI controlling a computer: Reddit marketing, job applications, QA testing, email outreach, and more.",
  },
  alternates: { canonical: "https://coasty.ai/results" },
}

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return children
}
