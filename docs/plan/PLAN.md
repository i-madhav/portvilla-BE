# PortVilla — Implementation Plan

## 1. Product Vision

An open-source AI-powered interactive portfolio platform. Candidates onboard once with professional data, receive a shareable URL (`portvilla.in/username`), and visitors interact with a Jarvis-style voice/chat AI assistant that represents the candidate in third person — grounded strictly in submitted data.

**Core differentiator**: Voice-first interaction with a dynamic orb UI that simulates intelligent reasoning, making portfolios feel alive.

---

## 2. User Personas

### Candidate (Creator)
- Developers, researchers, designers, professionals
- Wants a standout portfolio beyond static sites
- Submits professional data once, shares the link
- Provides their own LLM API key or uses open-source models

### Visitor (Consumer)
- Recruiters, hiring managers, peers, collaborators
- Lands on a candidate's PortVilla URL
- Interacts via voice (primary) or chat (secondary)
- Expects fast, accurate, grounded responses

---

## 3. User Journeys

### Candidate Journey
```
Sign Up (email/password)
    → Email Verification (Nodemailer)
    → Onboarding Form (multi-step)
    → Submit Professional Data
    → Configure AI Settings (API key / model selection)
    → Profile Processed → JSON stored
    → Dashboard Generated
    → Get Shareable URL (portvilla.in/username)
    → Manage Profile (edit, toggle public/private)
```

### Visitor Journey
```
Open portvilla.in/username
    → See Candidate Dashboard
    → Orb in Idle State ("Ask me anything about this candidate")
    → Click/Tap Orb → Listening State
    → Speak or Type Question
    → Processing State (cosmetic reasoning traces)
    → Response State (answer + dynamic UI cards)
    → Continue Conversation or Browse Dashboard
```

---

## 4. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │ Onboard  │  │Dashboard │  │  Orb UI   │  │  Chat UI  │  │
│  │  Forms   │  │  Views   │  │(Three.js) │  │           │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────┘  │
│                    │              │               │          │
│                    │         LiveKit Client       │          │
│                    │              │               │          │
└────────────────────┼──────────────┼───────────────┼──────────┘
                     │              │               │
                     ▼              ▼               ▼
┌─────────────────────────────────────────────────────────────┐
│                     NestJS Backend                          │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│  │  Auth    │  │ Profile  │  │    AI     │  │  Cache    │  │
│  │ Module   │  │ Module   │  │  Module   │  │  Layer    │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────┘  │
│                                    │                        │
│                              ┌─────┴─────┐                  │
│                              │ LLM Layer │                  │
│                              │ (BYOK /   │                  │
│                              │  Groq /   │                  │
│                              │  Ollama)  │                  │
│                              └───────────┘                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐     ┌────────────────┐
              │    MongoDB     │     │  LiveKit Server │
              │  (profiles,    │     │  (voice media)  │
              │   users,       │     │                 │
              │   cache)       │     └────────────────┘
              └────────────────┘
```

---

## 5. Backend Architecture (NestJS)

### Module Structure

```
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── config.module.ts
│   ├── config.service.ts
│   └── configuration.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── profile-owner.guard.ts
│   ├── decorators/
│   │   └── current-user.decorator.ts
│   └── dto/
│       ├── register.dto.ts
│       ├── login.dto.ts
│       └── verify-email.dto.ts
├── mail/
│   ├── mail.module.ts
│   └── mail.service.ts              # Nodemailer
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── schemas/
│       └── user.schema.ts
├── profiles/
│   ├── profiles.module.ts
│   ├── profiles.controller.ts
│   ├── profiles.service.ts
│   ├── dto/
│   │   ├── create-profile.dto.ts
│   │   ├── update-profile.dto.ts
│   │   └── profile-sections.dto.ts
│   └── schemas/
│       └── profile.schema.ts
├── ai/
│   ├── ai.module.ts
│   ├── ai.controller.ts
│   ├── ai.service.ts
│   ├── providers/
│   │   ├── llm-provider.interface.ts
│   │   ├── openai.provider.ts
│   │   ├── groq.provider.ts
│   │   └── ollama.provider.ts
│   ├── prompt/
│   │   ├── prompt-builder.service.ts  # Builds system prompt from JSON profile
│   │   └── templates/
│   │       └── system-prompt.ts
│   └── cache/
│       ├── response-cache.service.ts
│       └── schemas/
│           └── cached-response.schema.ts
├── voice/
│   ├── voice.module.ts
│   ├── voice.controller.ts          # LiveKit token generation
│   └── voice.service.ts
├── dashboard/
│   ├── dashboard.module.ts
│   ├── dashboard.controller.ts       # Public profile endpoint
│   └── dashboard.service.ts
└── common/
    ├── filters/
    │   └── http-exception.filter.ts
    ├── interceptors/
    │   └── transform.interceptor.ts
    └── pipes/
        └── validation.pipe.ts
