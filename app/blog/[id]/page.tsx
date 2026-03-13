"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { LandingFooter } from "@/app/components/landing/landing-footer"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import { notFound } from "next/navigation"

interface ContentBlock {
  type: "intro" | "section" | "highlight" | "conclusion"
  text?: string
  title?: string
  bullets?: string[]
}

interface BlogPost {
  id: string
  title: string
  excerpt: string
  author: string
  date: string
  readTime: string
  category: string
  content: ContentBlock[]
}

const blogPosts: BlogPost[] = [
  {
    id: "agent-swarm-launch",
    title: "Introducing Agent Swarms: The Most Powerful Parallel Computer-Use System Ever Built",
    excerpt: "Today we are launching Agent Swarms — the ability to split any task across multiple autonomous machines running simultaneously. This is not prompt chaining. This is full computer-use at scale.",
    author: "Marcus Sterling",
    date: "2026-03-13",
    readTime: "12 min",
    category: "Product",
    content: [
      {
        type: "intro",
        text: "Every other AI agent tool on the market works sequentially. One model, one task, one step at a time. That is fine for simple prompts. But real work does not happen that way. When you need to research 50 companies, apply to 20 jobs, or QA test 10 flows simultaneously — sequential execution is a bottleneck. Today, we are removing that bottleneck entirely."
      },
      {
        type: "highlight",
        text: "Agent Swarms let you split a single task across multiple autonomous machines, each running its own browser, terminal, and desktop — all executing in parallel."
      },
      {
        type: "section",
        title: "What Makes This Different from Every Other \"Multi-Agent\" System",
        text: "Most multi-agent frameworks are just orchestration layers on top of API calls. They route prompts between models and call it parallel execution. Coasty Swarms are fundamentally different. Each swarm agent gets its own full virtual machine — a real Ubuntu desktop with Chrome, a terminal, a file system, and desktop automation. These are not threads sharing a context window. They are independent computers doing independent work, coordinated by a central orchestrator that decomposes your task, assigns subtasks, and aggregates results."
      },
      {
        type: "section",
        title: "The Architecture: Real VMs, Real Isolation, Real Parallelism",
        text: "When you enable Swarm Mode and send a task, here is what happens under the hood:",
        bullets: [
          "The orchestrator analyzes your task and breaks it into independent subtasks that can run concurrently",
          "For each subtask, a fresh VM is provisioned with its own browser, terminal, and desktop environment",
          "Each agent receives its subtask plus any shared context (credentials, files, previous results)",
          "All agents execute simultaneously — browsing different sites, filling different forms, researching different topics",
          "Results stream back in real time to a unified panel where you can monitor every agent's progress",
          "When all agents complete, results are aggregated into a single coherent output"
        ]
      },
      {
        type: "section",
        title: "State-of-the-Art Computer Use at Scale",
        text: "Coasty already holds the highest score on the OSWorld benchmark at 82% — the gold standard for measuring autonomous computer use. Swarms take that state-of-the-art capability and multiply it. Each agent in a swarm has the full power of our SOTA browser agent, terminal agent, and desktop agent. They can navigate complex websites, handle CAPTCHAs and popups, fill forms with saved credentials, execute shell commands, and interact with desktop applications. Now imagine that happening on 6 machines at once."
      },
      {
        type: "highlight",
        text: "A task that takes one agent 60 minutes can be completed by a 6-agent swarm in roughly 10 minutes. Same quality. Same reliability. 6x the throughput."
      },
      {
        type: "section",
        title: "Real Use Cases We Have Tested",
        text: "During our internal beta, we ran swarms on production workloads that would be impractical with a single agent:",
        bullets: [
          "Sales prospecting: 6 agents each researching 10 companies, extracting decision-maker contacts, and drafting personalized outreach emails — 60 prospects in 15 minutes instead of 90",
          "Job applications: 4 agents simultaneously applying to different roles on LinkedIn, Indeed, Glassdoor, and AngelList with tailored resumes for each",
          "QA testing: 3 agents testing signup, checkout, and settings flows in parallel, each covering different edge cases and screen sizes",
          "Competitive research: 5 agents monitoring different competitor websites, extracting pricing, features, and changelog updates into a unified spreadsheet",
          "Content distribution: 4 agents posting the same announcement across Reddit, Twitter/X, LinkedIn, and Hacker News with platform-specific formatting"
        ]
      },
      {
        type: "section",
        title: "Security and Isolation",
        text: "Every swarm agent runs in its own isolated container. There is no shared memory, no shared file system, no cross-contamination between agents. Credentials are injected per-agent based on the subtask requirements. When a swarm session ends, all containers are destroyed. Nothing persists unless you explicitly save the results. This is the same security model we use for single-agent sessions, applied to every agent in the swarm."
      },
      {
        type: "section",
        title: "Pricing: Simple and Transparent",
        text: "Swarm sessions consume credits at the same rate as regular sessions — 10 credits per minute per agent. If you run 4 agents for 10 minutes, that is 400 credits. Your plan's swarm limit is 2x your persistent machine count: Starter gets 2 parallel agents, Plus gets 4, and Pro gets 6. Swarm machines are temporary and auto-delete after the task completes, so you are only charged for active execution time."
      },
      {
        type: "section",
        title: "Why We Built This",
        text: "We built Coasty to replace the repetitive computer work that drains human productivity. But some tasks are not just repetitive — they are embarrassingly parallel. There is no reason to research companies one at a time when you could research 6 simultaneously. There is no reason to test one flow and then the next when you could test all of them at once. Swarms are the natural evolution of computer-use agents. The question was never whether AI could do the work. It was whether it could do enough of it, fast enough, to actually change how teams operate. With Agent Swarms, the answer is yes."
      },
      {
        type: "conclusion",
        text: "Agent Swarms are available today for all paid plans. Enable Swarm Mode from the chat interface, describe your task, and watch multiple agents work in parallel. This is the most powerful parallel computer-use system ever built. And we are just getting started."
      },
    ],
  },
  {
    id: "desktop-control-agi",
    title: "Why AI Agents Controlling Desktops Are Our Fastest Path to AGI",
    excerpt: "Forget chat interfaces and API calls. The real breakthrough in artificial general intelligence is happening through AI agents that can see, click, and control computers exactly like humans do.",
    author: "Marcus Sterling",
    date: "2026-03-05",
    readTime: "15 min",
    category: "Research",
    content: [
      {
        type: "intro",
        text: "Here is a controversial opinion that will make Silicon Valley uncomfortable: We are approaching AGI all wrong. While billions pour into making larger language models, the real path to artificial general intelligence is staring us in the face. It is through AI agents that can control computers like humans do."
      },
      {
        type: "highlight",
        text: "The ability to control a desktop environment is not just another feature. It is the missing link between narrow AI and AGI."
      },
      {
        type: "section",
        title: "Why Desktop Control Changes Everything",
        text: "Think about it: Human intelligence did not evolve in isolation. It evolved through interaction with tools and environments. Our cognitive abilities are fundamentally tied to our ability to manipulate our surroundings. When we give AI agents the same capability, the ability to see screens, move mice, type on keyboards, and interact with any software, we are not just adding features. We are fundamentally changing what AI can become."
      },
      {
        type: "section",
        title: "The Embodiment Hypothesis Nobody Talks About",
        text: "Robotics researchers have long argued that intelligence requires embodiment, a physical presence in the world. But they have been thinking too literally. A desktop environment IS embodiment. It is a standardized, universal interface to the digital world where most human knowledge work happens. An AI that can navigate this environment has a form of digital embodiment that is arguably more powerful than a physical robot."
      },
      {
        type: "section",
        title: "The Uncomfortable Truth About Current AI Limitations",
        bullets: [
          "Chat interfaces force AI into an unnatural communication bottleneck",
          "API-based integrations limit AI to predefined pathways",
          "Current AI cannot learn through exploration and experimentation",
          "We have created incredibly smart systems that are functionally helpless",
          "The gap between knowing and doing remains unbridged"
        ]
      },
      {
        type: "section",
        title: "Real AGI Requires Real-World Interaction",
        text: "When an AI agent can control a desktop, it gains something crucial: the ability to learn through trial and error in a complex environment. It can debug its own code by actually running it. It can verify its answers by checking multiple sources. It can learn new tools without being explicitly programmed. This is not just automation. It is the foundation of general intelligence."
      },
      {
        type: "highlight",
        text: "We have spent years teaching AI to talk. Now we need to teach it to DO. Desktop control is how we bridge that gap."
      },
      {
        type: "section",
        title: "The Recursive Self-Improvement Accelerator",
        text: "Here is where it gets genuinely exciting: AI agents that can control computers can improve themselves. They can write code, test it, debug it, and deploy it. They can research new techniques, implement them, and evaluate the results. This creates a feedback loop that could accelerate AI development beyond what we have seen before."
      },
      {
        type: "section",
        title: "The Evidence Is Already Here",
        text: "Look at what is happening with tools like Coasty. AI agents are already writing entire applications, conducting research, and solving complex problems by controlling desktop environments. They are not just following instructions. They are exploring, learning, and adapting. Each interaction makes them more capable. Each task completed is training data for the next level of capability."
      },
      {
        type: "section",
        title: "The Convergence Point",
        text: "We are approaching a convergence of capabilities: vision models that can understand screens perfectly, language models that can plan complex tasks, and infrastructure that allows persistent, scalable computer control. When these fully converge, we will not just have better automation. We will have digital beings that can do anything a human can do on a computer, but faster, continuously, and at scale."
      },
      {
        type: "conclusion",
        text: "The path to AGI is not through bigger models or better benchmarks. It is through giving AI the same tools we use: screens, keyboards, and mice. The future is not about AI that can chat. It is about AI that can DO."
      }
    ]
  },
  {
    id: "coasty-reddit-marketing",
    title: "How Coasty Ran a Full Reddit Marketing Campaign Autonomously",
    excerpt: "We gave Coasty a single prompt: market our product on Reddit. It researched competitors, identified subreddits, crafted posts, and engaged with comments.",
    author: "Sarah Chen",
    date: "2026-03-04",
    readTime: "8 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "Marketing on Reddit is notoriously difficult. The community can smell promotional content from a mile away. So we gave Coasty the ultimate challenge: run a legitimate marketing campaign on Reddit without getting downvoted into oblivion."
      },
      {
        type: "section",
        title: "The Task",
        text: "We gave Coasty a single instruction: \"Market Coasty on Reddit autonomously.\" No templates, no target subreddits, no talking points. Just the product and a goal."
      },
      {
        type: "section",
        title: "What Coasty Did",
        bullets: [
          "Researched competitor presence across 40+ subreddits",
          "Identified communities where AI agent tools were being discussed",
          "Analyzed top-performing posts in each subreddit for tone and format",
          "Crafted original posts tailored to each community's culture",
          "Responded to comments with genuine, helpful answers",
          "Tracked engagement and adjusted strategy in real time"
        ]
      },
      {
        type: "highlight",
        text: "The posts were not flagged as spam. Comments were upvoted. Users asked follow-up questions. Coasty handled all of it."
      },
      {
        type: "section",
        title: "Results",
        text: "Over the course of a single session, Coasty created posts that generated genuine engagement. It navigated Reddit's complex social dynamics, adapted its messaging per subreddit, and maintained authentic conversations with real users. The entire campaign ran without any human intervention."
      },
      {
        type: "conclusion",
        text: "Reddit marketing requires cultural awareness, authenticity, and real-time adaptation. The fact that an AI agent handled all three suggests we are further along in autonomous marketing than most people realize."
      }
    ]
  },
  {
    id: "qa-testing-itself",
    title: "We Let Coasty QA Test Its Own Product. It Found 14 Bugs.",
    excerpt: "In a meta experiment, we pointed Coasty at its own checkout and onboarding flows. It navigated every path, filed detailed bug reports, and caught issues our team missed.",
    author: "Michael Rodriguez",
    date: "2026-03-03",
    readTime: "10 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "What happens when you ask an AI agent to QA test the product it runs on? We decided to find out. We pointed Coasty at coasty.ai and told it to find every bug it could."
      },
      {
        type: "section",
        title: "The Setup",
        text: "We gave Coasty access to a staging environment of its own product. The instruction was simple: test every user flow, document any issues, and report findings. No test scripts, no predefined paths, no hints about known issues."
      },
      {
        type: "section",
        title: "Bugs Found",
        bullets: [
          "A checkout flow that silently failed on certain payment methods",
          "An onboarding step that skipped validation on empty fields",
          "A mobile layout issue where buttons overlapped on smaller screens",
          "An API timeout that was not surfaced to the user",
          "A race condition in the chat message rendering",
          "Several accessibility issues with missing ARIA labels"
        ]
      },
      {
        type: "highlight",
        text: "Three of the 14 bugs were in production-critical flows that our human QA team had missed during the last release cycle."
      },
      {
        type: "section",
        title: "How It Tested",
        text: "Coasty systematically navigated every page, clicked every button, filled every form with valid and invalid data, tested edge cases like empty inputs and special characters, and checked responsive layouts across different viewport sizes. It documented each issue with screenshots, steps to reproduce, and expected vs. actual behavior."
      },
      {
        type: "conclusion",
        text: "AI-driven QA testing is not a replacement for human testers, but it is an incredibly effective first pass. Coasty found bugs in minutes that might have gone unnoticed for weeks."
      }
    ]
  },
  {
    id: "osworld-benchmark",
    title: "82% on OSWorld: What State-of-the-Art Computer Use Actually Means",
    excerpt: "Coasty achieved the highest score on the OSWorld benchmark for autonomous computer use. We break down how the benchmark works and what this result means for real-world tasks.",
    author: "Emily Watson",
    date: "2026-03-01",
    readTime: "12 min",
    category: "Research",
    content: [
      {
        type: "intro",
        text: "Benchmarks in AI are often criticized as disconnected from real-world performance. OSWorld is different. It measures whether an AI agent can actually complete tasks on a real operating system, using real applications, with real complexity."
      },
      {
        type: "section",
        title: "What is OSWorld?",
        text: "OSWorld is a benchmark that evaluates AI agents on their ability to complete real computer tasks. Tasks range from file management and web browsing to multi-application workflows that require planning, error recovery, and contextual understanding."
      },
      {
        type: "section",
        title: "Why 82% Matters",
        bullets: [
          "The previous state-of-the-art was significantly lower",
          "Human performance on the same benchmark averages around 90%",
          "The gap between AI and human computer operators is closing rapidly",
          "Performance scales with task complexity, not just simple operations",
          "Error recovery and adaptation contribute significantly to the score"
        ]
      },
      {
        type: "highlight",
        text: "At 82%, Coasty can reliably complete the majority of computer tasks that a human office worker performs daily."
      },
      {
        type: "section",
        title: "Beyond the Number",
        text: "What matters more than the score is the pattern of success. Coasty excels at multi-step workflows, recovers from unexpected errors, and adapts when applications behave differently than expected. These are the qualities that make an AI agent useful in production, not just on benchmarks."
      },
      {
        type: "conclusion",
        text: "Benchmarks are imperfect, but OSWorld measures something that matters: can an AI actually use a computer to get work done? At 82%, the answer is increasingly yes."
      }
    ]
  },
  {
    id: "prospecting-outreach",
    title: "From Zero to 200 Personalized Emails: Autonomous Sales Prospecting",
    excerpt: "Coasty found prospective customers, researched their companies, wrote personalized outreach emails, and sent them. Each email was unique, relevant, and human-sounding.",
    author: "David Park",
    date: "2026-02-28",
    readTime: "7 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "Sales prospecting is one of the most time-consuming tasks in any go-to-market motion. Finding leads, researching companies, crafting personalized messages, and sending them takes hours per batch. We gave Coasty the entire pipeline."
      },
      {
        type: "section",
        title: "The Workflow",
        bullets: [
          "Searched LinkedIn and company directories for matching prospects",
          "Researched each company's product, recent news, and tech stack",
          "Identified the right contact person at each company",
          "Wrote a personalized email referencing specific company details",
          "Sent emails through the user's email client",
          "Logged each outreach in a tracking spreadsheet"
        ]
      },
      {
        type: "highlight",
        text: "Every email was different. Coasty referenced specific products, recent blog posts, and company milestones. No templates, no mail merge."
      },
      {
        type: "section",
        title: "Quality Over Quantity",
        text: "The goal was not to blast generic emails. Each message demonstrated genuine understanding of the prospect's business and a clear reason for reaching out. Coasty spent 2-3 minutes per prospect on research before writing anything."
      },
      {
        type: "conclusion",
        text: "Autonomous prospecting is not about replacing the human touch. It is about giving every prospect the personalized attention they deserve, at a scale that no human team can match."
      }
    ]
  },
  {
    id: "yc-application",
    title: "Can an AI Fill Out the YC S26 Application? We Tried It.",
    excerpt: "The Y Combinator application is notoriously detailed. We gave Coasty our company info and asked it to fill the entire form. It navigated 30+ fields across multiple pages.",
    author: "Alex Thompson",
    date: "2026-02-26",
    readTime: "9 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "The Y Combinator application is a rite of passage for startups. It is long, detailed, and requires thoughtful answers about your team, product, market, and vision. We wondered: could Coasty fill it out?"
      },
      {
        type: "section",
        title: "The Challenge",
        text: "YC applications have 30+ fields across multiple pages. Some require short answers, others need detailed essays. The form includes dropdowns, radio buttons, text areas, and file uploads. It is not a simple form."
      },
      {
        type: "section",
        title: "What Coasty Did",
        bullets: [
          "Navigated to the YC application page and started filling fields",
          "Used company context to write relevant answers for each question",
          "Handled different input types: text fields, dropdowns, radio buttons",
          "Wrote thoughtful essay responses for open-ended questions",
          "Reviewed and revised answers before moving to the next section",
          "Completed the entire application in a single session"
        ]
      },
      {
        type: "highlight",
        text: "Coasty completed the full YC application in under 20 minutes. A human typically spends 4-8 hours on the same form."
      },
      {
        type: "conclusion",
        text: "Form filling sounds simple, but complex applications like YC require contextual understanding, strategic thinking, and the ability to navigate unpredictable form layouts. Coasty handled all of it."
      }
    ]
  },
  {
    id: "job-application-agent",
    title: "Coasty Applied to 50 Jobs in One Afternoon",
    excerpt: "We tasked Coasty with finding matching software engineering roles, tailoring a resume for each, and submitting applications. It handled job boards, cover letters, and form variations.",
    author: "Rachel Kim",
    date: "2026-02-24",
    readTime: "8 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "Job applications are repetitive, time-consuming, and soul-crushing. Every company has a different application portal, different required fields, and different formatting expectations. We asked Coasty to handle the entire process."
      },
      {
        type: "section",
        title: "The Process",
        bullets: [
          "Searched multiple job boards for matching roles based on skills and preferences",
          "Evaluated each posting for relevance and fit",
          "Tailored the resume to highlight relevant experience for each role",
          "Wrote custom cover letters referencing specific job requirements",
          "Navigated each company's unique application portal",
          "Filled out all required fields and uploaded documents"
        ]
      },
      {
        type: "section",
        title: "Handling Variety",
        text: "No two application portals are the same. Some use Greenhouse, others use Lever, others have custom forms. Coasty adapted to each one, figured out the required fields, handled different upload mechanisms, and completed every application successfully."
      },
      {
        type: "conclusion",
        text: "Job hunting should not take months of tedious form-filling. With an AI agent handling the mechanical parts, candidates can focus on interview prep and networking."
      }
    ]
  },
  {
    id: "hacker-news-engagement",
    title: "Writing and Posting on Hacker News, Autonomously",
    excerpt: "Coasty drafted a blog post, submitted it to Hacker News, and engaged with comments in real time. We watched the entire session unfold.",
    author: "James Liu",
    date: "2026-02-22",
    readTime: "6 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "Hacker News is one of the most discerning tech communities on the internet. Posts are judged harshly, and low-effort content gets flagged immediately. We asked Coasty to write something worth reading and post it."
      },
      {
        type: "section",
        title: "What Happened",
        bullets: [
          "Coasty researched trending topics on HN to find a relevant angle",
          "Drafted a technical blog post with original insights",
          "Submitted the post with an appropriate title",
          "Monitored the comments section as responses came in",
          "Replied to technical questions with accurate, detailed answers",
          "Engaged in constructive discussion with community members"
        ]
      },
      {
        type: "highlight",
        text: "The post was not flagged or downvoted. Comments were substantive. The engagement was genuine."
      },
      {
        type: "conclusion",
        text: "Social media engagement requires reading the room, understanding community norms, and contributing value. Coasty demonstrated all three in one of the internet's toughest crowds."
      }
    ]
  },
  {
    id: "multi-model-orchestration",
    title: "Why We Use Multiple AI Models Instead of One",
    excerpt: "Different models excel at different tasks. Our multi-model orchestration routes browser tasks, reasoning, and code generation to the best-suited model in real time.",
    author: "Emily Watson",
    date: "2026-02-20",
    readTime: "11 min",
    category: "Engineering",
    content: [
      {
        type: "intro",
        text: "Most AI products pick a single model and build everything around it. We took a different approach. Coasty routes different types of work to different models based on what each does best."
      },
      {
        type: "section",
        title: "The Problem with Single-Model Architectures",
        text: "No single model is the best at everything. Some excel at creative writing, others at code generation, others at visual understanding. A single-model approach means you are always compromising on something."
      },
      {
        type: "section",
        title: "How Multi-Model Orchestration Works",
        bullets: [
          "Task analysis determines the type of work needed",
          "Browser navigation and visual tasks route to vision-capable models",
          "Complex reasoning and planning use models optimized for chain-of-thought",
          "Code generation routes to models with strong programming benchmarks",
          "Each model receives context tailored to its strengths",
          "Results are synthesized into a coherent workflow"
        ]
      },
      {
        type: "highlight",
        text: "Multi-model orchestration increased task completion rates by 35% compared to using any single model alone."
      },
      {
        type: "conclusion",
        text: "The future of AI applications is not about picking the best model. It is about building systems that use the right model for each moment."
      }
    ]
  },
  {
    id: "electron-local-agent",
    title: "Introducing Coasty Desktop: AI That Controls Your Local Machine",
    excerpt: "Our new Electron app runs as a floating overlay and executes agent commands directly on your computer. No VMs, no latency.",
    author: "Michael Rodriguez",
    date: "2026-02-18",
    readTime: "7 min",
    category: "Product",
    content: [
      {
        type: "intro",
        text: "Until now, Coasty agents ran inside cloud VMs. That works great for many use cases, but some tasks need to happen on your actual machine: your browser sessions, your local files, your installed apps. That is why we built Coasty Desktop."
      },
      {
        type: "section",
        title: "How It Works",
        bullets: [
          "A lightweight Electron app runs as a floating overlay on your desktop",
          "Agent commands execute directly on your machine via secure IPC",
          "Browser automation uses your installed Chrome, Edge, or Brave",
          "File operations work with your local filesystem",
          "Desktop automation handles mouse, keyboard, and window management",
          "All communication is encrypted and authenticated"
        ]
      },
      {
        type: "section",
        title: "Why Local Matters",
        text: "Cloud VMs are great for isolated tasks, but many real workflows need access to your logged-in sessions, local credentials, and installed tools. Coasty Desktop bridges that gap while maintaining security through sandboxed execution and permission controls."
      },
      {
        type: "conclusion",
        text: "Coasty Desktop brings the full power of autonomous AI agents to your local machine. Same intelligence, zero latency, your environment."
      }
    ]
  },
  {
    id: "browser-agent-architecture",
    title: "How Our Browser Agent Thinks Before It Clicks",
    excerpt: "A deep dive into the search-first strategy our browser agent uses. It researches via Google before opening any page, minimizes tab sprawl, and validates every action.",
    author: "Rachel Kim",
    date: "2026-02-15",
    readTime: "13 min",
    category: "Engineering",
    content: [
      {
        type: "intro",
        text: "Most browser automation tools navigate directly to URLs and start clicking. Our browser agent takes a fundamentally different approach: it thinks first, searches second, and clicks last."
      },
      {
        type: "section",
        title: "The Search-First Strategy",
        text: "Before opening any webpage, the browser agent searches Google to understand the landscape. This avoids navigating to the wrong page, reduces unnecessary page loads, and gives the agent context about what it will find before it gets there."
      },
      {
        type: "section",
        title: "Key Design Principles",
        bullets: [
          "Always search before navigating to gather context",
          "Only open the browser when an action is required (forms, clicks, purchases)",
          "Validate every action with a state check before proceeding",
          "Reuse tabs instead of opening new ones",
          "Take screenshots after key actions to verify results",
          "Plan multi-step sequences before executing them"
        ]
      },
      {
        type: "highlight",
        text: "The search-first approach reduced failed navigation attempts by 70% and cut average task completion time by 40%."
      },
      {
        type: "conclusion",
        text: "Browser automation is not about clicking fast. It is about clicking smart. The search-first strategy ensures every action is informed and intentional."
      }
    ]
  },
  {
    id: "email-automation-case",
    title: "Sending Emails You Would Actually Send: AI-Written Outreach That Works",
    excerpt: "Coasty composed, reviewed, and sent a real email on behalf of a user. It pulled context from previous conversations, matched the user's tone, and hit send.",
    author: "Sarah Chen",
    date: "2026-02-13",
    readTime: "6 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "AI-written emails have a reputation for sounding robotic. We set out to prove that an agent could write and send emails that are indistinguishable from ones written by the actual user."
      },
      {
        type: "section",
        title: "The Approach",
        text: "Coasty analyzed previous emails from the user to understand their writing style, common phrases, sign-off preferences, and tone. It then composed a new email that matched these patterns while addressing the specific context of the outreach."
      },
      {
        type: "highlight",
        text: "Recipients could not tell the email was AI-written. The response rate was comparable to manually written outreach."
      },
      {
        type: "conclusion",
        text: "The goal is not to replace personal communication. It is to handle the volume of outreach that no individual has time for, while maintaining the quality that makes each message effective."
      }
    ]
  },
  {
    id: "sandboxed-execution",
    title: "How We Run AI-Generated Code Safely in Docker Containers",
    excerpt: "Every agent session runs inside an isolated container with resource limits, network controls, and automatic teardown.",
    author: "Alex Thompson",
    date: "2026-02-10",
    readTime: "10 min",
    category: "Engineering",
    content: [
      {
        type: "intro",
        text: "Running AI-generated code is inherently risky. The agent might install packages, modify files, or make network requests that were not intended. Our sandboxing architecture ensures that none of this can cause lasting damage."
      },
      {
        type: "section",
        title: "Security Layers",
        bullets: [
          "Docker containerization for complete process isolation",
          "Resource limits on CPU, memory, and disk usage",
          "Network isolation with allowlisted domains only",
          "Automatic session termination after timeout",
          "No persistent storage between sessions",
          "Read-only filesystem for system directories"
        ]
      },
      {
        type: "section",
        title: "The Architecture",
        text: "Each agent session spins up a fresh Ubuntu container with a full desktop environment. The agent has root access inside the container but cannot escape it. When the session ends, the container is destroyed. Nothing persists unless explicitly exported by the user."
      },
      {
        type: "conclusion",
        text: "Security does not have to limit functionality. With proper isolation, AI agents can run code, install packages, and modify files freely, all within a boundary that protects the host system."
      }
    ]
  },
  {
    id: "ai-employee-economics",
    title: "The Economics of an AI Employee vs. a Human Hire",
    excerpt: "An AI agent costs a fraction of a full-time hire and works around the clock. We break down the real numbers across marketing, QA, outreach, and support roles.",
    author: "David Park",
    date: "2026-02-08",
    readTime: "9 min",
    category: "Industry",
    content: [
      {
        type: "intro",
        text: "Hiring a full-time employee for marketing, QA, outreach, or support costs anywhere from $40,000 to $120,000 per year, plus benefits, equipment, and management overhead. An AI agent that handles the same tasks costs a fraction of that."
      },
      {
        type: "section",
        title: "The Numbers",
        bullets: [
          "Marketing coordinator: $55K/year vs. AI agent at a fraction of the cost per month",
          "QA tester: $70K/year vs. AI agent running continuous tests",
          "SDR/outreach: $65K/year vs. AI agent doing personalized prospecting",
          "Support agent: $45K/year vs. AI resolving tickets autonomously",
          "AI agents work 24/7 with no PTO, no ramp-up time, no turnover"
        ]
      },
      {
        type: "highlight",
        text: "The question is not whether AI employees are cheaper. It is whether the savings allow you to invest in the uniquely human work that actually grows your business."
      },
      {
        type: "conclusion",
        text: "AI employees are not about cutting headcount. They are about multiplying capacity. The companies that win will use AI agents to handle volume while their human team focuses on strategy and creativity."
      }
    ]
  },
  {
    id: "customer-support-agent",
    title: "Resolving Support Tickets Without Human Intervention",
    excerpt: "Coasty looked up customer accounts, diagnosed issues, wrote replies, and resolved tickets end-to-end.",
    author: "Lisa Chen",
    date: "2026-02-05",
    readTime: "8 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "Customer support at scale is expensive and slow. Most tickets follow predictable patterns: account issues, billing questions, feature requests, bug reports. We tested whether Coasty could handle these autonomously."
      },
      {
        type: "section",
        title: "The Pilot",
        text: "We gave Coasty access to a real support queue with 50 tickets. It had access to the support dashboard, customer database, and internal documentation. The instruction was simple: resolve as many tickets as possible."
      },
      {
        type: "section",
        title: "Results",
        bullets: [
          "38 of 50 tickets resolved without human intervention",
          "Average resolution time: 4 minutes per ticket",
          "Customer satisfaction scores matched human agent averages",
          "12 tickets correctly escalated to human agents for complex issues",
          "Zero incorrect account modifications or billing changes"
        ]
      },
      {
        type: "conclusion",
        text: "AI-powered support is not about removing the human element. It is about ensuring that human agents spend their time on the complex, nuanced issues where they add the most value."
      }
    ]
  },
  {
    id: "byok-philosophy",
    title: "Bring Your Own Keys: Why We Believe in User Control",
    excerpt: "Your API keys, your control. BYOK is not just about cost. It ensures complete transparency and the freedom to switch providers.",
    author: "Lisa Chen",
    date: "2026-02-03",
    readTime: "6 min",
    category: "Product",
    content: [
      {
        type: "intro",
        text: "Most AI platforms act as middlemen between you and the model providers. They markup API costs, limit your model choices, and lock you into their ecosystem. We think that is wrong."
      },
      {
        type: "section",
        title: "Why BYOK Matters",
        bullets: [
          "Direct relationship with AI providers, no markup",
          "Complete control over usage and costs",
          "No middleman reading your AI interactions",
          "Freedom to switch providers at any time",
          "Use enterprise agreements and volume discounts you already have"
        ]
      },
      {
        type: "highlight",
        text: "Your data, your keys, your choice. That is not a feature. It is a principle."
      },
      {
        type: "conclusion",
        text: "BYOK is about trust. When you bring your own keys, you know exactly where your data goes, what it costs, and who has access. That transparency is the foundation of a healthy AI ecosystem."
      }
    ]
  },
  {
    id: "linkedin-recruiting",
    title: "Sourcing Candidates on LinkedIn and Scheduling Calls, Autonomously",
    excerpt: "We asked Coasty to find senior engineers on LinkedIn, send personalized connection requests, and schedule introductory calls.",
    author: "James Liu",
    date: "2026-02-01",
    readTime: "7 min",
    category: "Case Study",
    content: [
      {
        type: "intro",
        text: "Recruiting is a pipeline problem. Finding candidates, reaching out, and scheduling calls takes hours per candidate. We asked Coasty to handle the entire top-of-funnel."
      },
      {
        type: "section",
        title: "The Workflow",
        bullets: [
          "Searched LinkedIn for candidates matching specific criteria",
          "Reviewed profiles for relevant experience and culture fit",
          "Sent personalized connection requests with tailored messages",
          "Followed up with candidates who accepted connections",
          "Proposed meeting times and handled scheduling logistics",
          "Updated the recruiting tracker with status for each candidate"
        ]
      },
      {
        type: "section",
        title: "Personalization at Scale",
        text: "Each outreach message referenced the candidate's specific experience, recent projects, or publications. Coasty spent time reading profiles thoroughly before crafting messages, ensuring each one felt personal rather than templated."
      },
      {
        type: "conclusion",
        text: "The hardest part of recruiting is the volume of manual work in the sourcing phase. AI agents can handle that volume while maintaining the personalization that attracts top talent."
      }
    ]
  },
  {
    id: "prompt-caching-tokens",
    title: "Cutting Token Costs 60% with Prompt Caching",
    excerpt: "Agent sessions are token-heavy. We implemented prompt caching across multi-turn conversations to dramatically reduce costs without sacrificing context quality.",
    author: "Michael Rodriguez",
    date: "2026-01-28",
    readTime: "8 min",
    category: "Engineering",
    content: [
      {
        type: "intro",
        text: "AI agent sessions are expensive. Each action requires sending the full conversation context to the model, and sessions can run for dozens of turns. Without optimization, token costs add up fast."
      },
      {
        type: "section",
        title: "The Problem",
        text: "A typical agent session involves 20-50 model calls. Each call sends the system prompt, conversation history, tool definitions, and previous results. By the end of a session, you are sending thousands of tokens of repeated context with every request."
      },
      {
        type: "section",
        title: "Our Solution",
        bullets: [
          "Prompt caching stores system prompts and tool definitions across calls",
          "Conversation history is compressed at checkpoints",
          "Previous tool results are summarized rather than sent in full",
          "Static context is cached at the provider level",
          "Dynamic context is incrementally updated rather than rebuilt"
        ]
      },
      {
        type: "highlight",
        text: "Prompt caching reduced average session cost by 60% while maintaining identical task completion rates."
      },
      {
        type: "conclusion",
        text: "Making AI agents economically viable requires aggressive optimization at the infrastructure level. Prompt caching is one of the highest-impact techniques available."
      }
    ]
  },
  {
    id: "future-ai-agents",
    title: "The Future of AI Agents: Predictions for the Next 12 Months",
    excerpt: "From month-long autonomous projects to cross-application workflows without APIs, here is what we expect to see in the AI agent space.",
    author: "Marcus Sterling",
    date: "2026-01-25",
    readTime: "5 min",
    category: "Industry",
    content: [
      {
        type: "intro",
        text: "The AI agent space is evolving faster than any other area of AI. Here are our predictions for what will happen in the next 12 months."
      },
      {
        type: "section",
        title: "What is Coming",
        bullets: [
          "Agents that can plan and execute week-long projects autonomously",
          "Cross-application automation without requiring APIs or integrations",
          "Natural language to production deployment pipelines",
          "AI agents that train and improve other AI agents",
          "Autonomous research and report generation at publication quality",
          "Multi-agent teams that coordinate on complex workflows"
        ]
      },
      {
        type: "highlight",
        text: "The biggest shift will not be in what agents can do, but in how much we trust them to do it without supervision."
      },
      {
        type: "conclusion",
        text: "We are moving from agents that assist to agents that execute. The next 12 months will determine which companies lead this transition and which ones get left behind."
      }
    ]
  },
  {
    id: "open-source-movement",
    title: "Open Source AI Models and Why They Matter for Agents",
    excerpt: "Open-source models bring transparency, customization, and privacy. We explore how they fit into the agent ecosystem alongside proprietary models.",
    author: "Alex Thompson",
    date: "2026-01-20",
    readTime: "9 min",
    category: "Industry",
    content: [
      {
        type: "intro",
        text: "The open-source AI movement is not just about free software. It is about ensuring AI technology remains accessible, transparent, and adaptable to specific needs."
      },
      {
        type: "section",
        title: "Why Open Source Matters for Agents",
        bullets: [
          "Transparency in how the agent makes decisions",
          "Community-driven improvements and bug fixes",
          "No vendor lock-in to a single provider",
          "Privacy through local deployment options",
          "Customization and fine-tuning for specific workflows",
          "Cost control through self-hosted inference"
        ]
      },
      {
        type: "section",
        title: "The Hybrid Approach",
        text: "We do not believe in open-source vs. proprietary. The best agent systems use both. Proprietary models handle tasks that require frontier capabilities, while open-source models handle high-volume, latency-sensitive operations where self-hosting makes economic sense."
      },
      {
        type: "conclusion",
        text: "The future of AI agents is hybrid: the best proprietary models for peak performance, the best open-source models for flexibility and control. Users deserve the choice."
      }
    ]
  },
]

