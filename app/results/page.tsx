"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { ArrowRight, ArrowUpRight } from "lucide-react"
import { motion } from "framer-motion"

const videos = [
  { label: "Marketing", task: "Market your product on Reddit autonomously", videoId: "icxgLDephHE" },
  { label: "Go-to-Market", task: "Find prospects and send them a personalized email", videoId: "qTvmGfg3HVw" },
  { label: "QA Testing", task: "Test every checkout flow and report bugs", videoId: "Wbo2o74hVIo" },
  { label: "Job Application", task: "Find roles, tailor your resume, and apply", videoId: "mH-csaCa508" },
  { label: "Form Filling", task: "Fill out the YC S26 application for you", videoId: "AnHJuRMLCnE" },
  { label: "Social Media", task: "Post on Hacker News and engage with comments", videoId: "A_OvNh51Npg" },
]

const sessions = [
  {
    title: "Coasty on Reddit",
    chatId: "373c1f67-afec-4bd6-adda-3809ecdbdd75",
    description: "Autonomously run a marketing campaign, researching competitors, analyzing trends, and building a strategy.",
    tag: "Marketing",
  },
  {
    title: "Finding Prospective Customers",
    chatId: "425d3c49-3a06-41e5-9859-aa00c5b12f3d",
    description: "Find and research prospective customers, gathering key details to craft personalized outreach.",
    tag: "Go-to-Market",
  },
  {
    title: "QA Testing Itself",
    chatId: "7ee3e942-c5dd-4e49-93b6-353bb5273b7e",
    description: "Run quality assurance on its own product, navigating flows, catching bugs, and reporting issues.",
    tag: "QA Testing",
  },
  {
    title: "Sending an Email",
    chatId: "60a0722b-fb98-43d6-a4e7-951d80a22363",
    description: "Draft and deliver an email entirely on its own, from composing to hitting send.",
    tag: "Communication",
  },
  {
    title: "Applying to a Job",
    chatId: "4ac6f3d2-c273-4a07-bf98-b986d1cbfb88",
    description: "Find a matching role, tailor your resume, and submit the application autonomously.",
    tag: "Job Application",
  },
  {
    title: "Posting on Hacker News",
    chatId: "d181de46-b41d-4b87-9648-0374b2b7ec1c",
    description: "Create and publish a blog post on Hacker News, writing the content and submitting it.",
    tag: "Social Media",
  },
]

const fade = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.06, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
}

export default function ResultsPage() {
  const [featured, ...rest] = videos

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />

      <main className="pt-32 sm:pt-36 pb-24">
        {/* ── Header ── */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6 mb-20">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/50 mb-4"
          >
            Case Studies
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-5"
          >
            Real work.{" "}
            <span className="text-muted-foreground/40">Not demos.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-muted-foreground text-lg sm:text-xl max-w-xl leading-relaxed"
          >
            Every session below is unscripted. Coasty was given a task and completed it autonomously.browse, click, type, think.
          </motion.p>
        </div>

        {/* ── Featured Video ── */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="rounded-2xl overflow-hidden border border-border/40 bg-card shadow-sm">
              <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
                <iframe
                  loading="lazy"
                  className="absolute inset-0 w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${featured.videoId}?rel=0&modestbranding=1&showinfo=0`}
                  title={`Coasty ${featured.label} Demo`}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  style={{ border: "none" }}
                />
              </div>
              <div className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">
                    {featured.label}
                  </span>
                  <p className="text-foreground font-medium mt-0.5">{featured.task}</p>
                </div>
                <span className="hidden sm:block text-[11px] text-muted-foreground/30 font-medium">
                  Featured
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Video Grid ── */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6 mb-28">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {rest.map((v, i) => (
              <motion.div
                key={v.videoId + v.label}
                custom={i}
                initial="hidden"
                animate="show"
                variants={fade}
              >
                <div className="h-full rounded-xl overflow-hidden border border-border/30 bg-card hover:border-border/60 transition-colors duration-300 flex flex-col">
                  <div className="relative w-full bg-black" style={{ paddingTop: "56.25%" }}>
                    <iframe
                      loading="lazy"
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube-nocookie.com/embed/${v.videoId}?rel=0&modestbranding=1&showinfo=0`}
                      title={`Coasty ${v.label} Demo`}
                      allowFullScreen
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      style={{ border: "none" }}
                    />
                  </div>
                  <div className="px-4 py-3 flex-1 flex flex-col justify-center">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">
                      {v.label}
                    </span>
                    <p className="text-sm text-foreground/80 mt-0.5 line-clamp-2">{v.task}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <div className="border-t border-border/30" />
        </div>

        {/* ── Sessions ── */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6 mt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-12"
          >
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground/50 mb-4">
              Agent Transcripts
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Full session logs
            </h2>
            <p className="text-muted-foreground max-w-lg">
              Read every step the agent took.every click, every decision, every result. Nothing hidden.
            </p>
          </motion.div>

          <div className="space-y-0">
            {sessions.map((s, i) => (
              <motion.div
                key={s.chatId}
                custom={i}
                initial="hidden"
                animate="show"
                variants={fade}
              >
                <Link
                  href={`/share/${s.chatId}`}
                  target="_blank"
                  className="group flex items-start sm:items-center gap-4 sm:gap-6 py-5 sm:py-6 border-b border-border/20 hover:border-border/40 transition-colors duration-300"
                >
                  {/* Number */}
                  <span className="text-2xl sm:text-3xl font-bold text-muted-foreground/15 tabular-nums leading-none pt-0.5 sm:pt-0 w-8 sm:w-10 shrink-0 text-right">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
                        {s.tag}
                      </span>
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-foreground/70 transition-colors duration-200 mb-0.5">
                      {s.title}
                    </h3>
                    <p className="text-sm text-muted-foreground/70 leading-relaxed hidden sm:block">
                      {s.description}
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-foreground/50 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 shrink-0 mt-1 sm:mt-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-24 sm:mt-28 text-center"
          >
            <p className="text-muted-foreground/60 text-sm mb-6">
              Seen enough?
            </p>
            <Link href="/auth">
              <motion.button
                className="inline-flex items-center gap-2.5 rounded-full font-semibold text-background bg-foreground px-8 py-3.5 text-[15px] cursor-pointer"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                Try Coasty Free
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </Link>
            <p className="text-[11px] text-muted-foreground/30 mt-4">
              No credit card required
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  )
}