```

### Key Backend Decisions

- **No embeddings, no vector DB, no RAG** — candidate data fits in LLM context window
- **JSON storage** — profile data stored as structured JSON in MongoDB
- **Prompt assembly** — `prompt-builder.service.ts` serializes relevant JSON sections into system prompt
- **LLM provider abstraction** — interface-based, swap between OpenAI/Groq/Ollama
- **Response caching** — hash(candidate_id + normalized_query) → cached response in MongoDB (TTL-based)
- **LiveKit integration** — backend generates room tokens, handles STT/TTS pipeline coordination

---

## 6. Frontend Architecture (React)

### Tech Stack

| Concern | Choice |
|---|---|
| Framework | React 18+ with Vite |
| Routing | React Router v6 |
| State | Zustand |
| Styling | Tailwind CSS + Framer Motion |
| 3D Orb | Three.js (react-three-fiber) |
| Voice | LiveKit React SDK |
| HTTP | Axios |
| Forms | React Hook Form + Zod |

### Page Structure

```
src/
├── main.tsx
├── App.tsx
├── routes/
│   ├── index.tsx
│   ├── auth/
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   └── VerifyEmail.tsx
│   ├── onboarding/
│   │   ├── OnboardingLayout.tsx
│   │   ├── steps/
│   │   │   ├── BasicInfo.tsx
│   │   │   ├── ProfessionalInfo.tsx
│   │   │   ├── ExternalSources.tsx
│   │   │   └── AISettings.tsx
│   │   └── OnboardingComplete.tsx
│   ├── candidate/
│   │   ├── CandidateSettings.tsx
│   │   └── EditProfile.tsx
│   └── portfolio/
│       └── [username]/
│           └── PortfolioView.tsx       # The public-facing page
├── components/
│   ├── orb/
│   │   ├── Orb.tsx                     # Three.js orb component
│   │   ├── OrbStates.ts               # Idle, Listening, Processing, Response
│   │   ├── OrbShader.glsl             # Custom shader for glow/pulse
│   │   └── OrbAnimations.ts
│   ├── reasoning/
│   │   ├── ReasoningCanvas.tsx         # Cosmetic reasoning trace display
│   │   ├── ReasoningStep.tsx
│   │   └── reasoningTraces.ts          # Question-contextual trace generator
│   ├── response/
│   │   ├── ResponseRenderer.tsx        # Dynamic card layout
│   │   ├── cards/
│   │   │   ├── SkillCard.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── TimelineCard.tsx
│   │   │   ├── ExperienceCard.tsx
│   │   │   ├── ResearchCard.tsx
│   │   │   └── AchievementCard.tsx
│   │   └── MarkdownResponse.tsx
│   ├── dashboard/
│   │   ├── DashboardLayout.tsx
│   │   ├── CandidateOverview.tsx
│   │   ├── SkillsSection.tsx
│   │   ├── TimelineSection.tsx
│   │   ├── ProjectsSection.tsx
│   │   ├── ExperienceSection.tsx
│   │   └── SocialLinks.tsx
│   ├── chat/
│   │   ├── ChatPanel.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   ├── voice/
│   │   ├── VoiceController.tsx         # LiveKit room management
│   │   ├── Transcription.tsx           # Live STT display
│   │   └── VoiceIndicator.tsx
│   └── ui/                            # Shared UI primitives
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       └── Loader.tsx
├── hooks/
│   ├── useOrb.ts
│   ├── useVoice.ts
│   ├── useAI.ts
│   └── useProfile.ts
├── stores/
│   ├── authStore.ts
│   ├── profileStore.ts
│   ├── orbStore.ts
│   └── chatStore.ts
├── lib/
│   ├── api.ts                          # Axios instance
│   ├── livekit.ts                      # LiveKit client config
│   └── utils.ts
└── assets/
    ├── shaders/
    └── animations/