export default function BlogPostPage() {
  const params = useParams()
  const post = blogPosts.find(p => p.id === params.id)

  if (!post) {
    notFound()
  }

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main className="pt-32 sm:pt-36 pb-24">
        {/* Back link */}
        <div className="max-w-3xl mx-auto px-5 sm:px-6 mb-10">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/50 hover:text-foreground transition-colors duration-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Blog
            </Link>
          </motion.div>
        </div>

        {/* Article header */}
        <div className="max-w-3xl mx-auto px-5 sm:px-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40 mb-4 block">
              {post.category}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight leading-[1.12] mb-6">
              {post.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground/50">
              <span>{post.author}</span>
              <span className="text-muted-foreground/20">|</span>
              <span>{formatDate(post.date)}</span>
              <span className="text-muted-foreground/20">|</span>
              <span>{post.readTime}</span>
            </div>
          </motion.div>
        </div>

        {/* Divider */}
        <div className="max-w-3xl mx-auto px-5 sm:px-6 mb-12">
          <div className="border-t border-border/30" />
        </div>

        {/* Article content */}
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="space-y-8"
          >
            {post.content.map((block, idx) => {
              if (block.type === "intro") {
                return (
                  <p key={idx} className="text-lg sm:text-xl text-muted-foreground leading-relaxed">
                    {block.text}
                  </p>
                )
              }
              if (block.type === "section") {
                return (
                  <div key={idx} className="space-y-4">
                    {block.title && (
                      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                        {block.title}
                      </h2>
                    )}
                    {block.text && (
                      <p className="text-muted-foreground leading-relaxed">
                        {block.text}
                      </p>
                    )}
                    {block.bullets && (
                      <ul className="space-y-2.5 pl-1">
                        {block.bullets.map((bullet, bIdx) => (
                          <li key={bIdx} className="flex items-start gap-3 text-muted-foreground leading-relaxed">
                            <span className="text-muted-foreground/30 mt-1.5 text-xs">&#9679;</span>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              }
              if (block.type === "highlight") {
                return (
                  <div
                    key={idx}
                    className="border-l-2 border-foreground/20 pl-6 py-1"
                  >
                    <p className="text-foreground font-medium text-lg leading-relaxed">
                      {block.text}
                    </p>
                  </div>
                )
              }
              if (block.type === "conclusion") {
                return (
                  <div key={idx} className="pt-4 border-t border-border/20">
                    <p className="text-muted-foreground leading-relaxed italic">
                      {block.text}
                    </p>
                  </div>
                )
              }
              return null
            })}
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <div className="max-w-3xl mx-auto px-5 sm:px-6 mt-20">
          <div className="border-t border-border/30 pt-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div>
                <p className="text-sm text-muted-foreground/60 mb-1">Want to see this in action?</p>
                <Link
                  href="/results"
                  className="text-sm text-foreground/70 hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  View Case Studies <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <Link href="/auth">
                <motion.button
                  className="inline-flex items-center gap-2.5 rounded-full font-semibold text-background bg-foreground px-7 py-3 text-sm cursor-pointer"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Coasty Free
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
