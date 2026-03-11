const blogPosts = [
  { id: "desktop-control-agi", title: "Why AI Agents Controlling Desktops Are Our Fastest Path to AGI", date: "2026-03-05", author: "Marcus Sterling", excerpt: "The real breakthrough in AGI is happening through AI agents that can see, click, and control computers exactly like humans do." },
  { id: "coasty-reddit-marketing", title: "How Coasty Ran a Full Reddit Marketing Campaign Autonomously", date: "2026-03-04", author: "Sarah Chen", excerpt: "We gave Coasty a single prompt: market our product on Reddit. It researched competitors, identified subreddits, crafted posts, and engaged with comments." },
  { id: "qa-testing-itself", title: "We Let Coasty QA Test Its Own Product. It Found 14 Bugs.", date: "2026-03-03", author: "Michael Rodriguez", excerpt: "We pointed Coasty at its own checkout and onboarding flows. It navigated every path, filed detailed bug reports, and caught issues our team missed." },
  { id: "osworld-benchmark", title: "82% on OSWorld: What State-of-the-Art Computer Use Actually Means", date: "2026-03-01", author: "Emily Watson", excerpt: "Coasty achieved the highest score on the OSWorld benchmark. We break down how it works and what this means." },
  { id: "prospecting-outreach", title: "From Zero to 200 Personalized Emails: Autonomous Sales Prospecting", date: "2026-02-28", author: "David Park", excerpt: "Coasty found prospective customers, researched their companies, wrote personalized outreach emails, and sent them." },
  { id: "yc-application", title: "Can an AI Fill Out the YC S26 Application? We Tried It.", date: "2026-02-26", author: "Alex Thompson", excerpt: "The Y Combinator application is notoriously detailed. We gave Coasty our company info and asked it to fill the entire form." },
  { id: "job-application-agent", title: "Coasty Applied to 50 Jobs in One Afternoon", date: "2026-02-24", author: "Rachel Kim", excerpt: "We tasked Coasty with finding matching roles, tailoring a resume for each, and submitting applications." },
  { id: "hacker-news-engagement", title: "Writing and Posting on Hacker News, Autonomously", date: "2026-02-22", author: "James Liu", excerpt: "Coasty drafted a blog post, submitted it to Hacker News, and engaged with comments in real time." },
  { id: "multi-model-orchestration", title: "Why We Use Multiple AI Models Instead of One", date: "2026-02-20", author: "Emily Watson", excerpt: "Different models excel at different tasks. Our multi-model orchestration routes tasks to the best-suited model." },
  { id: "electron-local-agent", title: "Introducing Coasty Desktop: AI That Controls Your Local Machine", date: "2026-02-18", author: "Michael Rodriguez", excerpt: "Our Electron app runs as a floating overlay and executes agent commands directly on your computer." },
  { id: "browser-agent-architecture", title: "How Our Browser Agent Thinks Before It Clicks", date: "2026-02-15", author: "Rachel Kim", excerpt: "A deep dive into the search-first strategy our browser agent uses." },
  { id: "email-automation-case", title: "Sending Emails You Would Actually Send: AI-Written Outreach That Works", date: "2026-02-13", author: "Sarah Chen", excerpt: "Coasty composed, reviewed, and sent a real email on behalf of a user." },
  { id: "sandboxed-execution", title: "How We Run AI-Generated Code Safely in Docker Containers", date: "2026-02-10", author: "Alex Thompson", excerpt: "Every agent session runs inside an isolated container with resource limits and automatic teardown." },
  { id: "ai-employee-economics", title: "The Economics of an AI Employee vs. a Human Hire", date: "2026-02-08", author: "David Park", excerpt: "An AI agent costs a fraction of a full-time hire and works around the clock." },
  { id: "customer-support-agent", title: "Resolving Support Tickets Without Human Intervention", date: "2026-02-05", author: "Lisa Chen", excerpt: "Coasty looked up customer accounts, diagnosed issues, wrote replies, and resolved tickets end-to-end." },
  { id: "byok-philosophy", title: "Bring Your Own Keys: Why We Believe in User Control", date: "2026-02-03", author: "Lisa Chen", excerpt: "Your API keys, your control. BYOK ensures transparency and freedom to switch providers." },
  { id: "linkedin-recruiting", title: "Sourcing Candidates on LinkedIn and Scheduling Calls, Autonomously", date: "2026-02-01", author: "James Liu", excerpt: "Coasty found senior engineers on LinkedIn, sent personalized connection requests, and scheduled calls." },
  { id: "prompt-caching-tokens", title: "Cutting Token Costs 60% with Prompt Caching", date: "2026-01-28", author: "Michael Rodriguez", excerpt: "We implemented prompt caching across multi-turn conversations to dramatically reduce costs." },
  { id: "future-ai-agents", title: "The Future of AI Agents: Predictions for the Next 12 Months", date: "2026-01-25", author: "Marcus Sterling", excerpt: "From month-long autonomous projects to cross-application workflows, here is what we expect." },
  { id: "open-source-movement", title: "Open Source AI Models and Why They Matter for Agents", date: "2026-01-20", author: "Alex Thompson", excerpt: "Open-source models bring transparency, customization, and privacy to the agent ecosystem." },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRFC2822(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z");
  return date.toUTCString();
}

export function GET() {
  const lastBuildDate = toRFC2822(blogPosts[0].date);

  const items = blogPosts
    .map(
      (post) => `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>https://coasty.ai/blog/${post.id}</link>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${toRFC2822(post.date)}</pubDate>
      <guid isPermaLink="true">https://coasty.ai/blog/${post.id}</guid>
      <author>${escapeXml(post.author)}</author>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Coasty Blog — AI Agent Insights &amp; Computer Use Research</title>
    <description>Deep dives into autonomous AI agents, computer use technology, real-world case studies, and the future of AI employees. From the team behind the #1 ranked computer-using agent.</description>
    <link>https://coasty.ai/blog</link>
    <atom:link href="https://coasty.ai/blog/feed.xml" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