```

---

## 7. Orb UI — Design Spec

### Library Recommendation

Use **react-three-fiber** (R3F) + **@react-three/drei** + custom GLSL shaders.

Reference projects to study:
- [https://github.com/pmndrs/react-three-fiber](https://github.com/pmndrs/react-three-fiber)
- Search "three.js orb shader" / "glowing sphere WebGL" on ShaderToy
- Stripe's gradient orb (visual reference for color shifts)
- Apple Siri orb animation (behavior reference)

### State Machine

```
┌────────┐  user clicks/taps   ┌───────────┐  silence detected   ┌────────────┐  LLM responds   ┌──────────┐
│  IDLE  │ ──────────────────→ │ LISTENING │ ──────────────────→ │ PROCESSING │ ──────────────→ │ RESPONSE │
└────────┘                     └───────────┘                     └────────────┘                 └──────────┘
    ↑                                                                                               │
    └───────────────────────────────────────────────────────────────────────────────────────────────┘
                                              conversation ends / timeout
```

### State Details

| State | Orb Position | Orb Behavior | Screen Content |
|---|---|---|---|
| Idle | Center | Soft glow, slow breathe pulse, muted color | "Ask me anything about {name}" |
| Listening | Center | Expand, brighter color, reactive pulse to audio input | Live transcription text |
| Processing | Top-right (animated transition) | Steady rotation, color cycling | Reasoning traces (cosmetic) |
| Response | Top-right | Gentle pulse synced to TTS audio | Answer cards + spoken response |

### Cosmetic Reasoning Traces

`reasoningTraces.ts` generates contextual traces based on question keywords:

```typescript
// Example logic (not exhaustive)
function generateTraces(query: string, profileSections: string[]): string[] {
  const traces: string[] = [];
  
  if (query.match(/project|built|created/i)) {
    traces.push("Reviewing project portfolio...");
    traces.push("Analyzing technical contributions...");
  }
  if (query.match(/skill|technology|stack/i)) {
    traces.push("Mapping technical skills...");
    traces.push("Cross-referencing with project experience...");
  }
  if (query.match(/experience|work|company/i)) {
    traces.push("Scanning professional timeline...");
    traces.push("Reviewing role responsibilities...");
  }
  // ... more patterns
  
  traces.push("Composing response...");
  return traces;
}
```

Traces animate in sequentially with staggered fade-in (300-500ms apart) during the actual LLM call.

---

## 8. Voice Architecture (LiveKit)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Visitor    │         │   LiveKit    │         │   NestJS     │
│   Browser    │         │   Server    │         │   Backend    │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │  1. Request room token │                        │
       │────────────────────────┼───────────────────────→│
       │                        │    2. Generate token   │
       │←───────────────────────┼────────────────────────│
       │                        │                        │
       │  3. Connect to room    │                        │
       │───────────────────────→│                        │
       │                        │                        │
       │  4. Stream audio       │                        │
       │───────────────────────→│                        │
       │                        │  5. STT (speech-to-text)
       │                        │───────────────────────→│
       │                        │                        │
       │                        │  6. Process query      │
       │                        │  (prompt assembly +    │
       │                        │   LLM call)            │
       │                        │                        │
       │                        │  7. TTS response       │
       │                        │←───────────────────────│
       │  8. Audio response     │                        │
       │←───────────────────────│                        │
       │                        │                        │
       │  9. Text transcript    │                        │
       │←───────────────────────┼────────────────────────│
```

### LiveKit Components

- **LiveKit Server**: Self-hosted (Docker) or LiveKit Cloud
- **STT**: LiveKit's built-in STT plugin (Deepgram/Whisper)
- **TTS**: LiveKit's TTS plugin (ElevenLabs/Cartesia/browser TTS)
- **Agent Framework**: LiveKit Agents SDK (Python) — runs server-side, handles STT → LLM → TTS pipeline

### LiveKit Agent (Python sidecar)

```
livekit-agent/
├── agent.py              # Main agent entrypoint
├── profile_loader.py     # Fetches candidate JSON from NestJS API
├── prompt_builder.py     # Builds system prompt from profile
└── requirements.txt
```

The LiveKit agent connects to the NestJS backend API to fetch candidate profile data and LLM configuration, then handles the real-time voice pipeline.

> **Note**: LiveKit Agents SDK is Python-based. This will be a small Python sidecar alongside the NestJS backend.

---

## 9. Database Design (MongoDB)

### Collections

