
#  App-Architect-Agent
> **Autonomous Full-Stack AI Engineer & Cloud Architecture Orchestrator**

An event-driven autonomous developer agent powered by Gemini 3.5 Flash on Google Cloud Run. App-Architect-Agent operates seamlessly across two environments: listening to GitHub issues as a headless Taskmaster, and providing a real-time Interactive Web Studio. It evaluates technical requirements, translates visual wireframes into code, resolves missing architectural pillars via batched clarifications, and scaffolds production-ready full-stack applications with instant live previews and source code downloads.

---

##  Key Features

* **Dual-Interface Orchestration:** Operates natively in two modes. It acts as a headless Taskmaster responding to GitHub webhook events, and as a Collaborative Partner accessed directly via a deployed Web Studio dashboard.
* **Multimodal Wireframe Translation:** Process UI screenshots, architectural diagrams, and wireframes directly through the Web Studio, instructing the agent to replicate component trees and CSS layouts perfectly.
* **Architectural Ambiguity Detection:** Identifies missing foundational pillars (e.g., Web3 target ecosystems or Web2 persistence models) and requests batched clarification in a single professional turn before building.
* **Stateful Multi-Turn Session Memory:** Tracks and resumes conversational sessions across stateless Cloud Run instances using Google Cloud Firestore, injecting unique `Session IDs` directly into GitHub comments and Web UI payloads.
* **Unified API Gateway:** The Google Cloud Run Express server acts as a centralized brain, routing traffic from both the Web UI and GitHub issues through the exact same Vertex AI generation loops and Firestore memory banks.
* **Enterprise Webhook Security:** Validates incoming payloads using raw-body HMAC-SHA256 signature verification (`X-Hub-Signature-256`) with strict timing-attack mitigation.
* **Multi-Region Model Failover:** Implements dynamic fallback loops across multiple Google Cloud regions to ensure high availability and prevent quota-induced interruptions during massive payload generations.
* **Dual-Environment ZIP Packaging:** Dynamically bundles directory trees into `.zip` archives using Node.js `JSZip` for webhook downloads, and CDN-based client-side `JSZip` for Web Studio downloads—eliminating disk writes and optimizing server load.
* **Isolated Live Previews:** Serves instant interactive UI previews through dedicated middleware without requiring external compiler instances.

---

##  Architecture & Tech Stack

```mermaid
graph LR
    classDef gcp fill:#4285F4,stroke:#fff,stroke-width:2px,color:#fff;
    classDef github fill:#24292e,stroke:#fff,stroke-width:2px,color:#fff;
    classDef user fill:#34A853,stroke:#fff,stroke-width:2px,color:#fff;
    classDef ai fill:#EA4335,stroke:#fff,stroke-width:2px,color:#fff;
    classDef web fill:#F4B400,stroke:#fff,stroke-width:2px,color:#fff;

    UserIn((Developer\nInput)):::user
    UserOut((Developer\nOutput)):::user

    GitHub[GitHub Repository]:::github
    WebUI[Web Dashboard\nMultimodal UI]:::web
    ClientJSZip[Client-Side JSZip\nBrowser CDN]:::web

    subgraph Google Cloud Environment
        CloudRun(Express API Gateway\nGoogle Cloud Run):::gcp
        Firestore[(Cloud Firestore\nSession Memory)]:::gcp
        VertexAI{Gemini 3.5 Flash\nVertex AI SDK}:::ai
        ServerJSZip[Server-Side JSZip\nNode.js]:::gcp
    end

    UserIn -->|1a. Creates Issue| GitHub
    GitHub -->|Webhook Trigger| CloudRun

    UserIn -->|1b. Prompts & Wireframes| WebUI
    WebUI -->|REST API Calls\n/build, /continue, /update| CloudRun

    CloudRun -->|2. Fetches/Saves Context| Firestore
    CloudRun -->|3. Prompts AI via Fallback| VertexAI
    VertexAI -.->|Tool Calls| CloudRun

    CloudRun -->|4a. Posts Links| GitHub
    CloudRun -->|4b. Returns JSON Payload| WebUI

    GitHub -->|5a. Clicks Download .zip| ServerJSZip
    WebUI -->|5b. Clicks UI Download| ClientJSZip
    
    ServerJSZip -->|Streams .zip Archive| UserOut
    ClientJSZip -->|Triggers Local Download| UserOut

```

