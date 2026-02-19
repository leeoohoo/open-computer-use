import {
  BookOpenText,
  Brain,
  Code,
  Lightbulb,
  Notepad,
  PaintBrush,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 5
export const AUTH_DAILY_MESSAGE_LIMIT = 100
export const REMAINING_QUERY_ALERT_THRESHOLD = 3
export const DAILY_FILE_UPLOAD_LIMIT = 5
export const DAILY_LIMIT_PRO_MODELS = 100

export const NON_AUTH_ALLOWED_MODELS = ["amazon.nova-lite-v1:0"]

export const FREE_MODELS_IDS = [
  "amazon.nova-lite-v1:0",
]

// Model is controlled by backend BEDROCK_DEFAULT_MODEL env var.
// This value is only used as a placeholder ID for the frontend request.
export const MODEL_DEFAULT = "bedrock-default"

export const APP_NAME = "Coasty"
export const APP_DOMAIN = "https://coasty.ai"

export const SUGGESTIONS = [
  {
    label: "Summary",
    highlight: "Summarize",
    prompt: `Summarize`,
    items: [
      "Find and summarize today's top AI breakthroughs with sources",
      "Search for and summarize this week's major tech acquisitions",
      "Get the latest EV market data and summarize key trends",
      "Research and summarize current climate policy changes globally",
    ],
    icon: Notepad,
  },
  {
    label: "Code",
    highlight: "Build",
    prompt: `Build`,
    items: [
      "Build a React component for infinite scroll with TypeScript",
      "Create a Python FastAPI endpoint with authentication",
      "Write a SQL query to analyze user engagement metrics",
      "Implement a debounce function in JavaScript with examples",
    ],
    icon: Code,
  },
  {
    label: "Research",
    highlight: "Analyze",
    prompt: `Analyze`,
    items: [
      "Search and analyze 2025 travel trends with data and statistics",
      "Find and compare top 5 programming frameworks released this year",
      "Research latest AI regulations and analyze their impact",
      "Investigate renewable energy costs vs fossil fuels with current data",
    ],
    icon: BookOpenText,
  },
  {
    label: "Create",
    highlight: "Generate",
    prompt: `Generate`,
    items: [
      "Generate a marketing strategy for a SaaS startup in 2025",
      "Create a comprehensive project plan for mobile app development",
      "Design a color scheme and typography for modern web app",
      "Build a content calendar for tech blog with trending topics",
    ],
    icon: Sparkle,
  },
  {
    label: "Solve",
    highlight: "Debug",
    prompt: `Debug`,
    items: [
      "Debug this React useEffect infinite loop issue",
      "Fix Python async function not awaiting properly",
      "Resolve CORS error in Next.js API route",
      "Troubleshoot Docker container networking problem",
    ],
    icon: Brain,
  },
  {
    label: "Learn",
    highlight: "Explain",
    prompt: `Explain`,
    items: [
      "Explain transformers in AI with visual examples",
      "Break down microservices vs monolithic architecture",
      "Clarify WebSockets vs Server-Sent Events with use cases",
      "Compare SQL vs NoSQL databases with decision matrix",
    ],
    icon: Lightbulb,
  },
]

// Import centralized system prompts
import { getSystemPromptDefault } from "./prompts/system-prompts";

// Legacy export for backward compatibility - will dynamically generate
export const SYSTEM_PROMPT_DEFAULT = getSystemPromptDefault();

export const MESSAGE_MAX_LENGTH = 10000