#### `users`
```json
{
  "_id": "ObjectId",
  "email": "string",
  "passwordHash": "string",
  "username": "string (unique, URL-safe)",
  "isEmailVerified": "boolean",
  "verificationToken": "string | null",
  "verificationTokenExpiry": "Date | null",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### `profiles`
```json
{
  "_id": "ObjectId",
  "userId": "ObjectId (ref: users)",
  "username": "string (denormalized for fast lookup)",
  "visibility": "public | private | protected",
  "protectedPassword": "string | null",

  "basic": {
    "name": "string",
    "title": "string",
    "profileImage": "string (URL or path)",
    "introduction": "string",
    "aboutMe": "string"
  },

  "professional": {
    "resume": {
      "url": "string",
      "parsedText": "string"
    },
    "education": [
      {
        "institution": "string",
        "degree": "string",
        "field": "string",
        "startDate": "string",
        "endDate": "string",
        "description": "string"
      }
    ],
    "currentPosition": {
      "title": "string",
      "company": "string",
      "startDate": "string",
      "description": "string"
    },
    "experience": [
      {
        "title": "string",
        "company": "string",
        "startDate": "string",
        "endDate": "string",
        "description": "string"
      }
    ],
    "skills": ["string"],
    "technologies": ["string"],
    "interests": ["string"],
    "achievements": ["string"],
    "certifications": [
      {
        "name": "string",
        "issuer": "string",
        "date": "string",
        "url": "string"
      }
    ],
    "awards": ["string"],
    "additionalNotes": "string"
  },

  "external": {
    "linkedin": "string",
    "github": "string",
    "twitter": "string",
    "personalWebsite": "string",
    "portfolioWebsite": "string",
    "researchPapers": [
      {
        "title": "string",
        "url": "string",
        "abstract": "string"
      }
    ],
    "projects": [
      {
        "name": "string",
        "url": "string",
        "description": "string",
        "technologies": ["string"]
      }
    ],
    "blogs": ["string"],
    "otherProfiles": [
      {
        "platform": "string",
        "url": "string"
      }
    ]
  },

  "aiSettings": {
    "provider": "openai | groq | ollama | custom",
    "apiKey": "string (encrypted)",
    "model": "string",
    "baseUrl": "string | null"
  },

  "createdAt": "Date",
  "updatedAt": "Date"
}
```

#### `cached_responses`
```json
{
  "_id": "ObjectId",
  "profileId": "ObjectId",
  "queryHash": "string (SHA-256 of normalized query)",
  "query": "string",
  "response": "string",
  "createdAt": "Date",
  "expiresAt": "Date (TTL index)"
}
```

### Indexes

```
users: { email: 1 } (unique), { username: 1 } (unique)
profiles: { userId: 1 } (unique), { username: 1 } (unique)
cached_responses: { profileId: 1, queryHash: 1 } (compound unique), { expiresAt: 1 } (TTL)
```

---

## 10. AI Pipeline

No RAG. Direct context injection.

```
Visitor Query
      ↓
Normalize query (lowercase, trim)
      ↓
Check cache (profileId + queryHash)
      ↓  (cache miss)
Build system prompt:
  - Role: "You are an AI assistant representing {name}."
  - Rules: third-person, no hallucination, grounded only in provided data
  - Full candidate JSON profile injected as context
      ↓
Build user prompt:
  - Visitor's question
  - Conversation history (last N turns)
      ↓
