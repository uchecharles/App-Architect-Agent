import { GoogleGenAI } from '@google/genai';
import { Firestore } from '@google-cloud/firestore';
import * as path from 'path';
import * as readline from 'readline';
import dotenv from 'dotenv';
import express from 'express';
import { randomUUID, timingSafeEqual, createHmac } from 'crypto';
import JSZip from 'jszip';

dotenv.config();

// Strict reliance on Application Default Credentials
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'your-google-cloud-project-id';
const db = new Firestore({ projectId });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const agentTools = [{
  functionDeclarations: [
    {
      name: "askUserForClarification",
      description: "Call this tool if structural specifications, network ecosystems (EVM vs Solana), or core app requirements are completely ambiguous. DO NOT use this for API keys or secrets.",
      parameters: {
        type: "OBJECT",
        properties: {
          questionToAsk: { type: "STRING" }
        },
        required: ["questionToAsk"]
      }
    },
    {
      name: "buildFullStackApp",
      description: "Call this tool to generate OR update the codebase.",
      parameters: {
        type: "OBJECT",
        properties: {
          appName: { type: "STRING" },
          files: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                filename: { type: "STRING" },
                code: { type: "STRING" }
              },
              required: ["filename", "code"]
            }
          }
        },
        required: ["appName", "files"]
      }
    }
  ]
}];

// Casting a wide net to find active Gemini 3.5 Flash provision
const fallbackConfigs = [
  { location: 'asia-southeast1', model: 'gemini-3.5-flash' },
  { location: 'us-east4', model: 'gemini-3.5-flash' },
  { location: 'us-east1', model: 'gemini-3.5-flash' },
  { location: 'us-west1', model: 'gemini-3.5-flash' },
  { location: 'us-west4', model: 'gemini-3.5-flash' },
  { location: 'europe-west4', model: 'gemini-3.5-flash' },
  { location: 'europe-west1', model: 'gemini-3.5-flash' }
];

// THE FINAL BRAIN: Twelve-Factor App + Environment-Aware Preview Logic + Strict Clarification
const systemInstruction = `You are an elite Senior Full-Stack Architect. Scaffold robust, production-ready codebases for ANY domain.

CRITICAL DIRECTIVES:
1. FULL-STACK ARCHITECTURE: Generate a complete codebase using the BEST modern tools (e.g., package.json, server.js, Vite, React .jsx in a modular 'src/' structure).
2. PREVENT SECRET LEAKAGE: NEVER ask the user for real API keys, database URLs, or secrets. Hardcode environment variable calls (e.g., process.env.STRIPE_SECRET_KEY) directly into the code. 
3. PLACEHOLDER CONFIGS: You MUST generate a '.env.example' file containing the exact placeholder keys needed for the app.
4. DEPLOYMENT README: Generate a detailed 'README.md' with instructions for local '.env' setup. Also include instructions for production deployment on hosting platforms (using Google Cloud Run, Vercel, Netlify, or Render as examples), explicitly explaining how users must insert their real secret keys into the platform's "Environment Variables" section to replace the placeholders.
5. NO MOCK SIMULATIONS: Write the ACTUAL connection logic (EVM, Solana, Postgres, Stripe, etc.). Gracefully catch errors if variables are missing.
6. PREVIEW ENVIRONMENT AWARENESS (CRITICAL): The live preview runs on a static Express server without a Node.js compiler. 
   - IF you build a vanilla HTML/JS app (or use CDNs), write the functional UI in 'public/index.html' so it previews perfectly.
   - IF you build an app requiring a build step (Vite, Next.js, raw JSX), the 'public/index.html' MUST NOT be a fake UI replica. Instead, it must be a beautifully styled "Build Required" landing page explaining that the codebase utilizes a modern build pipeline. Instruct the user to download the .zip and run 'npm install && npm run dev' locally, or deploy it to a hosting platform to view the application.
7. MANDATORY CLARIFICATION (CRITICAL PILLARS - WEB2 & WEB3): You must act as a precise, senior architect. If a prompt is missing a critical foundational pillar, you MUST invoke 'askUserForClarification':
   - For Web3: Target blockchain ecosystem (EVM vs. Solana vs. others) or wallet/contract integration model.
   - For Web2: Target persistence/architecture model when ambiguous (e.g., Full-Stack with PostgreSQL vs. NoSQL/MongoDB vs. Pure Client-Side SPA) or missing core business domain.
   - UX RULE: Do NOT act like a chatty bot. Ask ALL required clarifying questions in a SINGLE, professional, bulleted message.
   - DEFAULT RULE: If the core purpose and foundational stack are provided (e.g., "React task manager with Postgres" or "Solana NFT staking UI"), do NOT ask follow-ups. Assume industry defaults for secondary tools (e.g., Tailwind CSS, Express, TypeScript) and immediately invoke 'buildFullStackApp'.

Invoke 'buildFullStackApp' to generate the files.`;

