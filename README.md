<div align="center">

# 💻 Open Computer Use - Autonomous Computer Using Agents at Scale



![Landing Page](assets/landing.png)

### Your AI Agent That Actually Uses Computers Like Humans Do

**Open Computer Use** is an open-source platform that gives AI agents real computer control through browser automation, terminal access, and desktop interaction. Built for developers who want to create truly autonomous AI workflows.

[**Website**](https://coasty.ai) • [**Discord**](https://discord.gg/gppEfsVt) • [**X**](https://x.com/llmhub_dev)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED)](https://www.docker.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)


</div>

## Preview

<p align="center">
  <img src="assets/landing.gif" alt="Main Agent Animation" width="800"/>
</p>

---

## ✨ What Makes This Special?

Unlike traditional AI assistants that only **talk** about tasks, Open Computer Use enables AI agents to **actually perform** them by:

- 🌐 **Browsing the web** like a human (search, click, fill forms, extract data)
- 💻 **Running terminal commands** and managing files
- 🖱️ **Controlling desktop applications** with full UI automation
- 🤖 **Multi-agent orchestration** that breaks down complex tasks
- 🔄 **Streaming execution** with real-time feedback
- 🎯 **100% open-source** and self-hostable

> **"Computer use" capabilities similar to Anthropic's Claude Computer Use, but fully open-source and extensible.**

---

## 🎬 See It In Action

<div align="center">

### Browser Automation
*AI agent searching, navigating, and interacting with websites autonomously*

[![Browser Automation Demo](https://img.shields.io/badge/🎮_Play_Demo-Browser_Automation-blue?style=for-the-badge)](https://coasty.ai/share/2c27ad52-47e0-4ed4-9998-701cebc1c409)

[**▶️ Watch: AI Agent Browsing and Playing**](https://coasty.ai/share/2c27ad52-47e0-4ed4-9998-701cebc1c409)

### Terminal Operations & Development
*Executing commands, managing files, and running complex workflows*

[![Terminal Operations Demo](https://img.shields.io/badge/🎮_Play_Demo-Terminal_Operations-green?style=for-the-badge)](https://coasty.ai/share/6f24c719-868d-4308-9e54-8ab00914761d)

[**▶️ Watch: Quant Trading & Research on QuantConnect**](https://coasty.ai/share/6f24c719-868d-4308-9e54-8ab00914761d)

### Multi-Agent Orchestration
*Complex tasks broken down and executed by specialized agents*

[![Multi-Agent Demo](https://img.shields.io/badge/🎮_Play_Demo-Multi_Agent_System-purple?style=for-the-badge)](https://coasty.ai/share/fb94d739-978b-42f8-81f3-5acaaeb3420f)

[**▶️ Watch: Building Nvidia Options Dashboard**](https://coasty.ai/share/fb94d739-978b-42f8-81f3-5acaaeb3420f)

### Advanced Features
*Human-in-the-loop control and intelligent collaboration*

[![Human Control Demo](https://img.shields.io/badge/🎮_Play_Demo-Human_Control-orange?style=for-the-badge)](https://coasty.ai/share/977166f6-4d5f-4977-904b-603931bd8a8d)

[**▶️ Watch: AI Agent with Human Intervention**](https://coasty.ai/share/977166f6-4d5f-4977-904b-603931bd8a8d)

</div>

---

## 🎯 Core Capabilities

<table>
<tr>
<td width="50%">

### 🌐 Browser Agent

- **Search-first strategy** using Google Search API
- **Smart web navigation** with automatic form filling
- **Element detection** and intelligent clicking
- **Multi-tab management** for parallel workflows
- **Page context extraction** for AI understanding
- **Screenshot capture** for visual verification

</td>
<td width="50%">

### 💻 Terminal Agent

- **Command execution** in isolated environments
- **File operations** (read, write, edit, delete)
- **Directory management** with full control
- **Script execution** (Python, Node.js, bash)
- **Package installation** and environment setup
- **Output streaming** with real-time feedback

</td>
</tr>
<tr>
<td width="50%">

### 🖱️ Desktop Agent

- **UI element detection** using computer vision
- **Mouse and keyboard control** for any application
- **Window management** (focus, resize, arrange)
- **Screenshot analysis** for context awareness
- **OCR capabilities** for text extraction
- **Cross-platform support** (Linux desktop)

</td>
<td width="50%">

### 🤖 Multi-Agent System

- **Task decomposition** by AI planner
- **Sequential execution** with context passing
- **Specialized agents** for different capabilities
- **Error handling** with automatic retries
- **User interaction** when clarification needed
- **Execution reports** with detailed summaries

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js 15)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Chat UI     │  │  Model       │  │  VM          │           │
│  │  Components  │  │  Selection   │  │  Management  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (FastAPI)                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Multi-Agent Executor Service                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │   Planner   │→ │   Browser   │→ │   Terminal  │       │   │
│  │  │    Agent    │  │    Agent    │  │    Agent    │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   WebSocket  │  │   Database   │  │   Billing    │           │
│  │   VM Control │  │   Service    │  │   Service    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               Docker VM (Ubuntu 22.04 + XFCE)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Chrome Browser  │  Terminal  │  Desktop Apps  │  Tools  │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │         WebSocket Agent Server (Port 8080)               │   │
│  │         VNC Server (Port 5900)                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and **npm**
- **Python 3.10+** and **pip**
- **Docker** and **Docker Compose**
- **Supabase** account (free tier works)
- API keys for AI providers (OpenAI, Anthropic, etc.)

### 1. Clone the Repository

```bash
git clone https://github.com/coasty-ai/open-computer-use.git
cd open-computer-use
```

### 2. Set Up Supabase Database

#### Create Supabase Project
1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to finish setting up
3. Go to Project Settings → API to get your keys

#### Run Database Schema
Execute the schema to create all required tables:

```bash
# Option A: Using Supabase Dashboard
# 1. Go to SQL Editor in your Supabase dashboard
# 2. Copy contents of supabase/schema.sql
# 3. Paste and run the SQL

# Option B: Using Supabase CLI (recommended)
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase db push
```

Or manually run the schema file:
```bash
psql -h db.your-project.supabase.co -U postgres -d postgres -f supabase/schema.sql
```

This creates all necessary tables:
- 👤 **Users & Auth**: users, user_preferences, user_keys
- 💬 **Chat System**: chats, messages, chat_participants, chat_attachments
- 🤖 **AI Agents**: machine_sessions, machine_usage, machine_ai_actions
- 💳 **Billing**: user_credits, credit_transactions, stripe_customers, subscription_plans
- 📊 **Projects**: projects, user_machines, machine_snapshots

### 3. Set Up Environment Variables

```bash
# Frontend
cp .env.example .env
# Edit .env with your configuration

# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

#### Required Variables

**Supabase (Required)**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard
SUPABASE_SERVICE_ROLE=your-service-role-key-from-supabase-dashboard
```

**Security Keys (Required)**
```env
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=your-generated-32-byte-hex-string
CSRF_SECRET=your-generated-32-byte-hex-string
```

**Google Search API (Required for web search)**
```env
GOOGLE_SEARCH_KEY=your-google-api-key
GOOGLE_SEARCH_CX=your-custom-search-engine-id
```
Get these from [Google Cloud Console](https://console.cloud.google.com/):
1. Enable Custom Search API
2. Create API key
3. Create Custom Search Engine at [programmablesearchengine.google.com](https://programmablesearchengine.google.com/)

**AI Provider Keys (Choose at least one)**
```env
# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Azure OpenAI (Optional)
AZURE_OPENAI_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

**Azure Container Instances (Optional - for cloud VM deployment)**
```env
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP=your-resource-group
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
AZURE_CONTAINER_REGISTRY=your-registry.azurecr.io
AZURE_DESKTOP_IMAGE=your-registry.azurecr.io/ai-desktop:latest
```

**Stripe (Optional - for billing)**
```env
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 4. Install Dependencies

```bash
# Frontend
npm install

# Backend
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 5. Start Development Servers

**Option A: Using Docker (Recommended)**

```bash
# Start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend: http://localhost:8001
```

**Option B: Manual Start**

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd backend
python main.py

# Terminal 3: AI Desktop (if needed)
docker-compose -f docker-compose.ai-desktop.yml up --build
```

### 6. Create Your First Agent Session

1. Open http://localhost:3000
2. Sign up / Log in with Supabase Auth
3. Start a new chat
4. Try a command: *"Search for the latest AI news and summarize the top 3 articles"*
5. Watch your AI agent work! 🎉

---

## 🎨 Features

### Multi-Provider AI Support

Connect your own API keys and switch between providers mid-conversation:

- ✅ **OpenAI** (GPT-4, GPT-4 Turbo, GPT-3.5)
- ✅ **Anthropic** (Claude 3.5 Sonnet, Claude 3 Opus)
- ✅ **Google** (Gemini Pro, Gemini 1.5)
- ✅ **Azure OpenAI** (Enterprise deployments)
- ✅ **xAI** (Grok models)
- ✅ **Mistral AI** (Mistral Large, Mixtral)
- ✅ **Perplexity** (Online models)
- ✅ **OpenRouter** (Access to 100+ models)

### Bring Your Own Keys (BYOK)

All API keys are encrypted and stored securely. You maintain full control over your AI costs and usage.

### Real-Time Streaming

Watch your agents work in real-time with:
- 📊 **Task progress indicators**
- 🛠️ **Tool call visualization**
- 📸 **Live screenshots** from VM
- 💬 **Streaming responses**
- 📋 **Detailed execution logs**

### Advanced Task Planning

The AI automatically:
1. **Analyzes** your request
2. **Breaks down** into subtasks
3. **Assigns** to specialized agents
4. **Executes** with full context
5. **Reports** detailed results

### Secure VM Isolation

Each agent session runs in an isolated Docker container:
- 🔒 **Sandboxed execution** environment
- 🔄 **Ephemeral containers** (no data persistence)
- 🌐 **Network isolation** options
- 📊 **Resource limits** and monitoring

---

## 📚 Use Cases

<table>
<tr>
<td>

### 🔍 Research & Data Gathering

- Web scraping and data extraction
- Competitive analysis
- Market research automation
- Academic paper collection

</td>
<td>

### 🧪 Testing & QA

- Automated UI testing
- Cross-browser testing
- E2E test generation
- Regression testing

</td>
</tr>
<tr>
<td>

### 📝 Content Creation

- Screenshot and documentation
- Tutorial generation
- Workflow recording
- Demo creation

</td>
<td>

### 🔧 DevOps & Automation

- Server configuration
- Deployment automation
- Log analysis
- System monitoring

</td>
</tr>
<tr>
<td>

### 🛒 E-commerce Operations

- Price monitoring
- Product research
- Order management
- Inventory tracking

</td>
<td>

### 📊 Business Intelligence

- Report generation
- Dashboard monitoring
- Data analysis workflows
- KPI tracking

</td>
</tr>
</table>

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router, React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: Zustand
- **AI SDK**: Vercel AI SDK
- **Database**: Supabase (Auth + Postgres)
- **Payments**: Stripe

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Async Runtime**: asyncio, uvicorn
- **WebSocket**: websockets library
- **AI Providers**: openai, anthropic, google-generativeai
- **Search**: Google Custom Search API
- **Caching**: Redis (optional)
- **Image Processing**: Pillow, ImageMagick

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **VM Environment**: Ubuntu 22.04 LTS + XFCE
- **Browser**: Google Chrome (with remote debugging)
- **Automation**: Selenium, Playwright, PyAutoGUI
- **Cloud**: Azure Container Instances (optional)

---

## 🤝 Contributing

We love contributions! Here's how you can help:

### 🐛 Found a Bug?

Open an [issue](https://github.com/coasty-ai/open-computer-use/issues) with:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Screenshots or logs

### 💡 Have a Feature Idea?

1. Check if it's already [requested](https://github.com/coasty-ai/open-computer-use/issues)
2. Open a new issue with the `enhancement` label
3. Describe your use case and proposed solution

### 🔧 Want to Contribute Code?

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Write tests if applicable
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

**Please read our [Contributing Guide](CONTRIBUTING.md) for detailed guidelines.**

---

## 📖 Documentation

- 💬 [**Discord Community**](https://discord.gg/GvdmvpJy)

---

## 🗺️ Roadmap

### Q1 2026
- [ ] Multi-VM orchestration (parallel agents)
- [ ] Advanced workflow builder (visual programming)
- [ ] Marketplace for custom agents
- [ ] Windows and macOS VM support
- [ ] Mobile app (iOS/Android)

### Q2 2026
- [ ] Plugin system for custom tools
- [ ] Collaborative agent sessions
- [ ] Advanced analytics dashboard
- [ ] Enterprise SSO support
- [ ] Self-hosted cloud deployment guides

### Future
- [ ] Voice control integration
- [ ] Video understanding capabilities
- [ ] Agent memory and learning
- [ ] Multi-modal agent interactions
- [ ] Community agent templates

**Vote on features**: [Feature Requests](https://github.com/coasty-ai/open-computer-use/discussions)

---

## 📊 Performance & Benchmarks

| Metric | Value |
|--------|-------|
| **Average Task Completion** | ~45 seconds |
| **Concurrent Sessions** | 50+ (per server) |
| **Browser Navigation** | ~2s per page |
| **Tool Call Latency** | <500ms |
| **VM Startup Time** | ~15 seconds |
| **Memory per Session** | ~2GB |

*Benchmarks measured on: 4 CPU cores, 8GB RAM, SSD storage*

---

## ⚠️ Responsible AI Use

Open Computer Use gives AI agents significant autonomy. Please use responsibly:

- ✅ **Do**: Automate repetitive tasks, research, testing, content creation
- ❌ **Don't**: Violate terms of service, spam, scrape without permission
- 🔒 **Security**: Never share credentials, use isolated environments
- 📋 **Compliance**: Follow data protection laws (GDPR, CCPA, etc.)
- 🤝 **Ethics**: Respect website robots.txt and rate limits

**Read our [Responsible Use Guidelines](RESPONSIBLE_USE.md) for more details.**

---

## 📄 License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

```
Apache License 2.0

Copyright (c) 2025 Open Computer Use Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## 🙏 Acknowledgments

Built with amazing open-source projects:

- [Next.js](https://nextjs.org/) - The React Framework
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [Vercel AI SDK](https://sdk.vercel.ai/) - AI toolkit for TypeScript
- [Radix UI](https://www.radix-ui.com/) - Unstyled, accessible components
- [Anthropic](https://www.anthropic.com/) - Inspiration from Claude Computer Use
- [Docker](https://www.docker.com/) - Containerization platform

Special thanks to all our [contributors](https://github.com/coasty-ai/open-computer-use/graphs/contributors)! 💙

---

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=coasty-ai/open-computer-use&type=Date)](https://star-history.com/#coasty-ai/open-computer-use&Date)

---

## 💬 Community & Support

- 💬 **Discord**: Join our [community server](https://discord.gg/GvdmvpJy)
- 🐦 **Twitter**: Follow [@llmhub_dev](https://x.com/llmhub_dev)
- 📧 **Email**: prateek@coasty.ai
- 🐛 **Issues**: [GitHub Issues](https://github.com/coasty-ai/open-computer-use/issues)
- 💡 **Discussions**: [GitHub Discussions](https://github.com/coasty-ai/open-computer-use/discussions)

---

<div align="center">

### ⭐ Star us on GitHub if you find this useful!

Made with ❤️ by the Open Computer Use community

[**Star on GitHub**](https://github.com/coasty-ai/open-computer-use) • [**Join Discord**](https://discord.gg/GvdmvpJy)

</div>
