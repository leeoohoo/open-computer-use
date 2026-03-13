import { Metadata } from "next"

export const metadata: Metadata = {
  title: "What Can Coasty Do? — The Complete Guide to AI Computer Automation",
  description: "Discover everything Coasty can automate: sales prospecting, email outreach, job applications, QA testing, data entry, social media, recruiting, research, and 100+ more tasks. See real examples of AI desktop automation.",
  keywords: [
    "AI automation examples",
    "computer use agent capabilities",
    "AI desktop automation guide",
    "Coasty use cases",
    "AI employee tasks",
    "autonomous AI agent examples",
    "browser automation use cases",
    "AI virtual assistant capabilities",
    "RPA alternative",
    "AI computer control",
    "automated data entry",
    "AI sales prospecting",
    "AI job applications",
    "AI QA testing",
    "desktop automation examples"
  ],
  openGraph: {
    title: "What Can Coasty Do? — Complete AI Automation Guide",
    description: "Explore 100+ tasks Coasty can automate. From sales outreach to QA testing, see exactly how an AI computer agent handles real-world work.",
    url: "https://coasty.ai/guide",
    type: "website",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Coasty AI Automation Guide" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "What Can Coasty Do? — Complete AI Automation Guide",
    description: "Explore 100+ tasks Coasty can automate. From sales outreach to QA testing, see exactly how an AI computer agent handles real-world work.",
  },
  alternates: { canonical: "https://coasty.ai/guide" },
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return children
}