Call LLM (via candidate's configured provider)
      ↓
Parse response
      ↓
Cache response
      ↓
Return to frontend
      ↓
(If voice: pipe text to TTS)
```

### System Prompt Template

```
You are an AI assistant for PortVilla, representing a professional candidate.
You act as the candidate's representative — always speak in third person.

Candidate Profile:
{serialized_json_profile}

Rules:
1. ONLY use information from the candidate profile above.
2. NEVER invent, assume, or hallucinate information.
3. Always refer to the candidate by name in third person.
   GOOD: "{name} has experience in..."
   BAD: "I have experience in..."
4. If information is not available, say: "I don't have that information in {name}'s profile."
5. Be conversational, professional, and concise.
6. When listing items (skills, projects), structure them clearly.
```

---

## 11. API Design

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/verify-email` | Verify email with token |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |

### Profile (Authenticated)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/profiles` | Create profile |
| GET | `/api/profiles/me` | Get own profile |
| PATCH | `/api/profiles/me` | Update profile |
| PATCH | `/api/profiles/me/basic` | Update basic info section |
| PATCH | `/api/profiles/me/professional` | Update professional section |
| PATCH | `/api/profiles/me/external` | Update external sources |
| PATCH | `/api/profiles/me/ai-settings` | Update AI provider config |
| PATCH | `/api/profiles/me/visibility` | Toggle public/private/protected |
| POST | `/api/profiles/me/resume` | Upload resume file |
| POST | `/api/profiles/me/profile-image` | Upload profile image |
| DELETE | `/api/profiles/me` | Delete profile and all data |

### Public Dashboard

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/:username` | Get public profile data |
| POST | `/api/dashboard/:username/verify` | Verify protected profile password |

### AI / Chat

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/:username/chat` | Send chat message, get AI response |
| GET | `/api/ai/:username/history` | Get conversation history (session-based) |

### Voice

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/voice/:username/token` | Get LiveKit room token for visitor |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |

---

## 12. Authentication & Authorization

```
Register → Hash password (bcrypt) → Store user → Send verification email
    ↓
Verify Email → Mark isEmailVerified = true
    ↓
Login → Validate credentials → Issue JWT (access token, 7d expiry)
    ↓
Authenticated requests → JWT in Authorization header → Guard validates
```

### Guards

- `JwtAuthGuard` — validates JWT on protected routes
- `ProfileOwnerGuard` — ensures user can only edit their own profile
- `ProfileVisibilityGuard` — checks public/private/protected on dashboard routes

### API Key Security

Candidate API keys are encrypted at rest (AES-256) before storing in MongoDB. Decrypted only server-side when making LLM calls.

---

## 13. Dashboard Generation Flow

Dashboard is **not pre-generated** — it's rendered client-side from the profile JSON.

```
Visitor hits portvilla.in/username
    ↓
React app loads
    ↓
Fetches GET /api/dashboard/:username
    ↓
Backend returns profile JSON (minus sensitive fields like apiKey)
    ↓
React renders dashboard components from JSON:
  - CandidateOverview (basic.name, basic.title, basic.introduction)
  - SkillsSection (professional.skills, professional.technologies)
  - TimelineSection (professional.education + professional.experience, sorted by date)
  - ProjectsSection (external.projects)
  - ExperienceSection (professional.experience)
  - SocialLinks (external.linkedin, external.github, etc.)
  - AI Orb (always present)
```

---

## 14. URL & Sharing Flow

### URL Format

```
portvilla.in/{username}
```

### Visibility Modes

| Mode | Behavior |
|---|---|
| Public | Anyone with the link can view and interact |
| Private | Only the candidate can view (logged in) |
| Protected | Visitors must enter a password set by candidate |

### Username Rules

- Alphanumeric + hyphens
- 3-30 characters
- Unique
- Reserved words blocked (admin, api, auth, settings, etc.)

---

## 15. Candidate Analytics (Future Phase)

### Designed but not implemented in MVP

Schema reserved in profile:

```json
{
  "analytics": {
    "totalViews": "number",
    "uniqueVisitors": "number",
    "conversations": "number",
    "topQuestions": ["string"],
    "avgSessionDuration": "number",
    "viewsByDate": [{ "date": "Date", "count": "number" }]
  }
}
```

Implementation deferred — would require a `page_views` collection and an analytics aggregation pipeline.

---

## 16. Security Considerations

| Concern | Mitigation |
|---|---|
| API key storage | AES-256 encryption at rest |
| Password storage | bcrypt (12 rounds) |
| Authentication | JWT with expiry, httpOnly cookies optional |
| Input validation | Zod (frontend) + class-validator (NestJS) on all inputs |
| XSS | React's default escaping + DOMPurify for any rich text |
| CSRF | SameSite cookies or token-based if using cookies |
| Rate limiting | `@nestjs/throttler` on auth + AI endpoints |
| LLM prompt injection | System prompt is server-side only, user input is in user message role |
| Data deletion | Full profile + cached responses deletion on account delete |
| File uploads | Validate file type + size, store in object storage |
| CORS | Whitelist frontend origin only |

---

## 17. Folder Structure (Full Project)

```
portvilla/
├── README.md
├── docker-compose.yml
├── .env.example
│
├── client/                           # React (Vite)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/
│       ├── components/
│       ├── hooks/
│       ├── stores/
│       ├── lib/
│       └── assets/
│
├── server/                           # NestJS
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/
│       ├── auth/
│       ├── mail/
│       ├── users/
│       ├── profiles/
│       ├── ai/
│       ├── voice/
│       ├── dashboard/
│       └── common/
│
├── livekit-agent/                    # Python LiveKit Agent
│   ├── requirements.txt
│   ├── agent.py
│   ├── profile_loader.py
│   └── prompt_builder.py
│
└── docs/
    └── api.md
```

---

## 18. Deployment Architecture (High-Level)

```
                    ┌──────────────┐
                    │   Nginx /    │
                    │  Caddy       │
                    │  (reverse    │
                    │   proxy)     │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │  React   │ │  NestJS  │ │  LiveKit     │
        │  Static  │ │  API     │ │  Server +    │
        │  (CDN/   │ │  :3001   │ │  Agent       │
        │   Nginx) │ │          │ │  :7880       │
        └──────────┘ └──────────┘ └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   MongoDB    │
                    │   :27017     │
                    └──────────────┘
```

All services containerized with Docker Compose for easy self-hosting.

---

## 19. Development Phases

### Phase 1 — MVP (Core)

- [x] Project scaffolding (NestJS + React + Vite)
- [ ] Auth (register, login, email verification, JWT)
- [ ] Onboarding form (multi-step, all sections)
- [ ] Profile CRUD (JSON storage in MongoDB)
- [ ] Public dashboard page (client-side rendered from JSON)
- [ ] AI chat (direct context injection, BYOK)
- [ ] Orb UI (Three.js — 4 states with animations)
- [ ] Cosmetic reasoning traces
- [ ] Response rendering (text + basic cards)
- [ ] Query-response caching
- [ ] Public/Private/Protected visibility
- [ ] Shareable URL (portvilla.in/username)
- [ ] File uploads (resume, profile image)
- [ ] Docker Compose setup

### Phase 2 — Voice + Polish

- [ ] LiveKit integration (STT + TTS)
- [ ] LiveKit Python agent
- [ ] Voice-reactive orb (audio-level based animation)
- [ ] Live transcription display
- [ ] Conversation history
- [ ] Open-source model support (Groq, Ollama)
- [ ] Profile edit page
- [ ] Mobile responsive design
- [ ] SEO meta tags for shared links

### Phase 3 — Knowledge Graph + Analytics

- [ ] Neo4j knowledge graph per candidate
- [ ] Graph generation pipeline
- [ ] Knowledge graph visualization in dashboard
- [ ] Candidate analytics (views, conversations, top questions)
- [ ] Analytics dashboard for candidates
- [ ] Resume parsing (auto-fill from uploaded resume)
- [ ] LinkedIn/GitHub data import

### Phase 4 — Community + Scale

- [ ] Custom themes for portfolios
- [ ] Custom domain support
- [ ] Plugin system for additional data sources
- [ ] Public API for integrations
- [ ] Performance optimization (edge caching, CDN)

---

## 20. Cost Estimation (Self-Hosted)

| Component | Cost |
|---|---|
| VM (4 vCPU, 8GB RAM) | ~$20-40/mo |
| MongoDB | Self-hosted (included in VM) |
| LiveKit Server | Self-hosted (included in VM) |
| Domain (portvilla.in) | Already owned |
| LLM API costs | Borne by candidates (BYOK) |
| SSL | Free (Let's Encrypt) |
| **Total base cost** | **~$20-40/mo** |

---

## 21. Risks & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Orb UI complexity | High dev time | Start with simpler shader, iterate. Use existing Three.js examples as base |
| LiveKit setup complexity | Blocks voice feature | Keep voice in Phase 2, chat-only MVP works standalone |
| LLM context window limits | Large profiles may exceed limits | Truncate/summarize sections, prioritize relevant data |
| API key security breach | Candidate keys exposed | AES-256 encryption, audit logging, key rotation support |
| Low adoption | Effort wasted | Open source = community contribution, low maintenance burden |
| Browser STT compatibility | Voice doesn't work everywhere | Fallback to chat, show browser compatibility warning |

---

## 22. Getting Started (Dev Setup)

```bash
# Clone repo
git clone https://github.com/your-org/portvilla.git
cd portvilla

# Start MongoDB
docker-compose up -d mongodb

# Backend
cd server
cp .env.example .env
npm install
npm run start:dev

# Frontend
cd ../client
cp .env.example .env
npm install
npm run dev

# LiveKit Agent (Phase 2)
cd ../livekit-agent
pip install -r requirements.txt
python agent.py
```

### Environment Variables

```env
# server/.env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/portvilla
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=7d
ENCRYPTION_KEY=your-32-byte-hex-key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
LIVEKIT_API_KEY=your-livekit-key
LIVEKIT_API_SECRET=your-livekit-secret
LIVEKIT_URL=ws://localhost:7880

# client/.env
VITE_API_URL=http://localhost:3001/api
VITE_LIVEKIT_URL=ws://localhost:7880
```
