"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SparklesCore } from "@/components/ui/sparkles"
import { ArrowLeft, BookOpen, Calendar, Clock, User, Tag, TrendingUp, Zap, Brain, Rocket, Target, FileText, Users, Globe, Code, Heart, Star, ChevronRight, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { LandingHeader } from "@/app/components/landing/landing-header"
import { motion, AnimatePresence } from "framer-motion"

const blogPosts = [
  {
    id: "desktop-control-agi",
    title: "The Controversial Truth: Why AI Agents Controlling Desktops Are Our Fastest Path to AGI",
    excerpt: "Forget chat interfaces and API calls. The real breakthrough in artificial general intelligence is happening through AI agents that can see, click, and control computers exactly like humans do, and it's closer than you think.",
    author: "Marcus Sterling",
    date: "2025-01-20",
    readTime: "15 min read",
    category: "AGI Research",
    tags: ["AGI", "Desktop Control", "Controversial", "Future"],
    featured: true,
    icon: Brain,
    content: [
      {
        type: "intro",
        text: "Here's a controversial opinion that will make Silicon Valley uncomfortable: We're approaching AGI all wrong. While billions pour into making larger language models, the real path to artificial general intelligence is staring us in the face: it's through AI agents that can control computers like humans do."
      },
      {
        type: "highlight",
        text: "The ability to control a desktop environment isn't just another feature; it's the missing link between narrow AI and AGI."
      },
      {
        type: "section",
        title: "Why Desktop Control Changes Everything",
        text: "Think about it: Human intelligence didn't evolve in isolation. It evolved through interaction with tools and environments. Our cognitive abilities are fundamentally tied to our ability to manipulate our surroundings. When we give AI agents the same capability (the ability to see screens, move mice, type on keyboards, and interact with any software) we're not just adding features. We're fundamentally changing what AI can become."
      },
      {
        type: "section",
        title: "The Embodiment Hypothesis Nobody Talks About",
        text: "Robotics researchers have long argued that intelligence requires embodiment—a physical presence in the world. But they've been thinking too literally. A desktop environment IS embodiment. It's a standardized, universal interface to the digital world where most human knowledge work happens. An AI that can navigate this environment has a form of digital embodiment that's arguably more powerful than a physical robot."
      },
      {
        type: "section",
        title: "The Uncomfortable Truth About Current AI Limitations",
        bullets: [
          "Chat interfaces force AI into an unnatural communication bottleneck",
          "API-based integrations limit AI to predefined pathways",
          "Current AI can't learn through exploration and experimentation",
          "We've created incredibly smart systems that are functionally helpless",
          "The gap between knowing and doing remains unbridged"
        ]
      },
      {
        type: "section",
        title: "Real AGI Requires Real-World Interaction",
        text: "When an AI agent can control a desktop, it gains something crucial: the ability to learn through trial and error in a complex environment. It can debug its own code by actually running it. It can verify its answers by checking multiple sources. It can learn new tools without being explicitly programmed. This isn't just automation; it's the foundation of general intelligence."
      },
      {
        type: "highlight",
        text: "We've spent years teaching AI to talk. Now we need to teach it to DO. Desktop control is how we bridge that gap."
      },
      {
        type: "section",
        title: "The Recursive Self-Improvement Accelerator",
        text: "Here's where it gets genuinely scary (or exciting, depending on your perspective): AI agents that can control computers can improve themselves. They can write code, test it, debug it, and deploy it. They can research new techniques, implement them, and evaluate the results. This creates a feedback loop that could accelerate AI development beyond human comprehension."
      },
      {
        type: "section",
        title: "Why This Makes People Uncomfortable",
        bullets: [
          "It bypasses all our carefully designed AI safety measures",
          "It gives AI agency in a way that chat interfaces never could",
          "It threatens job security at every level of knowledge work",
          "It could lead to AI systems we genuinely can't control",
          "It makes the timeline to AGI uncomfortably short"
        ]
      },
      {
        type: "section",
        title: "The Evidence Is Already Here",
        text: "Look at what's happening with tools like LLMHub's virtual machines. AI agents are already writing entire applications, conducting research, and solving complex problems by controlling desktop environments. They're not just following instructions; they're exploring, learning, and adapting. Each interaction makes them more capable. Each task completed is training data for the next level of capability."
      },
      {
        type: "section",
        title: "The Convergence Point",
        text: "We're approaching a convergence of capabilities: vision models that can understand screens perfectly, language models that can plan complex tasks, and infrastructure that allows persistent, scalable computer control. When these fully converge (which could happen within 18 months) we won't just have better automation. We'll have digital beings that can do anything a human can do on a computer, but faster, continuously, and at scale."
      },
      {
        type: "highlight",
        text: "The company that first achieves reliable, general-purpose desktop control by AI won't just win the market; they'll fundamentally change what it means to be human."
      },
      {
        type: "section",
        title: "The Philosophical Implications We're Ignoring",
        text: "If intelligence is defined by the ability to achieve goals in complex environments, then AI agents controlling computers are already intelligent in ways we haven't fully acknowledged. They navigate information spaces, use tools, solve problems, and achieve objectives. The only question is: at what point do we admit that this IS general intelligence?"
      },
      {
        type: "section",
        title: "Why I'm Building This Future (Despite the Risks)",
        text: "Yes, this path to AGI is risky. Yes, it could lead to outcomes we can't control. But it's also inevitable. Someone will build this. The question is whether it's built thoughtfully, with safety measures and ethical considerations, or whether it emerges chaotically from a dozen different directions at once."
      },
      {
        type: "section",
        title: "The Timeline Nobody Wants to Admit",
        bullets: [
          "2024: Basic desktop control achieved (we are here)",
          "2025: Reliable multi-application workflows",
          "2026: Self-improving AI agents using desktop environments",
          "2027: AI agents that surpass human computer operators",
          "2028: The singularity isn't coming; it's typing"
        ]
      },
      {
        type: "conclusion",
        text: "The path to AGI isn't through bigger models or better benchmarks. It's through giving AI the same tools we use—screens, keyboards, and mice. The future isn't about AI that can chat. It's about AI that can DO. And whether we're ready or not, that future is already compiling on a virtual machine somewhere, one click at a time. The question isn't if this will happen, but whether we're brave enough to acknowledge what we're really building."
      }
    ]
  },
  {
    id: "ai-employee-revolution",
    title: "The AI Employee Revolution: How LLMHub is Changing Work",
    excerpt: "Discover how AI employees are transforming the workplace by collaborating seamlessly with human teams, automating complex tasks, and enhancing productivity across organizations.",
    author: "Sarah Chen",
    date: "2025-01-15",
    readTime: "8 min read",
    category: "AI Future",
    tags: ["AI", "Future of Work", "Automation"],
    featured: false,
    icon: Rocket,
    content: [
      {
        type: "intro",
        text: "The workplace is undergoing a fundamental transformation. AI employees are no longer a futuristic concept; they're here, working alongside human teams, and revolutionizing how we approach work."
      },
      {
        type: "section",
        title: "The Rise of AI Collaboration",
        text: "Unlike traditional automation tools, AI employees like those powered by LLMHub don't just execute predefined tasks. They understand context, learn from interactions, and adapt to your team's unique workflows. This represents a paradigm shift from automation to true collaboration."
      },
      {
        type: "highlight",
        text: "Companies using AI employees report 3x productivity gains and 60% reduction in repetitive task time."
      },
      {
        type: "section",
        title: "Real-World Impact",
        bullets: [
          "Engineering teams using AI for code reviews and debugging",
          "Marketing departments automating content creation and SEO optimization",
          "Customer support scaling personalized responses without losing quality",
          "Research teams accelerating data analysis and report generation"
        ]
      },
      {
        type: "conclusion",
        text: "The future of work isn't about replacing humans; it's about augmenting human capabilities with AI employees that handle routine tasks, freeing us to focus on creativity, strategy, and innovation."
      }
    ]
  },
  {
    id: "virtual-machines-ai-agents",
    title: "Virtual Machines Meet AI: The Perfect Development Environment",
    excerpt: "Learn how LLMHub's AI-controlled virtual machines are creating the ultimate development environment where AI agents can write, test, and deploy code autonomously.",
    author: "Michael Rodriguez",
    date: "2025-01-10",
    readTime: "10 min read",
    category: "Technology",
    tags: ["Virtual Machines", "Development", "AI Agents"],
    icon: Globe,
    content: [
      {
        type: "intro",
        text: "Imagine having an AI assistant that doesn't just suggest code; it can actually write, run, test, and deploy it in a real development environment. That's the power of AI-controlled virtual machines."
      },
      {
        type: "section",
        title: "Beyond Traditional IDEs",
        text: "Traditional development environments limit AI to suggestions and completions. With LLMHub's virtual machines, AI agents have full control over a complete development environment, enabling them to perform complex, multi-step development tasks autonomously."
      },
      {
        type: "section",
        title: "Key Capabilities",
        bullets: [
          "Full desktop control through AI agents",
          "Automated testing and debugging in isolated environments",
          "Cross-platform development without local setup",
          "Collaborative coding with AI and human developers",
          "Instant environment provisioning and teardown"
        ]
      },
      {
        type: "conclusion",
        text: "The combination of AI and virtual machines isn't just an incremental improvement; it's a fundamental reimagining of how software is built."
      }
    ]
  },
  {
    id: "multi-model-comparison",
    title: "Multi-Model AI: Why One Size Doesn't Fit All",
    excerpt: "Explore why using multiple AI models simultaneously leads to better results and how LLMHub makes it easy to leverage the strengths of different models.",
    author: "Emily Watson",
    date: "2025-01-05",
    readTime: "6 min read",
    category: "AI Models",
    tags: ["ChatGPT", "Claude", "Gemini", "Multi-Model"],
    icon: Zap,
    content: [
      {
        type: "intro",
        text: "Different AI models excel at different tasks. ChatGPT might be great for creative writing, Claude for analysis, and Gemini for technical documentation. Why limit yourself to just one?"
      },
      {
        type: "section",
        title: "The Power of Diversity",
        text: "Just as diverse human teams outperform homogeneous ones, using multiple AI models provides diverse perspectives, catches different edge cases, and delivers more robust solutions."
      },
      {
        type: "section",
        title: "Model Strengths",
        bullets: [
          "GPT-4: Creative content and natural conversation",
          "Claude: Deep analysis and nuanced reasoning",
          "Gemini: Technical accuracy and multimodal understanding",
          "Llama: Open-source flexibility and customization",
          "Mistral: Efficient performance for specific tasks"
        ]
      },
      {
        type: "highlight",
        text: "Teams using multiple AI models report 40% better accuracy in complex decision-making tasks."
      }
    ]
  },
  {
    id: "collaborative-ai-workspaces",
    title: "Building Collaborative AI Workspaces for Remote Teams",
    excerpt: "How collaborative AI rooms are enabling remote teams to work together more effectively with shared AI assistance and real-time collaboration features.",
    author: "David Park",
    date: "2024-12-28",
    readTime: "7 min read",
    category: "Collaboration",
    tags: ["Remote Work", "Collaboration", "Team Productivity"],
    icon: Users,
    content: [
      {
        type: "intro",
        text: "Remote work has challenged traditional collaboration methods. Collaborative AI workspaces are emerging as the solution, providing shared AI assistance that keeps distributed teams aligned and productive."
      },
      {
        type: "section",
        title: "Features That Matter",
        bullets: [
          "Real-time shared AI conversations",
          "Persistent context across team sessions",
          "Role-based AI interactions",
          "Automated meeting summaries and action items",
          "Cross-timezone asynchronous collaboration"
        ]
      },
      {
        type: "conclusion",
        text: "The future of remote work isn't just about video calls and shared documents; it's about AI-enhanced collaboration spaces where teams and AI work together seamlessly."
      }
    ]
  },
  {
    id: "open-source-ai-movement",
    title: "The Open Source AI Movement: Why It Matters",
    excerpt: "Understanding the importance of open-source AI models and how LLMHub supports the democratization of AI technology through tools like Ollama.",
    author: "Alex Thompson",
    date: "2024-12-20",
    readTime: "9 min read",
    category: "Open Source",
    tags: ["Open Source", "Ollama", "Llama", "Democracy"],
    icon: Heart,
    content: [
      {
        type: "intro",
        text: "The open-source AI movement isn't just about free software; it's about ensuring AI technology remains accessible, transparent, and beneficial for everyone."
      },
      {
        type: "section",
        title: "Why Open Source Matters",
        bullets: [
          "Transparency in AI decision-making",
          "Community-driven improvements",
          "No vendor lock-in",
          "Privacy through local deployment",
          "Customization for specific needs"
        ]
      },
      {
        type: "highlight",
        text: "Over 50% of enterprises now use open-source AI models in production, citing control and customization as key factors."
      }
    ]
  },
  {
    id: "ai-code-execution",
    title: "Secure Code Execution: How We Run Your AI-Generated Code Safely",
    excerpt: "A deep dive into LLMHub's sandboxed code execution environment and the security measures that keep your AI experiments safe and isolated.",
    author: "Rachel Kim",
    date: "2024-12-15",
    readTime: "11 min read",
    category: "Security",
    tags: ["Security", "Code Execution", "Docker", "Sandboxing"],
    icon: Code,
    content: [
      {
        type: "intro",
        text: "Running AI-generated code presents unique security challenges. Here's how we've built a secure, isolated environment that lets you experiment freely without risk."
      },
      {
        type: "section",
        title: "Security Layers",
        bullets: [
          "Docker containerization for complete isolation",
          "Resource limits to prevent abuse",
          "Network isolation and monitoring",
          "Automatic session termination",
          "No persistent storage between sessions"
        ]
      },
      {
        type: "conclusion",
        text: "Security doesn't have to limit functionality. With proper isolation and monitoring, AI can safely execute code while maintaining system integrity."
      }
    ]
  },
  {
    id: "future-of-ai-agents",
    title: "The Future of AI Agents: What's Next?",
    excerpt: "Predictions and insights into how AI agents will evolve in the next year and what capabilities we can expect to see emerge.",
    author: "James Liu",
    date: "2024-12-10",
    readTime: "5 min read",
    category: "Future",
    tags: ["Future", "AI Agents", "Predictions"],
    icon: Rocket,
    content: [
      {
        type: "intro",
        text: "AI agents are evolving rapidly. Here's what we predict will happen in the next 12 months and how it will impact your work."
      },
      {
        type: "section",
        title: "Coming Soon",
        bullets: [
          "Agents that can plan and execute month-long projects",
          "Cross-application automation without APIs",
          "Natural language to production deployment",
          "AI agents training other AI agents",
          "Autonomous research and report generation"
        ]
      }
    ]
  },
  {
    id: "byok-philosophy",
    title: "Bring Your Own Keys: The Philosophy of User Control",
    excerpt: "Why we believe users should own their AI access and how BYOK (Bring Your Own Keys) empowers users while ensuring privacy.",
    author: "Lisa Chen",
    date: "2024-12-05",
    readTime: "6 min read",
    category: "Privacy",
    tags: ["Privacy", "BYOK", "User Control"],
    icon: Target,
    content: [
      {
        type: "intro",
        text: "Your API keys, your control. The BYOK philosophy isn't just about cost; it's about ensuring users maintain complete control over their AI interactions."
      },
      {
        type: "section",
        title: "Benefits of BYOK",
        bullets: [
          "Direct relationship with AI providers",
          "Complete control over usage and costs",
          "No middleman in your AI interactions",
          "Enhanced privacy and security",
          "Flexibility to switch providers anytime"
        ]
      }
    ]
  }
]

export default function BlogPage() {
  const [selectedPost, setSelectedPost] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const { theme } = useTheme()

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.4,
        ease: "easeOut" as const
      }
    }
  }

  // Get categories with their post counts
  const categoriesWithCounts = blogPosts.reduce((acc, post) => {
    if (!acc[post.category]) {
      acc[post.category] = 0
    }
    acc[post.category]++
    return acc
  }, {} as Record<string, number>)

  // Filter out categories with no posts and sort by count
  const availableCategories = Object.entries(categoriesWithCounts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }))

  const filteredPosts = selectedCategory 
    ? blogPosts.filter(post => post.category === selectedCategory)
    : blogPosts

  const featuredPost = !selectedCategory ? blogPosts.find(post => post.featured) : null
  const regularPosts = selectedCategory ? filteredPosts : filteredPosts.filter(post => !post.featured)

  return (
    <div className="min-h-screen bg-background relative">
      {/* Sparkles Background */}
      <div className="absolute inset-0 w-full h-full">
        <SparklesCore
          id="blog-sparkles"
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={50}
          className="w-full h-full"
          particleColor={theme === "dark" ? "#FFFFFF" : "#000000"}
        />
      </div>

      {/* Header */}
      <LandingHeader />

      {/* Main Content */}
      <main className={cn(
        "relative",
        isMobile ? "pt-16" : "pt-20"
      )}>
        {/* Hero Section */}
        <section className={cn(
          "flex items-center justify-center",
          isMobile ? "px-4 py-12" : "px-6 py-20"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-6xl"
          >
            <motion.div variants={itemVariants} className="text-center mb-12">
              <Badge variant="outline" className="mb-4">
                <BookOpen className="mr-1 h-3 w-3" />
                Blog & Insights
              </Badge>
              <h1 className={cn(
                "font-bold tracking-tight",
                isMobile ? "text-4xl" : "text-5xl sm:text-6xl"
              )}>
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  LLMHub Blog
                </span>
              </h1>
              <p className={cn(
                "text-muted-foreground mx-auto",
                isMobile ? "mt-4 text-base max-w-md" : "mt-6 text-lg sm:text-xl max-w-2xl"
              )}>
                Insights, updates, and thoughts on AI employees, automation, and the future of work.
              </p>
            </motion.div>

            {/* Category Filter */}
            <motion.div 
              variants={itemVariants} 
              className="flex flex-wrap gap-2 justify-center mb-8"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Button
                  variant={selectedCategory === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedCategory(null)
                    // Smooth scroll to top of posts section
                    window.scrollTo({ top: 400, behavior: 'smooth' })
                  }}
                  className="relative"
                >
                  All Posts
                  <Badge 
                    variant={selectedCategory === null ? "secondary" : "outline"} 
                    className="ml-2 px-1.5 py-0 text-xs"
                  >
                    {blogPosts.length}
                  </Badge>
                </Button>
              </motion.div>
              {availableCategories.map(({ category, count }) => (
                <motion.div
                  key={category}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button
                    variant={selectedCategory === category ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setSelectedCategory(category)
                      // Smooth scroll to top of posts section
                      window.scrollTo({ top: 400, behavior: 'smooth' })
                    }}
                    className="relative"
                  >
                    {category}
                    <Badge 
                      variant={selectedCategory === category ? "secondary" : "outline"} 
                      className="ml-2 px-1.5 py-0 text-xs"
                    >
                      {count}
                    </Badge>
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* Blog Posts */}
        <section className={cn(
          "py-12",
          isMobile ? "px-4" : "px-6"
        )}>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="max-w-6xl mx-auto"
          >
            {/* Featured Post */}
            {featuredPost && (
              <motion.div variants={itemVariants} className="mb-12">
                <Card 
                  className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent cursor-pointer hover:shadow-xl transition-all"
                  onClick={() => setSelectedPost(featuredPost.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">
                            <Star className="mr-1 h-3 w-3" />
                            Featured
                          </Badge>
                          <Badge variant="outline">{featuredPost.category}</Badge>
                        </div>
                        <CardTitle className="text-3xl">
                          {featuredPost.title}
                        </CardTitle>
                        <CardDescription className="text-base">
                          {featuredPost.excerpt}
                        </CardDescription>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {featuredPost.author}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(featuredPost.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {featuredPost.readTime}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {featuredPost.tags.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              <Tag className="mr-1 h-2 w-2" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      {!isMobile && (
                        <div className="ml-6">
                          <div className="p-4 rounded-xl bg-primary/10">
                            <featuredPost.icon className="h-12 w-12 text-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
            )}

            {/* Regular Posts Grid */}
            {regularPosts.length === 0 && selectedCategory ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-12"
              >
                <div className="inline-flex flex-col items-center gap-3">
                  <div className="p-3 rounded-full bg-muted">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">No posts found</h3>
                  <p className="text-muted-foreground">
                    No posts in the "{selectedCategory}" category yet.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCategory(null)}
                  >
                    View all posts
                  </Button>
                </div>
              </motion.div>
            ) : (
            <motion.div 
              layout
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
            >
              <AnimatePresence mode="popLayout">
                {regularPosts.map((post, index) => {
                  const Icon = post.icon

                  return (
                    <motion.div
                      key={post.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ 
                        duration: 0.3,
                        delay: index * 0.05,
                        ease: "easeOut"
                      }}
                      whileHover={{ scale: 1.02 }}
                    >
                    <Card 
                      className="h-full cursor-pointer hover:shadow-lg transition-all"
                      onClick={() => setSelectedPost(post.id)}
                    >
                      <CardHeader>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">{post.category}</Badge>
                            <Icon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <CardTitle className="line-clamp-2">
                            {post.title}
                          </CardTitle>
                          <CardDescription className="line-clamp-3">
                            {post.excerpt}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {post.author}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {post.readTime}
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <Button variant="ghost" size="sm">
                              Read More
                              <ArrowRight className="ml-1 h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
              </AnimatePresence>
            </motion.div>
            )}

            {/* Quick Actions */}
            <motion.div 
              variants={itemVariants}
              className="mt-12 text-center"
            >
              <div className="inline-flex flex-col sm:flex-row gap-4">
                <Button variant="outline" size="lg" asChild>
                  <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                  </Link>
                </Button>
                <Button size="lg" asChild>
                  <Link href="/auth">
                    Try LLMHub Free
                  </Link>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Post Modal */}
        <AnimatePresence>
          {selectedPost && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
              onClick={() => setSelectedPost(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-4xl max-h-[80vh] overflow-auto bg-background border rounded-xl shadow-2xl"
              >
                {(() => {
                  const post = blogPosts.find(p => p.id === selectedPost)
                  if (!post) return null
                  const Icon = post.icon

                  return (
                    <div className="p-8">
                      <div className="space-y-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-3 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{post.category}</Badge>
                              {post.featured && (
                                <Badge variant="default">
                                  <Star className="mr-1 h-3 w-3" />
                                  Featured
                                </Badge>
                              )}
                            </div>
                            <h2 className="text-3xl font-bold">{post.title}</h2>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {post.author}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {post.readTime}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {post.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  <Tag className="mr-1 h-2 w-2" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedPost(null)}
                            className="shrink-0"
                          >
                            <ChevronRight className="h-5 w-5 rotate-90" />
                          </Button>
                        </div>

                        <div className="prose prose-neutral dark:prose-invert max-w-none">
                          {post.content.map((section, idx) => {
                            if (section.type === 'intro') {
                              return (
                                <p key={idx} className="text-lg text-muted-foreground">
                                  {section.text}
                                </p>
                              )
                            }
                            if (section.type === 'section') {
                              return (
                                <div key={idx} className="space-y-3">
                                  <h3 className="text-xl font-semibold">{section.title}</h3>
                                  {section.text && <p className="text-muted-foreground">{section.text}</p>}
                                  {section.bullets && (
                                    <ul className="space-y-2">
                                      {section.bullets.map((bullet, bulletIdx) => (
                                        <li key={bulletIdx} className="flex items-start gap-2">
                                          <span className="text-primary mt-1">•</span>
                                          <span className="text-muted-foreground">{bullet}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              )
                            }
                            if (section.type === 'highlight') {
                              return (
                                <div key={idx} className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                                  <p className="font-medium text-primary">
                                    {section.text}
                                  </p>
                                </div>
                              )
                            }
                            if (section.type === 'conclusion') {
                              return (
                                <div key={idx} className="pt-4 border-t">
                                  <p className="text-muted-foreground italic">
                                    {section.text}
                                  </p>
                                </div>
                              )
                            }
                            return null
                          })}
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t">
                          <Button variant="outline" asChild>
                            <Link href="/auth">
                              Try LLMHub
                            </Link>
                          </Button>
                          <Button onClick={() => setSelectedPost(null)}>
                            Close
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="py-12 mt-20 border-t border-border/50">
          <div className={cn(
            "mx-auto",
            isMobile ? "px-4 max-w-xl" : "px-6 max-w-7xl"
          )}>
            <div className={cn(
              "flex justify-between items-center",
              isMobile && "flex-col gap-6"
            )}>
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} LLMHub. All rights reserved.
              </p>
              <div className="flex gap-6">
                <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </Link>
                <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </Link>
                <Link href="/changelog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Changelog
                </Link>
                <Link href="/blog" className="text-sm text-primary hover:text-primary/80 transition-colors">
                  Blog
                </Link>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}