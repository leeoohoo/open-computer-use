"""
Autonomous Blog Engine — Runs daily, searches the web for trending topics,
generates 50 SEO-optimized blog posts, and publishes them to Supabase.

Zero manual intervention. Hooks into the backend lifespan as an asyncio task.

Topic categories it covers:
- Computer use trends, news, and how-tos
- Automation tutorials and comparisons
- OSWorld and AI agent benchmarks
- Industry-specific automation guides
- Competitor analysis and comparisons
- Real-world use cases and workflows
"""

import asyncio
import json
import logging
import random
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

import boto3
import aiohttp
import ssl
import certifi

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DAILY_POST_TARGET = 50
POSTS_PER_CYCLE = 10          # Generate in batches to avoid timeouts
CYCLE_DELAY_SECONDS = 30      # Pause between batches
RUN_HOUR_UTC = 4              # Run at 4 AM UTC daily
SEO_PAGES_PER_DAY = 10        # Also generate SEO pages

AUTHORS = [
    "Marcus Sterling", "Sarah Chen", "Michael Rodriguez", "Emily Watson",
    "David Park", "Alex Thompson", "Rachel Kim", "James Liu", "Lisa Chen",
    "Sophia Martinez", "Daniel Kim", "Priya Patel",
]

# Topic templates that get combined with web search results
SEARCH_QUERIES = [
    # Trending / news
    "computer use AI agent news {year}",
    "best AI automation tools {year}",
    "AI agent benchmark results {year}",
    "OSWorld benchmark latest results",
    "computer use agent comparison",
    "AI desktop automation trends",
    "RPA vs AI agents {year}",
    "AI agent for business automation",
    "computer use AI use cases",
    "autonomous AI agent breakthroughs {year}",
    # How-tos
    "how to automate data entry with AI",
    "how to automate web scraping with AI agents",
    "how to automate email outreach with AI",
    "how to automate QA testing with AI",
    "how to automate social media with AI agents",
    "how to automate invoicing with AI",
    "how to automate customer support with AI",
    "how to automate recruiting with AI",
    "how to automate reporting with AI agents",
    "how to automate file management with AI",
    # Industry
    "AI automation for healthcare {year}",
    "AI automation for legal industry",
    "AI automation for real estate",
    "AI automation for e-commerce",
    "AI automation for finance and accounting",
    "AI automation for HR and recruiting",
    "AI automation for marketing agencies",
    "AI automation for insurance claims",
    "AI automation for education",
    "AI automation for supply chain",
    # Deep dives
    "computer use agent security best practices",
    "AI agent credential handling",
    "multi-agent orchestration patterns",
    "AI agent cost optimization",
    "computer use agent vs browser extension",
    "AI agent error handling and recovery",
    "computer use agent for enterprise",
    "AI agent monitoring and observability",
    "computer use agent API integration",
    "AI agent workflow automation patterns",
    # Competitor / comparison
    "Anthropic computer use vs alternatives",
    "OpenAI operator review {year}",
    "best computer use platform {year}",
    "AI agent platform comparison {year}",
    "UiPath vs AI agents",
    "Automation Anywhere vs AI agents",
    "browser automation AI vs Selenium",
    "AI agent vs virtual assistant",
    "computer use agent pricing comparison",
    "AI agent ROI calculator",
]

