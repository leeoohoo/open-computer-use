import { Metadata } from "next"

const blogPostMeta: Record<string, { title: string; excerpt: string; category: string; author: string; date: string }> = {
  "desktop-control-agi": { title: "Why AI Agents Controlling Desktops Are Our Fastest Path to AGI", excerpt: "The real breakthrough in AGI is happening through AI agents that can see, click, and control computers exactly like humans do.", category: "Research", author: "Marcus Sterling", date: "2026-03-05" },
  "coasty-reddit-marketing": { title: "How Coasty Ran a Full Reddit Marketing Campaign Autonomously", excerpt: "We gave Coasty a single prompt: market our product on Reddit. It researched competitors, identified subreddits, crafted posts, and engaged with comments.", category: "Case Study", author: "Sarah Chen", date: "2026-03-04" },
  "qa-testing-itself": { title: "We Let Coasty QA Test Its Own Product. It Found 14 Bugs.", excerpt: "We pointed Coasty at its own checkout and onboarding flows. It navigated every path, filed detailed bug reports, and caught issues our team missed.", category: "Case Study", author: "Michael Rodriguez", date: "2026-03-03" },
  "osworld-benchmark": { title: "82% on OSWorld: What State-of-the-Art Computer Use Actually Means", excerpt: "Coasty achieved the highest score on the OSWorld benchmark for autonomous computer use. We break down how it works and what this means for real-world tasks.", category: "Research", author: "Emily Watson", date: "2026-03-01" },
  "prospecting-outreach": { title: "From Zero to 200 Personalized Emails: Autonomous Sales Prospecting", excerpt: "Coasty found prospective customers, researched their companies, wrote personalized outreach emails, and sent them.", category: "Case Study", author: "David Park", date: "2026-02-28" },
  "yc-application": { title: "Can an AI Fill Out the YC S26 Application? We Tried It.", excerpt: "The Y Combinator application is notoriously detailed. We gave Coasty our company info and asked it to fill the entire form.", category: "Case Study", author: "Alex Thompson", date: "2026-02-26" },
  "job-application-agent": { title: "Coasty Applied to 50 Jobs in One Afternoon", excerpt: "We tasked Coasty with finding matching roles, tailoring a resume for each, and submitting applications across job boards.", category: "Case Study", author: "Rachel Kim", date: "2026-02-24" },
  "hacker-news-engagement": { title: "Writing and Posting on Hacker News, Autonomously", excerpt: "Coasty drafted a blog post, submitted it to Hacker News, and engaged with comments in real time.", category: "Case Study", author: "James Liu", date: "2026-02-22" },
  "multi-model-orchestration": { title: "Why We Use Multiple AI Models Instead of One", excerpt: "Different models excel at different tasks. Our multi-model orchestration routes tasks to the best-suited model in real time.", category: "Engineering", author: "Emily Watson", date: "2026-02-20" },
  "electron-local-agent": { title: "Introducing Coasty Desktop: AI That Controls Your Local Machine", excerpt: "Our new Electron app runs as a floating overlay and executes agent commands directly on your computer. No VMs, no latency.", category: "Product", author: "Michael Rodriguez", date: "2026-02-18" },
  "browser-agent-architecture": { title: "How Our Browser Agent Thinks Before It Clicks", excerpt: "A deep dive into the search-first strategy our browser agent uses to minimize browsing and maximize accuracy.", category: "Engineering", author: "Rachel Kim", date: "2026-02-15" },
  "email-automation-case": { title: "Sending Emails You Would Actually Send: AI-Written Outreach That Works", excerpt: "Coasty composed, reviewed, and sent a real email on behalf of a user, matching their tone and pulling context from previous conversations.", category: "Case Study", author: "Sarah Chen", date: "2026-02-13" },
  "sandboxed-execution": { title: "How We Run AI-Generated Code Safely in Docker Containers", excerpt: "Every agent session runs inside an isolated container with resource limits, network controls, and automatic teardown.", category: "Engineering", author: "Alex Thompson", date: "2026-02-10" },
  "ai-employee-economics": { title: "The Economics of an AI Employee vs. a Human Hire", excerpt: "An AI agent costs a fraction of a full-time hire and works around the clock. We break down the real numbers.", category: "Industry", author: "David Park", date: "2026-02-08" },
  "customer-support-agent": { title: "Resolving Support Tickets Without Human Intervention", excerpt: "Coasty looked up customer accounts, diagnosed issues, wrote replies, and resolved tickets end-to-end.", category: "Case Study", author: "Lisa Chen", date: "2026-02-05" },
  "byok-philosophy": { title: "Bring Your Own Keys: Why We Believe in User Control", excerpt: "Your API keys, your control. BYOK ensures complete transparency and the freedom to switch providers.", category: "Product", author: "Lisa Chen", date: "2026-02-03" },
  "linkedin-recruiting": { title: "Sourcing Candidates on LinkedIn and Scheduling Calls, Autonomously", excerpt: "Coasty found senior engineers on LinkedIn, sent personalized connection requests, and scheduled introductory calls.", category: "Case Study", author: "James Liu", date: "2026-02-01" },
  "prompt-caching-tokens": { title: "Cutting Token Costs 60% with Prompt Caching", excerpt: "We implemented prompt caching across multi-turn conversations to dramatically reduce costs without sacrificing context quality.", category: "Engineering", author: "Michael Rodriguez", date: "2026-01-28" },
  "future-ai-agents": { title: "The Future of AI Agents: Predictions for the Next 12 Months", excerpt: "From month-long autonomous projects to cross-application workflows without APIs, here is what we expect to see by early 2027.", category: "Industry", author: "Marcus Sterling", date: "2026-01-25" },
  "open-source-movement": { title: "Open Source AI Models and Why They Matter for Agents", excerpt: "Open-source models bring transparency, customization, and privacy to the agent ecosystem alongside proprietary models.", category: "Industry", author: "Alex Thompson", date: "2026-01-20" },
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const post = blogPostMeta[id]
  if (!post) return { title: "Blog Post Not Found" }

  return {
    title: `${post.title} - Coasty Blog`,
    description: post.excerpt,
    keywords: [post.category, "AI agent", "computer use agent", "Coasty", "autonomous AI", "desktop automation"],
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://coasty.ai/blog/${id}`,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      siteName: "Coasty Blog",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
    alternates: { canonical: `https://coasty.ai/blog/${id}` },
  }
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
