# 🏗️ App Architect Studio: Autonomous Codebase Orchestrator

[![Deployed on Google Cloud Run](https://img.shields.io/badge/Deployed-Google%20Cloud%20Run-blue?logo=googlecloud)](https://app-architect-orchestrator-913336154788.us-central1.run.app)
[![Powered by Google GenAI](https://img.shields.io/badge/Powered%20by-Google%20GenAI-orange?logo=google)](https://cloud.google.com/vertex-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

**App Architect Studio** is an event-driven, headless AI agent designed to independently scaffold, configure, and package complete, production-ready full-stack architectures. 

Built specifically for the **Taskmaster** hackathon track, it continuously listens for real-world triggers (such as GitHub Issues, Zapier events, or Discord messages), autonomously chains API actions, and delivers live preview environments without requiring human walkthroughs.

---

## 📖 Table of Contents
- [The Taskmaster Engine (Autonomous Mode)](#-the-taskmaster-engine-autonomous-mode)
- [System Architecture](#-system-architecture)
- [Core Enterprise Features](#-core-enterprise-features)
- [Tech Stack](#-tech-stack)
- [Reproducible Setup](#-reproducible-setup)
- [Setting up the Autonomous Webhook](#-setting-up-the-autonomous-webhook)

---

## 🤖 The Taskmaster Engine (Autonomous Mode)

Unlike standard chatbot code generators that require constant user prompting, App Architect Studio operates as a **continuous background worker**. 

It self-triggers off external payloads using a dedicated webhook route (`/api/webhook/trigger`). When a user submits a project specification (e.g., by opening a new GitHub Issue), the agent:
1. Catches the payload autonomously.
2. Architects the `package.json`, `server.js`, and modular frontend structures.
3. Implements strict **Twelve-Factor App** environment variable standards.
4. Commits the fully structured codebase to Google Cloud Firestore.
5. Generates a live, static preview URL and a downloadable `.zip` package.

---

## 🗺️ System Architecture

```text
[External Triggers]           [Cloud Run]                     [Google Cloud]
 GitHub Issues  ──┐                                          
 Discord Webhook ─┼─ POST ─> [ Express.js Backend ] ───> [@google/genai API]
 Zapier Event   ──┘                 │                          │
                                    │ (App Scaffolding)        │ (LLM Logic)
[Human-in-the-Loop]                 v                          │
 Web UI / Gateway ── POST ─> [ Active Session State ] <────────┘
                                    │
                                    v
                             [ Firestore DB ] ──> Stores generated architectures
                                    │
                                    v
[Delivery]                   [ Live Preview ] & [ Source Code .ZIP ]

```

---

## 🔐 Core Enterprise Features

* **Continuous Improvement (CI/CD) Loop:** Because the application utilizes Firestore for stateful memory, it handles iterative updates dynamically. If a user replies to a GitHub Issue with new feature requests, the webhook fetches the existing architecture from the database, applies the diff via the GenAI SDK, and overwrites the static preview. It doesn't just chat—it continuously integrates.
* **Zero-Hallucination Guardrails:** The agent is strictly forbidden from writing "sandbox" or mock connection logic. It writes raw `window.ethereum` try/catch blocks for Web3 dApps and raw `pg`/`stripe` modules for Web2 SaaS platforms.
* **Twelve-Factor Secrets Management:** To maintain absolute security, the agent never asks users to input raw API keys into chat logs or UI forms. It automatically generates robust `.env.example` placeholders, shifting secret configuration to the secure deployment phase (e.g., Vercel, Heroku, or local `.env`).
* **Asynchronous Clarification:** If an incoming prompt is critically ambiguous (e.g., missing the target blockchain ecosystem), the active session gracefully pauses, catches the necessary context via the HTTP continuation route, and seamlessly resumes the build pipeline.

---

## 🛠️ Tech Stack

* **AI Engine:** Google Gemini (`@google/genai` unified SDK)
* **Backend:** Node.js, Express.js
* **Database:** Google Cloud Firestore
* **Deployment:** Google Cloud Run (Serverless, Event-Driven)
* **Frontend:** HTML5, Tailwind CSS, JSZip (Client-side packaging)

---

## 🚀 Reproducible Setup

### 1. Local Development

Clone the repository and install the dependencies:

```bash
git clone [https://github.com/your-username/app-architect-studio.git](https://github.com/your-username/app-architect-studio.git)
cd app-architect-studio
npm install

```

Start the interactive local CLI engine:

```bash
npm start

```

### 2. Google Cloud Deployment

To deploy your own instance of the Orchestrator, use Google Cloud Run. The service relies on Application Default Credentials (ADC), eliminating the need for local `.json` key files.

```bash
gcloud run deploy app-architect-orchestrator \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances=2 \
  --min-instances=0

```

---

## 📡 Setting up the Autonomous Webhook

To enable continuous autonomous building via GitHub:

1. Navigate to your target repository's **Settings > Webhooks**.
2. Click **Add webhook**.
3. Set the Payload URL to your deployed Cloud Run endpoint: `https://[YOUR-CLOUD-RUN-URL]/api/webhook/trigger`
4. Set the Content type to `application/json`.
5. Under "Which events would you like to trigger this webhook?", select **Let me select individual events**, and check **Issues**.
6. Open a new issue with your application specifications in the body, and watch the agent build it silently in the background!

---

## 👨‍💻 Maintainer

Built by **Ebubechukwu Fredrick Okolie** for the AI Agent Builder Hackathon.