SEO_PAGE_TEMPLATES = [
    {"slug": "data-entry", "title": "AI Data Entry Automation", "stat": "10x", "stat_label": "faster than manual"},
    {"slug": "invoice-processing", "title": "AI Invoice Processing", "stat": "500+", "stat_label": "invoices per hour"},
    {"slug": "web-scraping", "title": "AI Web Scraping", "stat": "1000+", "stat_label": "pages per session"},
    {"slug": "form-filling", "title": "AI Form Filling", "stat": "100+", "stat_label": "forms per hour"},
    {"slug": "email-management", "title": "AI Email Management", "stat": "200+", "stat_label": "emails daily"},
    {"slug": "report-generation", "title": "AI Report Generation", "stat": "50+", "stat_label": "reports per day"},
    {"slug": "social-media-posting", "title": "AI Social Media Management", "stat": "20+", "stat_label": "platforms"},
    {"slug": "price-monitoring", "title": "AI Price Monitoring", "stat": "5000+", "stat_label": "SKUs tracked"},
    {"slug": "job-applications", "title": "AI Job Applications", "stat": "50+", "stat_label": "applications per session"},
    {"slug": "customer-support", "title": "AI Customer Support", "stat": "76%", "stat_label": "auto-resolved"},
    {"slug": "lead-research", "title": "AI Lead Research", "stat": "100+", "stat_label": "leads per hour"},
    {"slug": "content-publishing", "title": "AI Content Publishing", "stat": "30+", "stat_label": "posts daily"},
    {"slug": "crm-updates", "title": "AI CRM Updates", "stat": "500+", "stat_label": "records per hour"},
    {"slug": "calendar-scheduling", "title": "AI Calendar Scheduling", "stat": "50+", "stat_label": "meetings daily"},
    {"slug": "pdf-processing", "title": "AI PDF Processing", "stat": "200+", "stat_label": "PDFs per hour"},
    {"slug": "spreadsheet-automation", "title": "AI Spreadsheet Automation", "stat": "100+", "stat_label": "sheets processed"},
    {"slug": "browser-testing", "title": "AI Browser Testing", "stat": "30+", "stat_label": "flows per session"},
    {"slug": "competitor-monitoring", "title": "AI Competitor Monitoring", "stat": "50+", "stat_label": "competitors tracked"},
    {"slug": "recruiting-outreach", "title": "AI Recruiting Outreach", "stat": "100+", "stat_label": "candidates contacted"},
    {"slug": "healthcare-automation", "title": "Computer Use for Healthcare", "stat": "5x", "stat_label": "faster charts"},
    {"slug": "legal-document-review", "title": "Computer Use for Legal", "stat": "200+", "stat_label": "docs per day"},
    {"slug": "real-estate-automation", "title": "Computer Use for Real Estate", "stat": "50+", "stat_label": "listings managed"},
    {"slug": "ecommerce-automation", "title": "Computer Use for E-Commerce", "stat": "10x", "stat_label": "faster ops"},
    {"slug": "finance-automation", "title": "Computer Use for Finance", "stat": "100+", "stat_label": "reports generated"},
    {"slug": "marketing-automation", "title": "Computer Use for Marketing", "stat": "20+", "stat_label": "campaigns managed"},
    {"slug": "sales-automation", "title": "Computer Use for Sales", "stat": "200+", "stat_label": "prospects contacted"},
    {"slug": "hr-automation", "title": "Computer Use for HR", "stat": "50+", "stat_label": "onboardings monthly"},
    {"slug": "insurance-automation", "title": "Computer Use for Insurance", "stat": "100+", "stat_label": "claims daily"},
    {"slug": "education-automation", "title": "Computer Use for Education", "stat": "500+", "stat_label": "assignments graded"},
    {"slug": "accounting-automation", "title": "Computer Use for Accounting", "stat": "10x", "stat_label": "faster reconciliation"},
]