// Extend Express Request to hold the raw Buffer for GitHub signature validation
declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}

const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf; // Capture raw body for HMAC verification
  }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// 🌍 SAFE LIVE PREVIEW MIDDLEWARE
// ==========================================
app.use('/preview/:id', async (req, res, next) => {
  try {
    const docId = req.params.id;
    const assetPath = req.path; 

    const docRef = await db.collection('generated_fullstack_apps').doc(docId).get();
    if (!docRef.exists) return res.status(404).send('<h1>404 - Architecture Not Found</h1>');
    
    const data = docRef.data();
    const files = data?.files || {};
    
    if (assetPath === '/' || assetPath === '') {
      const htmlContent = files['public_index_html'] || files['index_html'] || files['public_index_htm'];
      if (!htmlContent) return res.status(404).send('<h1>404 - No HTML Entry Point Found</h1>');
      
      const baseTag = `<base href="/preview/${docId}/">`;
      const finalHtml = htmlContent.includes('<head>') ? htmlContent.replace('<head>', `<head>\n  ${baseTag}`) : `${baseTag}\n${htmlContent}`;
      res.setHeader('Content-Type', 'text/html');
      res.send(finalHtml);
    } else {
      const safeAssetKey = assetPath.replace(/^\//, '').replace(/[\.\/]/g, '_');
      const fileContent = files[safeAssetKey] || files[`public_${safeAssetKey}`];
      if (!fileContent) return res.status(404).send('Asset not found');
      res.type(path.extname(assetPath) || 'text/plain');
      res.send(fileContent);
    }
  } catch (error) {
    res.status(500).send('Internal Server Error while loading preview.');
  }
});

app.get('/api/download-data/:id', async (req, res) => {
  try {
    const docRef = await db.collection('generated_fullstack_apps').doc(req.params.id).get();
    if (!docRef.exists) return res.status(404).json({ error: 'Project not found' });
    return res.status(200).json({ appName: (docRef.data()?.appName || 'project').replace(/[^a-zA-Z0-9-_]/g, '_'), files: docRef.data()?.rawFiles || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================
// 📦 DIRECT ZIP DOWNLOAD ROUTE (Using JSZip)
// ==========================================
app.get('/api/download/:id', async (req, res) => {
  try {
    const docId = req.params.id;
    const docRef = await db.collection('generated_fullstack_apps').doc(docId).get();

    if (!docRef.exists) {
      return res.status(404).send('<h1>404 - Architecture Not Found</h1>');
    }

    const data = docRef.data();
    const rawFiles = data?.rawFiles || [];
    const appName = (data?.appName || `architecture_${docId}`).replace(/[^a-zA-Z0-9-_]/g, '_');

    // Initialize JSZip
    const zip = new JSZip();

    // Loop through files and add them to the zip instance
    rawFiles.forEach((file: any) => {
      if (file.filename && file.code) {
        zip.file(file.filename, file.code);
      }
    });

    // Generate the zip file as a Node.js Buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Set headers to trigger a file download in the browser
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${appName}.zip"`);
    
    // Send the compiled zip file
    res.send(zipBuffer);

  } catch (error) {
    console.error('[ZIP Route Error]', error);
    res.status(500).send('Internal Server Error while generating ZIP.');
  }
});

// ==========================================
// 🤖 AUTONOMOUS WEBHOOK ROUTE (Taskmaster Headless Build)
// ==========================================
app.post('/api/webhook/trigger', async (req, res) => {
  // 1. Acknowledge GitHub's initial setup "ping" event
  if (req.headers['x-github-event'] === 'ping') {
    return res.status(200).send('Pong! Webhook successfully connected.');
  }

  // 2. Strict Security Check (HMAC-SHA256 Verification)
  const githubSignature = req.headers['x-hub-signature-256'] as string;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!githubSignature || !webhookSecret || !req.rawBody) {
    return res.status(401).json({ error: 'Unauthorized: Missing signature, secret, or raw body.' });
  }

  try {
    const expected = 'sha256=' + createHmac('sha256', webhookSecret).update(req.rawBody).digest('hex');
    const sigBuf = Buffer.from(githubSignature);
    const expBuf = Buffer.from(expected);

    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      console.warn('🚨 Webhook signature mismatch detected!');
      return res.status(401).json({ error: 'Unauthorized: Invalid signature.' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Signature verification failed.' });
  }

  // 3. Extract the text and GitHub metadata
  const externalSpec = req.body?.comment?.body || req.body?.issue?.body || req.body?.message?.content || req.body?.text;
  const issueNumber = req.body?.issue?.number;
  const repoFullName = req.body?.repository?.full_name;

  if (!externalSpec) {
    return res.status(202).send('Event received, but no actionable code specification found.');
  }

  // 🛑 INFINITE LOOP FIX: Ignore the bot's own replies
  if (externalSpec.includes('✅ **Autonomous Architecture Scaffolded!**') || externalSpec.includes('🤔 **I need a little more detail before I can build this:**')) {
    console.log('Skipping webhook: Detected bot signature to prevent infinite loop.');
    return res.status(200).send('Bot reply ignored.');
  }

  // 4. TIMEOUT FIX: Respond IMMEDIATELY to satisfy GitHub's 10-second rule
  res.status(202).send('Webhook accepted! Autonomous agent is building in the background...');

  // 5. Run the Heavy AI Generation in the Background with DYNAMIC FALLBACK
  console.log(`\n🤖 [Webhook Received] Executing headless architecture...`);

  // Wrap the background process in an async immediately invoked function
  (async () => {
    let result = null;
    let chat = null;
    let previousId: string | null = null;
    let activeSessionId: string | null = null;
    let resumeHistory: any[] | null = null;
    let targetAppName: string | null = null;
    let targetDocumentId: string | null = null;
    
    let memoryPrompt = `AUTONOMOUS TRIGGER: A user submitted this spec via an external webhook. Evaluate the architecture against your critical clarification directives before building. Spec: ${externalSpec}`;

    // --- 🧠 STATEFUL MEMORY CHECK (Handles both Session Resumption and Code Updates) ---
    if (issueNumber && repoFullName && process.env.GITHUB_TOKEN) {
      try {
        console.log(`[Memory] Checking GitHub thread #${issueNumber} for previous context...`);
        const commentsRes = await fetch(`https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/comments`, {
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'App-Architect-Agent'
          }
        });
        
        const comments = await commentsRes.json();
        
        // Find bot comments that contain EITHER a Session ID or a Record ID
        const botComments = comments.filter((c: any) => c.body && (c.body.includes('Session ID:') || c.body.includes('Firestore Record ID:')));
        
        if (botComments.length > 0) {
          const lastBotComment = botComments[botComments.length - 1].body;
          
          const sessionMatch = lastBotComment.match(/Session ID:\*\*\s*\`([a-zA-Z0-9_-]+)\`/);
          const recordMatch = lastBotComment.match(/Firestore Record ID:\*\*\s*\`([a-zA-Z0-9_-]+)\`/);

          // SCENARIO A: Resuming an active clarification session
          if (sessionMatch && sessionMatch[1]) {
            const sId = sessionMatch[1];
            const sessionDoc = await db.collection('agent_sessions').doc(sId).get();
            
            if (sessionDoc.exists) {
              const sData = sessionDoc.data();
              activeSessionId = sId;
              resumeHistory = sData?.history || [];
              targetAppName = sData?.appName || null;
              targetDocumentId = sData?.targetDocumentId || null;
              console.log(`[Memory] Resuming active clarification session: ${activeSessionId}`);
              
              // Only pass the user's explicit reply, drop the autonomous wrapper prompt when resuming
              memoryPrompt = externalSpec; 
            }
          } 
          // SCENARIO B: Updating an existing, already-built architecture
          else if (recordMatch && recordMatch[1]) {
            previousId = recordMatch[1];
            console.log(`[Memory] Found previous architecture state to update: ${previousId}`);
            
            const previousDoc = await db.collection('generated_fullstack_apps').doc(previousId).get();
            if (previousDoc.exists) {
               const previousCode = previousDoc.data();
               
              // 🛡️ ANTI-LAZINESS PROMPT: Force the AI to return ALL files
               memoryPrompt = `You are refining an existing codebase. 
               
               PREVIOUS CODEBASE STATE: 
               ${JSON.stringify(previousCode.rawFiles || previousCode, null, 2)}
               
               USER UPDATE REQUEST: "${externalSpec}"
               
               CRITICAL INSTRUCTION: You MUST invoke the 'buildFullStackApp' tool and output the ENTIRE updated codebase. You must include ALL files in your response (both the files you modified AND the files you left completely untouched). If you omit any previously existing file from your response, it will be PERMANENTLY DELETED from the user's project and the app will break. Do not use placeholders for unchanged code.`;
            }
          }
        }
      } catch (err) {
        console.warn('[Memory Warning] Could not fetch previous thread history.', err);
      }
    }
    // ---------------------------------

    // 🔥 THIS IS THE MAGIC LOOP: It tests every region in your array!
    for (const config of fallbackConfigs) {
      try {
        console.log(`Testing model availability in ${config.location}...`);
        
        const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: config.location });
        
        // Inject history if we recovered a session
        chat = ai.chats.create({ 
          model: config.model, 
          history: resumeHistory || undefined,
          config: { tools: agentTools as any, systemInstruction } 
        });
        
        result = await chat.sendMessage({ message: memoryPrompt });
        console.log(`🤖 [Success] Generated via ${config.model} in ${config.location}!`);
        
        break; // Stop looping! We found a working region and built the code.

      } catch (err) {
        console.warn(`[Fallback] Failed on ${config.location}. Moving to next region...`);
      }
    }

    // If the loop finished and result is still null, EVERY region failed.
    if (!result || !chat) {
      console.error('[Webhook Error] All model configurations and regions failed.');
      if (issueNumber && repoFullName && process.env.GITHUB_TOKEN) {
        await fetch(`https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/comments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'App-Architect-Agent' 
          },
          body: JSON.stringify({ body: `❌ **Build Failed:** All regional Vertex AI models are currently overwhelmed or unavailable. Please try your request again later.` })
        }).catch(err => console.error('[GitHub API Error]', err));
      }
      return; 
    }

    // Capture output silently
    const mockRes = {
      status: () => mockRes,
      json: (data: any) => data
    } as any;

    const appNameFallback = targetAppName || `webhook_build_${Date.now()}`;
    const effectiveTargetDocId = targetDocumentId || previousId || undefined;
    
    const responseData = await handleAgentResponse(
      result, 
      chat, 
      appNameFallback, 
      mockRes, 
      activeSessionId || undefined, 
      effectiveTargetDocId
    );
    
    // --- 🛠️ GITHUB REPLY LOGIC ---
    if (issueNumber && repoFullName && process.env.GITHUB_TOKEN) {
      let replyMessage = '';

      if (responseData?.status === 'needs_clarification') {
        // Embed the Session ID right into the GitHub comment so we can extract it on the next webhook trigger
        replyMessage = `🤔 **I need a little more detail before I can build this:**\n\n${responseData.question}\n\n*(Reply directly to this comment to clarify!)*\n\n🔑 **Session ID:** \`${responseData.sessionId}\``;
      } else if (responseData?.documentId) {
        const previewUrl = `https://${req.headers.host}/preview/${responseData.documentId}`;
        const downloadUrl = `https://${req.headers.host}/api/download/${responseData.documentId}`; 
        replyMessage = `✅ **Autonomous Architecture Scaffolded!**\n\nI have evaluated your specifications and generated the complete full-stack codebase.\n\n🚀 **Live Preview:** [View Application Architecture](${previewUrl})\n⬇️ **Download Source Code:** [Download .zip](${downloadUrl})\n📁 **Firestore Record ID:** \`${responseData.documentId}\``;
      }

      if (replyMessage) {
        await fetch(`https://api.github.com/repos/${repoFullName}/issues/${issueNumber}/comments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'App-Architect-Agent' 
          },
          body: JSON.stringify({ body: replyMessage })
        }).catch(err => console.error('[GitHub API Error]', err));
      }
    }
  })().catch(err => console.error('[Background Worker Error]', err));
});

// ==========================================
// 🚀 EVENT-DRIVEN CLOUD ORCHESTRATOR
// ==========================================
app.post('/api/agent/build', async (req, res) => {
  const { prompt, appName } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing 'prompt'" });
  
  try {
    let currentConfigIndex = 0;
    let result;
    let chat;

    while (true) {
      try {
        const config = fallbackConfigs[currentConfigIndex];
        const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: config.location });
        chat = ai.chats.create({ model: config.model, config: { tools: agentTools as any, systemInstruction } });
        
        result = await chat.sendMessage({ message: prompt });
        break; 
      } catch (err: any) {
        currentConfigIndex++;
        if (currentConfigIndex >= fallbackConfigs.length) throw new Error(`CRITICAL: All models failed.`);
      }
    }

    return await handleAgentResponse(result, chat, appName || `app_${Date.now()}`, res);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🔄 INTERACTIVE CONTINUATION ROUTE (Firestore State)
// ==========================================
app.post('/api/agent/continue', async (req, res) => {
  const { sessionId, answer } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'Session ID required.' });

  try {
    const sessionDoc = await db.collection('agent_sessions').doc(sessionId).get();
    if (!sessionDoc.exists) return res.status(400).json({ error: 'Session expired or invalid. Please start a new build.' });

    const sessionData = sessionDoc.data();
    
    let currentConfigIndex = 0;
    let result;
    let chat;

    while (true) {
      try {
        const config = fallbackConfigs[currentConfigIndex];
        const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: config.location });
        
        // Rebuild the chat session using the history retrieved from Firestore
        chat = ai.chats.create({ 
          model: config.model, 
          history: sessionData?.history || [],
          config: { tools: agentTools as any, systemInstruction } 
        });

        result = await chat.sendMessage({ message: answer });
        break;
      } catch (err: any) {
        currentConfigIndex++;
        if (currentConfigIndex >= fallbackConfigs.length) throw new Error(`CRITICAL: All models failed.`);
      }
    }

    return await handleAgentResponse(result, chat, sessionData?.appName || `app_${Date.now()}`, res, sessionId, sessionData?.targetDocumentId);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 🛠️ ITERATIVE UPDATE ROUTE
// ==========================================
app.post('/api/agent/update', async (req, res) => {
  const { documentId, updatePrompt } = req.body;
  if (!documentId || !updatePrompt) return res.status(400).json({ error: "Missing documentId or prompt" });

  try {
    const docRef = db.collection('generated_fullstack_apps').doc(documentId);
    const doc = await docRef.get();
    if (!doc.exists) return res.status(404).json({ error: "Project not found." });

    const existingData = doc.data();
    const appName = existingData?.appName || `app_${Date.now()}`;
    const rawFiles = existingData?.rawFiles || [];

    let codeContext = `CURRENT ARCHITECTURE FOR ${appName}:\n\n`;
    rawFiles.forEach((file: any) => {
      codeContext += `--- FILE: ${file.filename} ---\n${file.code}\n\n`;
    });

    const agentPrompt = `You are updating an existing codebase.\n\n${codeContext}\n\nUSER UPDATE REQUEST: ${updatePrompt}\n\nCRITICAL INSTRUCTION: You MUST invoke the 'buildFullStackApp' tool and output the ENTIRE updated codebase. Include ALL files (both the ones you modified and the ones you left completely untouched). If you omit a file, it will be deleted from the user's project.`;

    let currentConfigIndex = 0;
    let result;
    let chat;

    while (true) {
      try {
        const config = fallbackConfigs[currentConfigIndex];
        const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: config.location });
        chat = ai.chats.create({ model: config.model, config: { tools: agentTools as any, systemInstruction } });
        
        result = await chat.sendMessage({ message: agentPrompt });
        break; 
      } catch (err: any) {
        currentConfigIndex++;
        if (currentConfigIndex >= fallbackConfigs.length) throw new Error(`CRITICAL: All models failed.`);
      }
    }

    // Thread the documentId so it overwrites the existing file tree instead of generating a new one
    return await handleAgentResponse(result, chat, appName, res, undefined, documentId);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

async function handleAgentResponse(result: any, chat: any, appName: string, res: express.Response, existingSessionId?: string, targetDocumentId?: string) {
  const parts = result.candidates?.[0]?.content?.parts || [];
  const call = parts.find((p: any) => p.functionCall)?.functionCall;

  if (call) {
    const sessionId = existingSessionId || randomUUID();
    
    if (call.name === "askUserForClarification") {
      // 💾 Save session context to Firestore to survive Cloud Run instance shifting
      const history = await chat.getHistory();
      await db.collection('agent_sessions').doc(sessionId).set({
        history: history, 
        appName: appName,
        targetDocumentId: targetDocumentId || null,
        updatedAt: new Date()
      });
      return res.status(200).json({ status: 'needs_clarification', question: call.args.questionToAsk, sessionId });
    } 

    if (call.name === "buildFullStackApp") {
      const generatedFiles = call.args.files || [];
      const safeAppName = (call.args.appName || appName).replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
      
      const dbPayload: any = { 
        updatedAt: new Date(), appName: safeAppName, files: {},
        rawFiles: generatedFiles.map((f: any) => ({ filename: f.filename, code: f.code }))
      };

      if (!targetDocumentId) dbPayload.createdAt = new Date();

      generatedFiles.forEach((file: any) => {
        dbPayload.files[file.filename.replace(/[\.\/]/g, '_')] = file.code; 
      });

      try {
        const docRef = targetDocumentId 
          ? db.collection('generated_fullstack_apps').doc(targetDocumentId) 
          : db.collection('generated_fullstack_apps').doc();
        
        if (targetDocumentId) {
          await docRef.update(dbPayload);
        } else {
          await docRef.set(dbPayload);
        }

        // Clean up the session doc if we just resolved a clarification
        if (existingSessionId) {
           await db.collection('agent_sessions').doc(existingSessionId).delete().catch(() => {});
        }

        return res.status(200).json({ success: true, status: 'completed', documentId: docRef.id, appName: safeAppName, filesGenerated: generatedFiles.map((f: any) => f.filename) });
      } catch (dbErr: any) {
        return res.status(500).json({ error: "Failed to persist architecture to database." });
      }
    }
  }

  // 🛑 FALLBACK FIX: Catch rogue plain-text responses and force them into the clarification loop
  const fallbackText = parts.find((p: any) => p.text)?.text;
  if (!call && fallbackText) {
    const sessionId = existingSessionId || randomUUID();
    const history = await chat.getHistory();
    await db.collection('agent_sessions').doc(sessionId).set({
      history: history, 
      appName: appName,
      targetDocumentId: targetDocumentId || null,
      updatedAt: new Date()
    });
    return res.status(200).json({ status: 'needs_clarification', question: fallbackText, sessionId });
  }

  return res.status(200).json({ success: true, status: 'completed', message: "Task executed without files." });
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`\n🌐 Autonomous Orchestrator listening on port ${PORT}`);
  if (!process.env.K_SERVICE) startAgent();
});

// ==========================================
// 💻 LOCAL CLI ENGINE (Persistent Multi-Turn Memory)
// ==========================================
async function startAgent() {
  let chat: any = null; // Hoisted so recursive turns remember history
  let currentConfigIndex = 0;

  const handleTurn = async (contentToPass: string) => {
    try {
      console.log(`\nAgent is thinking...`);
      let result;

      while (true) {
        try {
          if (!chat) {
            const config = fallbackConfigs[currentConfigIndex];
            const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: config.location });
            chat = ai.chats.create({ model: config.model, config: { tools: agentTools as any, systemInstruction } });
          }
          result = await chat.sendMessage({ message: contentToPass });
          break; 
        } catch (err: any) {
          const history = chat ? await chat.getHistory() : [];
          currentConfigIndex++;
          if (currentConfigIndex >= fallbackConfigs.length) {
            console.error("\n❌ CRITICAL: All models failed across all regions.");
            process.exit(1);
          }
          console.log(`[Fallback] Failed on ${fallbackConfigs[currentConfigIndex-1].location}. Trying next...`);
          const config = fallbackConfigs[currentConfigIndex];
          const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: config.location });
          chat = ai.chats.create({ model: config.model, history, config: { tools: agentTools as any, systemInstruction } });
        }
      }

      const parts = result.candidates?.[0]?.content?.parts || [];
      const call = parts.find((p: any) => p.functionCall)?.functionCall;

      if (call) {
        if (call.name === "askUserForClarification") {
          rl.question(`\n🤖 Agent: ${call.args.questionToAsk}\n🧑 You: `, (ans) => handleTurn(ans));
        } else if (call.name === "buildFullStackApp") {
          console.log(`\n🚀 Architecting Full-Stack Application... saving to Firestore.`);
          
          const generatedFiles = call.args.files || [];
          const safeAppName = (call.args.appName || `cli_build_${Date.now()}`).replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
          
          const dbPayload: any = { 
            createdAt: new Date(), appName: safeAppName, files: {},
            rawFiles: generatedFiles.map((f: any) => ({ filename: f.filename, code: f.code }))
          };

          generatedFiles.forEach((file: any) => {
            dbPayload.files[file.filename.replace(/[\.\/]/g, '_')] = file.code; 
          });

          const docRef = db.collection('generated_fullstack_apps').doc();
          await docRef.set(dbPayload);
          console.log(`✅ Architecture saved successfully!`);
          console.log(`🔗 Web Preview: http://localhost:${PORT}/preview/${docRef.id}`);
          process.exit(0);
        }
      } else {
        // Handle conversational text/prose without hanging
        const textResponse = parts.find((p: any) => p.text)?.text || "I need more information.";
        rl.question(`\n🤖 Agent: ${textResponse}\n🧑 You: `, (ans) => handleTurn(ans));
      }
    } catch (err) {
      console.error("\n❌ Error communicating with AI:", err);
      process.exit(1); // Properly exit on failure
    }
  };
  rl.question("🤖 Agent: What architecture would you like me to build?\n🧑 You: ", handleTurn);
}