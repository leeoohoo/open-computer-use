export function SEOSchemas() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is Coasty?",
        "acceptedAnswer": { "@type": "Answer", "text": "Coasty is an AI employee platform — a computer-using agent that controls a desktop like a human. It opens browsers, clicks, types, navigates apps, fills forms, sends emails, and manages spreadsheets autonomously. Ranked #1 on the OSWorld benchmark with 82% completion rate across 369 real-world tasks." }
      },
      {
        "@type": "Question",
        "name": "How does Coasty compare to Anthropic Computer Use?",
        "acceptedAnswer": { "@type": "Answer", "text": "While Anthropic Computer Use provides a raw API for computer control, Coasty is a production-ready platform with managed VM infrastructure, built-in CAPTCHA solving, a desktop app for Mac and Windows, multi-model support, and the highest OSWorld benchmark score (82%). Coasty provides the complete solution — not just the API." }
      },
      {
        "@type": "Question",
        "name": "How much does Coasty cost?",
        "acceptedAnswer": { "@type": "Answer", "text": "Coasty starts at $20/month for the Starter plan with a free tier available. This compares to $3,000+ per month for a human virtual assistant. Coasty works 24/7 with no breaks, no training, and instant scalability." }
      },
      {
        "@type": "Question",
        "name": "Is Coasty safe to use?",
        "acceptedAnswer": { "@type": "Answer", "text": "Yes. Every Coasty session runs in its own isolated, sandboxed virtual machine. Your data stays safe, your machine stays untouched, and nothing leaks between sessions. This is true VM-level isolation, not just containers in a shared pool." }
      },
      {
        "@type": "Question",
        "name": "What is the OSWorld benchmark?",
        "acceptedAnswer": { "@type": "Answer", "text": "OSWorld is a benchmark for evaluating AI agents on real-world computer tasks. It tests 369 tasks across browsers, office apps, and system operations. Coasty scored 82%, the highest of any computer-using agent — achieving state-of-the-art performance." }
      },
      {
        "@type": "Question",
        "name": "How is Coasty different from RPA tools like UiPath?",
        "acceptedAnswer": { "@type": "Answer", "text": "Traditional RPA tools like UiPath require brittle scripting and break when interfaces change. Coasty uses AI vision to understand and interact with any interface, adapting in real-time without predefined scripts. It works like a human, not a macro. Setup takes minutes instead of weeks." }
      },
      {
        "@type": "Question",
        "name": "Does Coasty have a desktop app?",
        "acceptedAnswer": { "@type": "Answer", "text": "Yes. Coasty Desktop is available for both Mac and Windows. It runs as a floating overlay on your desktop and can control your local browser, files, terminal, and applications directly — no VM required for local tasks." }
      },
      {
        "@type": "Question",
        "name": "What can Coasty automate?",
        "acceptedAnswer": { "@type": "Answer", "text": "Coasty can automate virtually any computer task: web browsing, form filling, email sending, spreadsheet management, data entry, social media posting, job applications, sales prospecting, QA testing, customer support, LinkedIn recruiting, and more. If a human can do it on a computer, Coasty can too." }
      },
      {
        "@type": "Question",
        "name": "How does Coasty compare to OpenAI Operator?",
        "acceptedAnswer": { "@type": "Answer", "text": "Coasty outperforms OpenAI Operator on the OSWorld benchmark (82% vs ~40%), offers true VM-level isolation for every session, supports multiple AI models (not just one provider), includes full desktop control beyond just browser, and provides an open-source framework." }
      },
      {
        "@type": "Question",
        "name": "Can Coasty solve CAPTCHAs?",
        "acceptedAnswer": { "@type": "Answer", "text": "Yes. Coasty has a built-in CAPTCHA-solving pipeline, so it doesn't get blocked the way competing AI agents do. This is critical for real-world automation where CAPTCHAs are common on websites." }
      }
    ]
  }

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Coasty AI Employee",
    "description": "AI computer-using agent that controls a desktop like a human. #1 on OSWorld benchmark (82%). Autonomous browser automation, desktop control, email sending, form filling, and spreadsheet management with true VM-level isolation.",
    "brand": { "@type": "Brand", "name": "Coasty" },
    "category": "Software > Productivity > AI Automation",
    "image": "https://coasty.ai/og-image.png",
    "url": "https://coasty.ai",
    "offers": [
      {
        "@type": "Offer",
        "name": "Free Tier",
        "price": "0",
        "priceCurrency": "USD",
        "availability": "https://schema.org/InStock",
        "url": "https://coasty.ai/auth"
      },
      {
        "@type": "Offer",
        "name": "Starter Plan",
        "price": "20",
        "priceCurrency": "USD",
        "priceValidUntil": "2027-12-31",
        "availability": "https://schema.org/InStock",
        "url": "https://coasty.ai/auth"
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "bestRating": "5",
      "ratingCount": "1250"
    },
    "award": "#1 Ranked on OSWorld Benchmark — 82% completion rate across 369 real-world computer tasks"
  }

  const videoSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Coasty AI Agent Case Studies & Demos",
    "description": "Watch Coasty autonomously complete real-world computer tasks — marketing campaigns, job applications, QA testing, and more.",
    "itemListElement": [
      {
        "@type": "VideoObject",
        "position": 1,
        "name": "Coasty AI Agent — Autonomous Reddit Marketing Campaign",
        "description": "Watch Coasty autonomously run a full Reddit marketing campaign: researching competitors, identifying subreddits, crafting posts, and engaging with comments.",
        "thumbnailUrl": "https://img.youtube.com/vi/icxgLDephHE/maxresdefault.jpg",
        "uploadDate": "2026-03-04",
        "contentUrl": "https://youtube.com/watch?v=icxgLDephHE",
        "embedUrl": "https://youtube.com/embed/icxgLDephHE"
      },
      {
        "@type": "VideoObject",
        "position": 2,
        "name": "Coasty AI Agent — Autonomous Sales Prospecting & Email Outreach",
        "description": "Coasty finds prospective customers, researches their companies, writes personalized outreach emails, and sends them autonomously.",
        "thumbnailUrl": "https://img.youtube.com/vi/qTvmGfg3HVw/maxresdefault.jpg",
        "uploadDate": "2026-02-28",
        "contentUrl": "https://youtube.com/watch?v=qTvmGfg3HVw",
        "embedUrl": "https://youtube.com/embed/qTvmGfg3HVw"
      },
      {
        "@type": "VideoObject",
        "position": 3,
        "name": "Coasty AI Agent — Automated QA Testing",
        "description": "Watch Coasty QA test its own product: navigating checkout flows, catching bugs, and filing detailed reports.",
        "thumbnailUrl": "https://img.youtube.com/vi/Wbo2o74hVIo/maxresdefault.jpg",
        "uploadDate": "2026-03-03",
        "contentUrl": "https://youtube.com/watch?v=Wbo2o74hVIo",
        "embedUrl": "https://youtube.com/embed/Wbo2o74hVIo"
      },
      {
        "@type": "VideoObject",
        "position": 4,
        "name": "Coasty AI Agent — Autonomous Job Applications",
        "description": "Coasty finds matching roles, tailors resumes, and submits job applications across multiple platforms.",
        "thumbnailUrl": "https://img.youtube.com/vi/mH-csaCa508/maxresdefault.jpg",
        "uploadDate": "2026-02-24",
        "contentUrl": "https://youtube.com/watch?v=mH-csaCa508",
        "embedUrl": "https://youtube.com/embed/mH-csaCa508"
      },
      {
        "@type": "VideoObject",
        "position": 5,
        "name": "Coasty AI Agent — Filling Out YC S26 Application",
        "description": "Watch Coasty fill out the entire Y Combinator application: 30+ fields across multiple pages, completed autonomously.",
        "thumbnailUrl": "https://img.youtube.com/vi/AnHJuRMLCnE/maxresdefault.jpg",
        "uploadDate": "2026-02-26",
        "contentUrl": "https://youtube.com/watch?v=AnHJuRMLCnE",
        "embedUrl": "https://youtube.com/embed/AnHJuRMLCnE"
      },
      {
        "@type": "VideoObject",
        "position": 6,
        "name": "Coasty AI Agent — Posting on Hacker News Autonomously",
        "description": "Coasty drafts a blog post, submits it to Hacker News, and engages with comments in real time.",
        "thumbnailUrl": "https://img.youtube.com/vi/A_OvNh51Npg/maxresdefault.jpg",
        "uploadDate": "2026-02-22",
        "contentUrl": "https://youtube.com/watch?v=A_OvNh51Npg",
        "embedUrl": "https://youtube.com/embed/A_OvNh51Npg"
      }
    ]
  }

  return (
    <>
      <script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        id="product-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        id="video-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(videoSchema) }}
      />
    </>
  )
}