* **Core Runtime:** Node.js, Express, TypeScript
* **AI Model & SDK:** Gemini 3.5 Flash (Text & Vision) via `@google/genai` (Vertex AI integration)
* **Database & Persistence:** Google Cloud Firestore
* **Compute & Hosting:** Google Cloud Run (Serverless Container)
* **Packaging & Security:** JSZip, Node.js Crypto (Timing-Safe HMAC), Google Cloud Secret Manager

---

## 🚦 Local Development (CLI Mode)

You can run the agent locally with its built-in interactive multi-turn CLI:

1. **Clone the repository:**

```bash
git clone https://github.com/Ricks0ne/App-Architect-Agent.git
cd App-Architect-Agent

```

2. **Install dependencies:**

```bash
npm install

```

3. **Authenticate & Configure Environment:**
Ensure you have the Google Cloud CLI installed, authenticate your local credentials, and create a `.env` file with your project ID and GitHub webhook credentials:

```bash
gcloud auth application-default login
echo "GOOGLE_CLOUD_PROJECT=your-project-id" > .env
echo "GITHUB_TOKEN=your_personal_access_token" >> .env
echo "GITHUB_WEBHOOK_SECRET=your_secure_webhook_secret" >> .env

```

*(Windows Users: You can manually create the `.env` file in the project root and add the variables above).*

4. **Run the Engine:**

```bash
npm start

```

---

##  Deployment to Google Cloud Run

This application utilizes Google Cloud Secret Manager for enterprise-grade security, ensuring API keys are never exposed in plaintext environment variables or revision histories.

1. **Create Secrets:** In your GCP Console, navigate to Secret Manager and create two secrets named `github-token` and `github-webhook-secret` containing your actual credentials.
2. **Deploy the Container:** Run the following command to deploy the orchestrator and securely mount the secrets:

```bash
gcloud run deploy app-architect-orchestrator \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --max-instances=2 \
  --min-instances=0 \
  --no-cpu-throttling \
  --remove-env-vars="GITHUB_TOKEN,GITHUB_WEBHOOK_SECRET" \
  --set-secrets="GITHUB_TOKEN=github-token:latest,GITHUB_WEBHOOK_SECRET=github-webhook-secret:latest"

```

---

##  Autonomous GitHub Workflow

1. **Configure Repository Webhook:** In your GitHub repository settings, navigate to Webhooks. Add a new webhook with the Payload URL set to `https://<YOUR_CLOUD_RUN_URL>/api/webhook/trigger`, select `application/json` as the content type, and paste your `GITHUB_WEBHOOK_SECRET`.
2. **Create an Issue:** Open an issue in your repository describing your desired application (e.g., *"Build a decentralized token staking platform with a dark theme"*).
3. **Clarification Turn (If Ambiguous):** If key architectural pillars are missing, the agent intercepts the build, replies with a structured checklist, and embeds a unique `Session ID`.
4. **Resume Session:** Reply directly to the comment with your preferences. The agent parses the `Session ID`, loads the saved conversational state from Firestore, and resumes the workflow.
5. **Instant Delivery:** Upon successful scaffolding, the agent posts a final comment containing the Firestore Record ID, an interactive Live Preview URL, and a direct `.zip` download link.

---

##  Interactive Web Studio Workflow

1. **Access the Dashboard:** Navigate to the deployed Cloud Run `.run.app` URL.
2. **Upload & Generate:** Enter your architectural requirements and optionally upload visual wireframes or UI screenshots. The orchestrator will process the multimodal prompt through Vertex AI and return a live preview.
3. **Iterative Refinement:** If the architecture needs adjustments, use the update input (and attach new reference images if needed). The agent reads the existing in-memory file tree and surgically updates specific components without losing prior context.
4. **Live Preview & Export:** Interact directly with the rendered UI or download the `.zip` source code.