class AutoBlogEngine:
    """Fully autonomous blog content engine."""

    def __init__(self):
        self.bedrock_client = None
        self.supabase = None
        self._initialized = False

    def _init_clients(self):
        """Lazy-init AWS Bedrock and Supabase clients."""
        if self._initialized:
            return

        if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
            self.bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=settings.AWS_REGION,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )

        if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE:
            from supabase import create_client
            self.supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE)

        self._initialized = True

    # ------------------------------------------------------------------
    # Web Search
    # ------------------------------------------------------------------

    async def _web_search(self, query: str, num_results: int = 5) -> List[Dict[str, Any]]:
        """Search Google for trending content to base articles on."""
        if not settings.GOOGLE_SEARCH_KEY or not settings.GOOGLE_SEARCH_CX:
            return []

        params = {
            "key": settings.GOOGLE_SEARCH_KEY,
            "cx": settings.GOOGLE_SEARCH_CX,
            "q": query.strip(),
            "num": str(num_results),
            "hl": "en",
            "gl": "us",
            "safe": "active",
            "fields": "items(title,link,snippet)",
        }

        ssl_context = ssl.create_default_context(cafile=certifi.where())
        connector = aiohttp.TCPConnector(ssl=ssl_context)

        try:
            async with aiohttp.ClientSession(connector=connector) as session:
                async with session.get(
                    "https://customsearch.googleapis.com/customsearch/v1",
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    if response.status != 200:
                        return []
                    data = await response.json()
                    items = data.get("items", [])
                    return [
                        {"title": i.get("title", ""), "url": i.get("link", ""), "snippet": i.get("snippet", "")}
                        for i in items
                    ]
        except Exception as e:
            logger.warning(f"Auto-blog search failed for '{query}': {e}")
            return []

    # ------------------------------------------------------------------
    # Claude via Bedrock (with tool use)
    # ------------------------------------------------------------------

    # Tool definition for web_search
    WEB_SEARCH_TOOL = {
        "toolSpec": {
            "name": "web_search",
            "description": "Search the web for current information on a topic. Use this to find recent news, stats, trends, competitor info, benchmarks, and real-world examples. You can call this multiple times with different queries to research different angles.",
            "inputSchema": {
                "json": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query. Be specific — e.g. 'OSWorld benchmark 2026 results' or 'AI agent vs RPA cost comparison'."
                        },
                        "num_results": {
                            "type": "integer",
                            "description": "Number of results to return (1-10). Default 5.",
                            "default": 5
                        }
                    },
                    "required": ["query"]
                }
            }
        }
    }

    MAX_TOOL_ROUNDS = 8  # Max number of search round-trips per generation

    async def _call_claude_with_tools(self, system: str, user_msg: str) -> str:
        """Call Claude via Bedrock converse API with web_search tool.

        Runs a tool-use loop: Claude can call web_search multiple times to
        research the topic before producing the final JSON output.
        """
        if not self.bedrock_client:
            raise RuntimeError("Bedrock client not initialized")

        messages = [{"role": "user", "content": [{"text": user_msg}]}]

        for round_num in range(self.MAX_TOOL_ROUNDS + 1):
            def _invoke(msgs):
                return self.bedrock_client.converse(
                    modelId=settings.BEDROCK_DEFAULT_MODEL,
                    system=[{"text": system}],
                    messages=msgs,
                    toolConfig={"tools": [self.WEB_SEARCH_TOOL]},
                    inferenceConfig={"maxTokens": 4096, "temperature": 0.7},
                )

            response = await asyncio.to_thread(_invoke, messages)
            stop_reason = response.get("stopReason", "end_turn")
            output_content = response["output"]["message"]["content"]

            # If the model finished (no tool calls), extract text
            if stop_reason != "tool_use":
                logger.info(f"Auto-blog: Claude finished after {round_num + 1} rounds (reason: {stop_reason})")
                for block in output_content:
                    if "text" in block:
                        text = block["text"]
                        logger.debug(f"Auto-blog: Response length: {len(text)} chars")
                        return text
                logger.warning(f"Auto-blog: No text in final response. Blocks: {[list(b.keys()) for b in output_content]}")
                return ""

            # Model wants to use tools — process each tool call
            # First, add the assistant message to conversation
            messages.append({"role": "assistant", "content": output_content})

            # Process tool calls and build tool results
            tool_results = []
            for block in output_content:
                if "toolUse" not in block:
                    continue

                tool_use = block["toolUse"]
                tool_id = tool_use["toolUseId"]
                tool_name = tool_use["name"]
                tool_input = tool_use.get("input", {})

                if tool_name == "web_search":
                    query = tool_input.get("query", "")
                    num = min(tool_input.get("num_results", 5), 10)

                    logger.info(f"Auto-blog: Claude searching: \"{query}\"")
                    results = await self._web_search(query, num_results=num)

                    if results:
                        result_text = "\n".join(
                            f"{i+1}. {r['title']}\n   {r['snippet']}\n   URL: {r['url']}"
                            for i, r in enumerate(results)
                        )
                    else:
                        result_text = "No results found for this query."

                    tool_results.append({
                        "toolResult": {
                            "toolUseId": tool_id,
                            "content": [{"text": result_text}]
                        }
                    })
                else:
                    # Unknown tool
                    tool_results.append({
                        "toolResult": {
                            "toolUseId": tool_id,
                            "content": [{"text": f"Unknown tool: {tool_name}"}],
                            "status": "error"
                        }
                    })

            # Add tool results as user message and continue the loop
            messages.append({"role": "user", "content": tool_results})

        # If we exhausted all rounds, force a final call without tools
        logger.warning("Auto-blog: Exhausted tool rounds, forcing final response")
        def _final(msgs):
            return self.bedrock_client.converse(
                modelId=settings.BEDROCK_DEFAULT_MODEL,
                system=[{"text": system}],
                messages=msgs,
                inferenceConfig={"maxTokens": 4096, "temperature": 0.7},
            )
        response = await asyncio.to_thread(_final, messages)
        for block in response["output"]["message"]["content"]:
            if "text" in block:
                return block["text"]
        return ""

    def _parse_json_response(self, raw: str) -> dict:
        """Parse JSON from Claude response, handling markdown fences and surrounding text."""
        text = raw.strip()

        # Remove markdown code fences
        text = re.sub(r'^```(?:json)?\s*\n?', '', text)
        text = re.sub(r'\n?```\s*$', '', text)

        # Try direct parse first
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Extract JSON object from surrounding text
        # Find the first { and last } to isolate the JSON
        first_brace = text.find('{')
        last_brace = text.rfind('}')
        if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
            json_str = text[first_brace:last_brace + 1]
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass

        # Log what we got for debugging
        logger.error(f"Auto-blog: Failed to parse JSON. Raw response (first 500 chars): {text[:500]}")
        raise json.JSONDecodeError("Could not extract JSON from response", text, 0)

    def _strip_em_dashes(self, obj: Any):
        """Recursively replace em dashes and en dashes with commas in all strings."""
        if isinstance(obj, dict):
            for key in obj:
                if isinstance(obj[key], str):
                    # Replace em dash, en dash, and horizontal bar with comma-space
                    obj[key] = obj[key].replace("\u2014", ", ").replace("\u2013", ", ").replace("\u2015", ", ")
                    # Clean up double commas or comma-period
                    obj[key] = re.sub(r',\s*,', ',', obj[key])
                    obj[key] = re.sub(r',\s*\.', '.', obj[key])
                elif isinstance(obj[key], (dict, list)):
                    self._strip_em_dashes(obj[key])
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                if isinstance(item, str):
                    obj[i] = item.replace("\u2014", ", ").replace("\u2013", ", ").replace("\u2015", ", ")
                    obj[i] = re.sub(r',\s*,', ',', obj[i])
                    obj[i] = re.sub(r',\s*\.', '.', obj[i])
                elif isinstance(item, (dict, list)):
                    self._strip_em_dashes(item)

    # ------------------------------------------------------------------
    # Content Generation
    # ------------------------------------------------------------------

    async def _generate_blog_post(self, topic_query: str) -> Optional[dict]:
        """Generate a single blog post. Claude researches via web_search tool, then writes."""
        year = datetime.now().year
        topic = topic_query.replace("{year}", str(year))

        system = """You are a provocative, opinionated tech writer who works for Coasty (coasty.ai), the #1 computer use AI agent (82% on OSWorld, higher than every competitor). You write like a human blogger, not a corporate content mill.

You have a web_search tool. USE IT AGGRESSIVELY. Search for:
- Controversial takes and hot debates in AI/automation
- Failures and problems with competitors (Anthropic Computer Use, OpenAI Operator, UiPath, etc.)
- Shocking statistics about wasted time, money, and productivity
- Real company horror stories about manual work and failed automation
- Trending AI news that people are arguing about RIGHT NOW

Do 3-5 searches minimum. Find the spiciest, most shareable angles.

YOUR WRITING STYLE:
- Write like a real person. Short punchy sentences. Strong opinions. Take sides.
- Be confrontational. Call out bad tools, outdated thinking, companies stuck in 2020.
- Use concrete numbers. "$47,000 per employee wasted" hits harder than "significant costs."
- Ask rhetorical questions. "Why are you still paying someone to copy-paste data in 2026?"
- NEVER use em dashes (the long dash). Use commas, periods, or "and" instead.
- NEVER use the word "delve" or "landscape" or "game-changer" or "revolutionize."
- Contractions are good. "It's" not "It is." "Can't" not "Cannot." "Don't" not "Do not."
- Swear lightly if it fits. "This is absurd." "That's insane." Keep it PG-13.
- Reference Coasty naturally as the solution, but don't be a cringe ad. Be the person at the bar who genuinely thinks their tool is the best and can back it up.
- Write titles that make people CLICK. Controversial > boring. Numbers > vague. Specific > generic.

COASTY PROMOTION (weave in naturally, not forced):
- Coasty.ai is the #1 computer use agent. 82% on OSWorld. Nobody else is close.
- It controls real desktops, browsers, and terminals. Not just API calls.
- Desktop app, cloud VMs, agent swarms for parallel execution.
- Free tier available. BYOK supported.
- Position it as the obvious choice whenever comparing to manual work or competitors.

SEO REQUIREMENTS:
- Use "computer use" and variations 5-10 times naturally
- Keyword variations: "computer use agent", "AI computer use", "best computer use", "computer-using AI"
- Title must be clickable AND contain the primary keyword

ABSOLUTELY NO em dashes (the long — character). Not one. Ever. Use commas or periods instead.

Return ONLY valid JSON. No markdown fences, no explanation."""

        user_msg = f"""Write a viral, opinionated blog post about: "{topic}"

Search the web first. Find the most controversial, surprising, or rage-inducing angles. Get real stats that make people stop scrolling.

Then produce ONLY valid JSON:
{{
  "id": "seo-friendly-slug",
  "title": "Provocative SEO Title That Makes People Click (include 'computer use' or 'AI agent')",
  "excerpt": "2-3 sentence hook that creates urgency or outrage. Make them NEED to read it.",
  "author": "{random.choice(AUTHORS)}",
  "read_time": "X min",
  "category": "one of: Product, Research, Case Study, Engineering, Industry, Guide, Tutorial, Comparison",
  "keywords": ["8-15 SEO keywords including computer use variations"],
  "meta_description": "Under 160 chars. Punchy. Includes primary keyword.",
  "content": [
    {{"type": "intro", "text": "Hook them in the first sentence. Shocking stat or bold claim."}},
    {{"type": "section", "title": "Provocative Section Title", "text": "Build the argument with real data from your research."}},
    {{"type": "section", "title": "Section Title", "bullets": ["sharp, specific points with numbers"]}},
    {{"type": "highlight", "text": "The one stat or quote that makes this post shareable"}},
    {{"type": "section", "title": "Section", "text": "more detailed content, keep the energy up"}},
    {{"type": "section", "title": "Why Coasty Exists (or How Coasty Solves This)", "text": "Natural Coasty plug backed by real capabilities. Not an ad. A recommendation from someone who knows."}},
    {{"type": "conclusion", "text": "End with a strong opinion. Take a stand. Tell them what to do next. Link to coasty.ai."}}
  ]
}}

6-9 content blocks. Every paragraph should earn its place. No filler. No fluff. Write something people actually want to share."""

        try:
            raw = await self._call_claude_with_tools(system, user_msg)
            post = self._parse_json_response(raw)

            # Enforce required fields
            post["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            post["featured"] = False
            post["published"] = True
            post.setdefault("keywords", [])
            post.setdefault("meta_description", post.get("excerpt", "")[:160])

            if not post.get("id") or not post.get("title") or not post.get("content"):
                logger.warning("Generated post missing required fields, skipping")
                return None

            # Strip em dashes from all text content
            self._strip_em_dashes(post)

            return post
        except Exception as e:
            logger.error(f"Blog post generation failed: {e}")
            return None

    async def _generate_seo_page(self, template: dict) -> Optional[dict]:
        """Generate a /computer-use/[task] SEO page. Claude researches via web_search."""
        system = """You are a direct, no-BS writer for Coasty (coasty.ai), the #1 computer use AI agent (82% OSWorld).

You have a web_search tool. Use it to find:
- How much time and money companies waste doing this task manually
- Horror stories about manual processes failing
- Stats on error rates, costs, and time wasted
- What existing automation tools get wrong

WRITING RULES:
- Write like a smart friend explaining why this is a solved problem now. Not corporate speak.
- Lead with pain. "You're spending 40 hours a week on this. That's insane."
- Use real numbers from your research. Specific > vague.
- NEVER use em dashes (the long — character). Use commas or periods instead.
- NEVER use "delve", "landscape", "game-changer", "revolutionize", "streamline."
- Use contractions. Write how people talk.
- Coasty is the answer. Position it naturally. Not salesy, just confident.
- End with a clear CTA to try Coasty at coasty.ai.

SEO: Target "[task] computer use agent" and "[task] AI automation" keywords. Use "computer use" 5+ times naturally.

Return ONLY valid JSON. No markdown fences."""

        user_msg = f"""Write a landing page for: "{template['title']}" (slug: {template['slug']})
Hero stat: {template['stat']} {template['stat_label']}

Search the web first. Find real pain points and stats about this task. Then write.

Return ONLY valid JSON:
{{
  "slug": "{template['slug']}",
  "title": "{template['title']}",
  "headline": "Bold headline that makes the reader feel the pain of NOT automating this",
  "meta_description": "Under 160 chars. Punchy. Targeting '{template['title'].lower()} computer use'",
  "keywords": ["8-12 keywords targeting this task + computer use"],
  "hero_stat": "{template['stat']}",
  "hero_stat_label": "{template['stat_label']}",
  "content": [
    {{"type": "intro", "text": "open with the pain point. make them feel it."}},
    {{"type": "section", "title": "How Coasty's Computer Use Agent Handles This", "text": "specific explanation with real data"}},
    {{"type": "section", "title": "Why This Beats Everything Else", "bullets": ["sharp benefit 1", "sharp benefit 2", "sharp benefit 3", "sharp benefit 4"]}},
    {{"type": "highlight", "text": "the one stat that makes this a no-brainer"}},
    {{"type": "section", "title": "Real Results", "text": "specific examples of what happens when you automate this"}},
    {{"type": "conclusion", "text": "Direct CTA. Try Coasty free at coasty.ai. No credit card."}}
  ],
  "related_blog_ids": [],
  "related_use_case_slugs": [],
  "related_comparison_slugs": ["anthropic-computer-use", "openai-operator"]
}}"""

        try:
            raw = await self._call_claude_with_tools(system, user_msg)
            page = self._parse_json_response(raw)
            page["published"] = True
            self._strip_em_dashes(page)
            return page
        except Exception as e:
            logger.error(f"SEO page generation failed for {template['slug']}: {e}")
            return None

    # ------------------------------------------------------------------
    # Publishing
    # ------------------------------------------------------------------

    def _publish_blog_post(self, post: dict) -> bool:
        """Upsert a blog post to Supabase."""
        if not self.supabase:
            return False
        try:
            self.supabase.table("blog_posts").upsert(post, on_conflict="id").execute()
            return True
        except Exception as e:
            logger.error(f"Failed to publish blog post {post.get('id')}: {e}")
            return False

    def _publish_seo_page(self, page: dict) -> bool:
        """Upsert an SEO page to Supabase."""
        if not self.supabase:
            return False
        try:
            self.supabase.table("seo_pages").upsert(page, on_conflict="slug").execute()
            return True
        except Exception as e:
            logger.error(f"Failed to publish SEO page {page.get('slug')}: {e}")
            return False

    def _get_existing_blog_ids(self) -> set:
        """Get all existing blog post IDs."""
        if not self.supabase:
            return set()
        try:
            result = self.supabase.table("blog_posts").select("id").execute()
            return {r["id"] for r in (result.data or [])}
        except Exception:
            return set()

    def _get_existing_seo_slugs(self) -> set:
        """Get all existing SEO page slugs."""
        if not self.supabase:
            return set()
        try:
            result = self.supabase.table("seo_pages").select("slug").execute()
            return {r["slug"] for r in (result.data or [])}
        except Exception:
            return set()

    # ------------------------------------------------------------------
    # Main Execution
    # ------------------------------------------------------------------

    async def run_daily_generation(self):
        """Generate and publish today's batch of content."""
        self._init_clients()

        if not self.bedrock_client:
            logger.error("Auto-blog: Bedrock client not available, skipping")
            return
        if not self.supabase:
            logger.error("Auto-blog: Supabase not available, skipping")
            return

        logger.info(f"Auto-blog: Starting daily generation (target: {DAILY_POST_TARGET} posts)")

        existing_ids = self._get_existing_blog_ids()
        logger.info(f"Auto-blog: {len(existing_ids)} existing posts in DB")

        # Shuffle search queries and pick enough for today
        queries = list(SEARCH_QUERIES)
        random.shuffle(queries)

        # Extend with variations if we need more than the predefined list
        while len(queries) < DAILY_POST_TARGET:
            base = random.choice(SEARCH_QUERIES)
            queries.append(f"{base} latest trends")

        published = 0
        failed = 0
        batch_num = 0

        for i in range(0, DAILY_POST_TARGET, POSTS_PER_CYCLE):
            batch_num += 1
            batch_size = min(POSTS_PER_CYCLE, DAILY_POST_TARGET - published)
            batch_queries = queries[i:i + batch_size]
            logger.info(f"Auto-blog: Batch {batch_num} — generating {batch_size} posts (Claude will research via web_search tool)")

            # Generate posts — Claude does its own web research via tool use
            for topic_query in batch_queries:
                try:
                    post = await self._generate_blog_post(topic_query)
                    if not post:
                        failed += 1
                        continue

                    # Deduplicate
                    if post["id"] in existing_ids:
                        post["id"] = f"{post['id']}-{datetime.now().strftime('%Y%m%d')}"

                    if self._publish_blog_post(post):
                        existing_ids.add(post["id"])
                        published += 1
                        logger.info(f"Auto-blog: Published [{published}/{DAILY_POST_TARGET}] {post['id']}")
                    else:
                        failed += 1
                except Exception as e:
                    logger.error(f"Auto-blog: Post generation/publish error: {e}")
                    failed += 1
                    failed += 1

                # Small delay between generations to avoid rate limits
                await asyncio.sleep(2)

            if published >= DAILY_POST_TARGET:
                break

            # Pause between batches
            await asyncio.sleep(CYCLE_DELAY_SECONDS)

        # Also generate SEO pages for any missing templates
        existing_slugs = self._get_existing_seo_slugs()
        pending_seo = [t for t in SEO_PAGE_TEMPLATES if t["slug"] not in existing_slugs]
        seo_to_generate = pending_seo[:SEO_PAGES_PER_DAY]

        seo_published = 0
        for template in seo_to_generate:
            try:
                page = await self._generate_seo_page(template)
                if page and self._publish_seo_page(page):
                    seo_published += 1
                    logger.info(f"Auto-blog: Published SEO page /computer-use/{template['slug']}")
                await asyncio.sleep(2)
            except Exception as e:
                logger.error(f"Auto-blog: SEO page error for {template['slug']}: {e}")

        logger.info(
            f"Auto-blog: Daily generation complete. "
            f"Blog posts: {published} published, {failed} failed. "
            f"SEO pages: {seo_published} published."
        )

    async def start(self):
        """Main loop — runs generation once daily at RUN_HOUR_UTC."""
        logger.info(f"Auto-blog engine started (runs daily at {RUN_HOUR_UTC}:00 UTC)")

        while True:
            try:
                # Calculate time until next run
                now = datetime.now(timezone.utc)
                next_run = now.replace(hour=RUN_HOUR_UTC, minute=0, second=0, microsecond=0)
                if now >= next_run:
                    next_run += timedelta(days=1)

                wait_seconds = (next_run - now).total_seconds()
                logger.info(f"Auto-blog: Next run at {next_run.isoformat()} ({wait_seconds/3600:.1f}h from now)")

                await asyncio.sleep(wait_seconds)

                # Run the generation
                await self.run_daily_generation()

            except asyncio.CancelledError:
                logger.info("Auto-blog engine shutting down")
                break
            except Exception as e:
                logger.error(f"Auto-blog engine error: {e}", exc_info=True)
                # Wait an hour before retrying on error
                await asyncio.sleep(3600)


# Singleton
auto_blog_engine = AutoBlogEngine()
