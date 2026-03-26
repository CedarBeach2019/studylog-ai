# OpenMAIC Deep Research Study

## Executive Summary

**OpenMAIC** (Open Multi-Agent Interactive Classroom) is an open-source AI platform from Tsinghua University that transforms any topic or document into a rich, interactive classroom experience. Powered by multi-agent orchestration, it generates slides, quizzes, interactive simulations, and project-based learning activities delivered by AI teachers and classmates who can speak, draw on whiteboards, and engage in real-time discussions.

### Why OpenMAIC Matters for log-origin

OpenMAIC represents a **paradigm shift** in interactive AI systems that directly aligns with log-origin's goals for DMlog.ai (TTRPG game mastering) and StudyLog.ai (interactive learning):

1. **Multi-Agent Orchestration**: LangGraph-based director system that manages agent turns, discussions, and interactions
2. **Real-time Interactive UI**: Canvas-based slide rendering with live effects (spotlight, laser), whiteboard drawing, and TTS integration
3. **Content Generation Pipeline**: Two-stage generation (outlines → scenes) with rich scene types (slides, quizzes, interactive, PBL)
4. **State Management**: Sophisticated Zustand stores with IndexedDB persistence for session continuity
5. **Extensibility**: Plugin architecture for agents, providers, and media generation

For log-origin, OpenMAIC provides a **blueprint** for:
- **DMlog.ai**: Converting classroom orchestration into game master console (scene management, NPC control, combat tracking)
- **StudyLog.ai**: Adapting interactive presentation system into study sessions with generated slides and quizzes
- **Real-time Collaboration**: Multi-user interaction patterns for TTRPG sessions and study groups

## Architecture Deep Dive

### Component Hierarchy

```
OpenMAIC/
├── app/                        # Next.js App Router
│   ├── api/                    # Server API routes (~18 endpoints)
│   │   ├── generate/           # Scene generation pipeline
│   │   ├── generate-classroom/ # Async classroom job submission
│   │   ├── chat/               # Multi-agent discussion (SSE streaming)
│   │   └── ...                 # quiz-grade, parse-pdf, web-search, etc.
│   ├── classroom/[id]/         # Classroom playback page
│   └── page.tsx                # Home page (generation input)
│
├── lib/                        # Core business logic
│   ├── generation/             # Two-stage lesson generation pipeline
│   ├── orchestration/          # LangGraph multi-agent orchestration
│   ├── playback/               # Playback state machine
│   ├── action/                 # Action execution engine (28+ actions)
│   ├── ai/                     # LLM provider abstraction
│   ├── store/                  # Zustand state stores
│   ├── types/                  # Centralized TypeScript types
│   └── ...                     # audio, media, export, hooks, i18n
│
├── components/                 # React UI components
│   ├── slide-renderer/         # Canvas-based slide editor & renderer
│   ├── scene-renderers/        # Quiz, Interactive, PBL scene renderers
│   ├── generation/             # Lesson generation toolbar & progress
│   ├── chat/                   # Chat area & session management
│   ├── whiteboard/             # SVG-based whiteboard drawing
│   ├── agent/                  # Agent avatar, config, info bar
│   └── ui/                     # Base UI primitives (shadcn/ui + Radix)
│
├── packages/                   # Workspace packages
│   ├── pptxgenjs/              # Customized PowerPoint generation
│   └── mathml2omml/            # MathML → Office Math conversion
│
└── skills/                     # OpenClaw / ClawHub skills
    └── openmaic/               # Guided OpenMAIC setup & generation SOP
```

### Data Flow

```
User Input → Requirements Analysis → Outline Generation → Scene Generation → Playback
     │              │                     │                    │              │
     │              │                     │                    │              │
     ▼              ▼                     ▼                    ▼              ▼
  Text/PDF    Vision/OCR           Scene Outlines        Full Scenes      Interactive
  Upload      Processing           (JSON structure)      (with Actions)    Classroom
                                                                           │
                                                                           │
                                                                           ▼
                                                                     Multi-Agent
                                                                     Discussion
                                                                           │
                                                                           ▼
                                                                     Real-time SSE
                                                                     Streaming
```

### Technical Stack

- **Frontend**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4
- **State Management**: Zustand with IndexedDB persistence
- **Multi-Agent**: LangGraph 1.1 with custom director graph
- **UI Components**: shadcn/ui + Radix primitives
- **Slide Rendering**: Custom canvas-based editor (PPTist fork)
- **Audio**: TTS providers (OpenAI, ElevenLabs, Azure, Browser-native), ASR
- **Media Generation**: Image/video providers (Grok, Qwen, Kling, Veo)
- **Export**: PowerPoint (.pptx) and interactive HTML
- **Build**: pnpm workspace, Vercel deployment

## Agent Orchestrator Analysis

### LangGraph Director System

OpenMAIC uses a **unified LangGraph state machine** for both single and multi-agent orchestration:

```typescript
// Graph topology:
// START → director ──(end)──→ END
//            │
//            └─(next)→ agent_generate ──→ director (loop)
```

**Key Components**:

1. **Director Node**: Decides which agent speaks next
   - Single agent: Pure code logic (no LLM)
   - Multi agent: LLM-based decision with code fast-paths
   - Turn limit enforcement

2. **Agent Generate Node**: Runs one agent's generation
   - Streams `agent_start`, `text_delta`, `action`, `agent_end` events
   - Enforces action permissions based on scene type
   - Maintains whiteboard action ledger

3. **State Management**:
   ```typescript
   const OrchestratorState = Annotation.Root({
     messages: Annotation<StatelessChatRequest['messages']>,
     storeState: Annotation<StatelessChatRequest['storeState']>,
     availableAgentIds: Annotation<string[]>,
     maxTurns: Annotation<number>,
     currentAgentId: Annotation<string | null>,
     turnCount: Annotation<number>,
     agentResponses: Annotation<AgentTurnSummary[]>,
     whiteboardLedger: Annotation<WhiteboardActionRecord[]>,
     shouldEnd: Annotation<boolean>,
     totalActions: Annotation<number>,
   });
   ```

### Agent Registry System

```typescript
interface AgentConfig {
  id: string;
  name: string; // Display name
  role: string; // Short role description
  persona: string; // Full system prompt
  avatar: string; // Emoji or image URL
  color: string; // UI theme color
  allowedActions: string[]; // Action types this agent can use
  priority: number; // Priority for director selection (1-10)
  voiceConfig?: { providerId: TTSProviderId; voiceId: string };
  isDefault: boolean;
  isGenerated?: boolean; // For LLM-generated agents
  boundStageId?: string; // Stage ID this agent was generated for
}
```

**Action Categories**:
- `WHITEBOARD_ACTIONS`: `wb_open`, `wb_draw_text`, `wb_draw_shape`, etc.
- `SLIDE_ACTIONS`: `spotlight`, `laser`, `play_video`
- Role-based mapping: Teachers get slide + whiteboard, others get whiteboard only

### Stateless Chat API

**Key Innovation**: Fully stateless server with client-maintained state:

```typescript
interface StatelessChatRequest {
  messages: UIMessage<ChatMessageMetadata>[]; // Conversation history
  storeState: { stage, scenes, currentSceneId, mode, whiteboardOpen }; // App state
  config: { agentIds, sessionType?, discussionTopic?, triggerAgentId? };
  directorState?: DirectorState; // Accumulated director state
  userProfile?: { nickname?, bio? };
  apiKey: string;
}
```

**SSE Events**:
```typescript
type StatelessEvent =
  | { type: 'agent_start'; data: { messageId, agentId, agentName, agentAvatar, agentColor } }
  | { type: 'agent_end'; data: { messageId, agentId } }
  | { type: 'text_delta'; data: { content: string; messageId?: string } }
  | { type: 'action'; data: { actionId, actionName, params, agentId, messageId? } }
  | { type: 'thinking'; data: { stage: 'director' | 'agent_loading'; agentId? } }
  | { type: 'cue_user'; data: { fromAgentId?: string; prompt?: string } }
  | { type: 'done'; data: { totalActions, totalAgents, directorState? } }
  | { type: 'error'; data: { message: string } };
```

### TTRPG Adaptation Mapping

**DMlog.ai Adaptation**:
```
OpenMAIC Agent → TTRPG NPC/Character
  │                    │
  ▼                    ▼
Teacher Agent   → Game Master
Student Agents  → Player Characters
Discussion      → In-game dialogue
Whiteboard      → Battle map / Scene visualization
Spotlight/Laser → Focus on character/object
Slides          → Scene descriptions / Handouts
Quiz            → Skill checks / Puzzles
```

**Key Translation Patterns**:
1. **Agent → Character**: Each TTRPG character gets agent config with persona, voice, allowed actions
2. **Director → Initiative Tracker**: LangGraph director manages combat turns
3. **Whiteboard → Battle Map**: SVG-based drawing for maps, tokens, fog of war
4. **Actions → Game Mechanics**: `roll_dice`, `apply_damage`, `cast_spell`, `move_token`
5. **Discussion → Roleplay**: Multi-agent conversations with character voices

## Interactive Presentation System

### Playback Engine State Machine

```typescript
// State machine:
//                  start()                  pause()
//   idle ──────────────────→ playing ──────────────→ paused
//     ▲                         ▲                       │
//     │                         │  resume()             │
//     │                         └───────────────────────┘
//     │
//     │  handleEndDiscussion()
//     │                         confirmDiscussion()
//     │                         / handleUserInterrupt()
//     │                              │
//     │                              ▼         pause()
//     └──────────────────────── live ──────────────→ paused
//                                 ▲                    │
//                                 │ resume / user msg  │
//                                 └────────────────────┘
```

**Key Features**:
1. **Unified Action Consumption**: Direct execution of `Scene.actions[]` via `ActionEngine`
2. **Speech Timing**: TTS integration with browser-native fallback, reading time estimation
3. **Discussion Triggers**: Proactive cards with 3s delay before showing
4. **State Persistence**: Snapshot system for resume/restore
5. **Browser TTS Workarounds**: Chrome bug handling (15s cutoff), Firefox compatibility

### Action Engine

**28+ Action Types** in two categories:

**Fire-and-forget** (immediate):
- `spotlight`: Focus on element with dimming
- `laser`: Point at element with laser effect

**Synchronous** (await completion):
- `speech`: TTS narration
- `wb_*`: Whiteboard operations (draw text/shape/chart/latex/table/line, clear, delete)
- `play_video`: Video playback
- `discussion`: Trigger roundtable discussion

**Execution Pattern**:
```typescript
class ActionEngine {
  async execute(action: Action): Promise<void> {
    switch (action.type) {
      case 'spotlight':
        this.executeSpotlight(action); // Fire-and-forget
        return;
      case 'speech':
        return this.executeSpeech(action); // Synchronous
      // ...
    }
  }
}
```

### Slide Renderer Architecture

**Canvas-based Editor** (`components/slide-renderer/`):
- Fork of PPTist presentation editor
- Real-time element manipulation (text, image, shape, table, chart, latex, video)
- SVG-based rendering with interactive editing
- Theme system with gradients, shadows, outlines
- Export to PowerPoint via customized `pptxgenjs`

**Element Types**:
```typescript
enum ElementTypes {
  TEXT = 'text',
  IMAGE = 'image',
  SHAPE = 'shape',
  LINE = 'line',
  CHART = 'chart',
  TABLE = 'table',
  LATEX = 'latex',
  VIDEO = 'video',
  AUDIO = 'audio',
}
```

### Roundtable Component

**2,094 lines** of interactive UI (`components/roundtable/index.tsx`):
- Multi-agent discussion interface
- Audio indicators for speaking agents
- Presentation speech overlay
- Proactive discussion cards
- Playback controls (pause, resume, speed)
- Microphone input for user participation
- Thinking state visualization

**Key UI Patterns**:
1. **Animated Transitions**: Motion animations for agent switching
2. **Audio Visualization**: Real-time audio level indicators
3. **Responsive Layout**: Adapts to different screen sizes
4. **Accessibility**: Keyboard shortcuts, screen reader support
5. **Internationalization**: Chinese/English support via i18n hooks

### Real-time Features

**TTS Integration**:
- Multiple providers: OpenAI, ElevenLabs, Azure, Browser-native
- Per-agent voice configuration
- Speed/volume controls
- Browser-native TTS with Chrome bug workarounds

**WebSocket/SSE**:
- Server-Sent Events for streaming agent responses
- Heartbeat mechanism (15s intervals) to prevent connection timeout
- AbortController integration for cancellation

**Media Generation**:
- Image providers: Grok, Qwen, Seedream
- Video providers: Kling, Veo, Seedance
- Async job polling with progress tracking

## Content Generation Pipeline

### Two-Stage Generation

**Stage 1: Outline Generation** (`lib/generation/outline-generator.ts`):
```
User Requirements → AI Analysis → Scene Outlines (JSON)
```

**Stage 2: Scene Generation** (`lib/generation/scene-generator.ts`):
```
Scene Outline → Content Generation → Actions Generation → Full Scene
```

### Prompt System

**Template-based Prompts** (`lib/generation/prompts/`):
```
templates/
├── requirements-to-outlines/
│   ├── system.md
│   └── user.md
├── slide-content/
│   ├── system.md
│   └── user.md
├── slide-actions/
│   ├── system.md
│   └── user.md
├── quiz-content/
│   ├── system.md
│   └── user.md
└── ...
```

**Prompt Building**:
```typescript
const prompts = buildPrompt(PROMPT_IDS.REQUIREMENTS_TO_OUTLINES, {
  requirement: requirements.requirement,
  language: requirements.language,
  pdfContent: pdfText ? pdfText.substring(0, MAX_PDF_CONTENT_CHARS) : 'None',
  availableImages: availableImagesText,
  userProfile: userProfileText,
  mediaGenerationPolicy,
  researchContext: options?.researchContext || 'None',
  teacherContext: options?.teacherContext || '',
});
```

### Scene Types

1. **Slide Scenes**:
   - Canvas-based presentations
   - Rich media elements (images, videos, charts, LaTeX)
   - Animations and transitions
   - Export to PowerPoint

2. **Quiz Scenes**:
   - Single/multiple choice, short answer
   - Real-time AI grading
   - Answer analysis and feedback
   - Points system

3. **Interactive Scenes**:
   - HTML-based simulations
   - Physics engines, flowcharts, experiments
   - Iframe embedding with communication

4. **PBL Scenes** (Project-Based Learning):
   - Role selection (manager, designer, developer, etc.)
   - Issue board with milestones
   - Multi-agent collaboration
   - Deliverable tracking

### Media Generation Pipeline

**Placeholder System**:
```typescript
// In outlines: "gen_img_1", "gen_vid_1"
// During generation: Replace with actual media URLs
const result = uniquifyMediaElementIds(enriched);
```

**Async Job Processing**:
- Media generation jobs submitted to queue
- Polling API for completion status
- Fallback to placeholder images
- Progress tracking with callbacks

## TTRPG Adaptation Blueprint

### DM's Game Master Console

**Core Components**:

1. **Scene Management**:
   ```typescript
   // Adapted from OpenMAIC's Stage/Scene system
   interface GameScene {
     id: string;
     type: 'combat' | 'social' | 'exploration' | 'puzzle';
     title: string;
     content: SceneContent;
     npcs: NPCConfig[];
     triggers: Trigger[];
     music?: string; // Background music URL
     lighting?: 'bright' | 'dim' | 'dark';
   }
   ```

2. **NPC Control System**:
   ```typescript
   // Adapted from AgentRegistry
   interface NPCConfig {
     id: string;
     name: string;
     race: string;
     class?: string;
     stats: { str, dex, con, int, wis, cha };
     personality: string; // Agent persona
     voice: VoiceConfig;
     portrait: string; // Avatar image
     allowedActions: NPC_ACTION[];
     initiative?: number;
     hp: { current: number; max: number };
     conditions: Condition[];
   }
   ```

3. **Combat Tracker**:
   ```typescript
   // Adapted from LangGraph Director
   class CombatDirector {
     private graph: StateGraph<CombatState>;
     
     async nextTurn(): Promise<TurnResult> {
       // Initiative order management
       // Action resolution
       // Status effect updates
     }
   }
   ```

4. **Battle Map**:
   ```typescript
   // Adapted from Whiteboard component
   interface BattleMap {
     grid: { size: number; type: 'square' | 'hex' };
     tokens: MapToken[];
     fogOfWar: FogArea[];
     layers: MapLayer[]; // Terrain, objects, tokens
   }
   ```

### Player's Game Interface

**Core Components**:

1. **Character Sheet**:
   ```typescript
   // Adapted from SlideRenderer for interactive character sheets
   interface CharacterSheet {
     basicInfo: { name, race, class, level, background };
     abilities: { str, dex, con, int, wis, cha };
     skills: Skill[];
     inventory: Item[];
     spells: Spell[];
     features: Feature[];
     // Interactive elements with real-time updates
   }
   ```

2. **Dice Roller**:
   ```typescript
   // Integrated into ActionEngine
   interface DiceRollAction {
     type: 'roll_dice';
     dice: string; // "2d20+5"
     advantage?: boolean;
     disadvantage?: boolean;
     forCheck?: 'attack' | 'save' | 'skill' | 'ability';
     targetDC?: number;
   }
   ```

3. **Action Menu**:
   ```typescript
   // Adapted from Roundtable component
   interface ActionMenu {
     combatActions: CombatAction[];
     skillActions: SkillAction[];
     spellActions: SpellAction[];
     itemActions: ItemAction[];
     // Real-time availability based on character state
   }
   ```

4. **Real-time Updates**:
   - HP changes via SSE
   - Condition notifications
   - Initiative order display
   - Chat with other players/DM

### Spectator's Viewing Mode

**Core Components**:

1. **Live Game Stream**:
   ```typescript
   // Adapted from PlaybackEngine
   class SpectatorView {
     private engine: PlaybackEngine;
     private scenes: GameScene[];
     private currentView: 'dm' | 'player' | 'map' | 'overview';
     
     switchView(view: string): void {
       // Switch between different perspectives
     }
   }
   ```

2. **Interactive Slides**:
   - Scene descriptions with visuals
   - NPC portraits and bios
   - Location maps
   - Item illustrations

3. **Animations and Effects**:
   - Spell effects (particle systems)
   - Combat animations
   - Environmental effects (rain, fog, lighting)
   - Sound effects integration

4. **Chat Overlay**:
   - Live transcription of dialogue
   - Emote reactions
   - Polls and audience interaction
   - Highlight important moments

## StudyLog.ai Adaptation Blueprint

### Interactive Study Sessions

**Core Components**:

1. **Generated Study Slides**:
   ```typescript
   // Direct port from OpenMAIC's slide generation
   interface StudySlide {
     topic: string;
     difficulty: 'beginner' | 'intermediate' | 'advanced';
     content: SlideContent;
     keyPoints: string[];
     examples: Example[];
     practiceQuestions: QuizQuestion[];
   }
   ```

2. **Quiz/Flashcard Mode**:
   ```typescript
   // Enhanced from OpenMAIC's quiz system
   interface FlashcardDeck {
     id: string;
     title: string;
     subject: string;
     cards: Flashcard[];
     spacedRepetition: boolean;
     masteryTracking: MasteryStats;
   }
   
   interface Flashcard {
     front: string; // Question or term
     back: string; // Answer or definition
     hints: string[];
     mnemonics: string[];
     difficulty: number; // 1-5
     lastReviewed: Date;
     nextReview: Date;
   }
   ```

3. **Collaborative Study Rooms**:
   ```typescript
   // Multi-user adaptation of Roundtable
   interface StudyRoom {
     id: string;
     topic: string;
     participants: StudyParticipant[];
     whiteboard: StudyWhiteboard;
     chat: StudyChat;
     sharedResources: Resource[];
     studyPlan: StudyPlan;
   }
   ```

### Animation System for Learning

**Educational Animations**:
1. **Step-by-Step Explanations**:
   - Math problem solving with whiteboard animations
   - Science concept visualizations
   - Language grammar diagrams
   - Historical timeline animations

2. **Interactive Simulations**:
   - Physics experiments (pendulum, projectile motion)
   - Chemistry molecule builders
   - Biology cell animations
   - Economics supply/demand curves

3. **Memory Aids**:
   - Mnemonic animations
   - Concept mapping with animated connections
   - Story-based learning with character animations
   - Rhythm-based memorization (music + visuals)

### Adaptive Learning Engine

**Core Components**:
```typescript
interface AdaptiveLearningEngine {
  // Track student performance
  trackPerformance(topic: string, score: number, timeSpent: number): void;
  
  // Adjust difficulty
  getNextTopic(currentMastery: number): string;
  
  // Generate personalized content
  generatePersonalizedContent(
    studentProfile: StudentProfile,
    learningGoals: string[]
  ): PersonalizedContent;
  
  // Provide feedback
  getFeedback(
    answers: Answer[],
    studentStrengths: string[],
    studentWeaknesses: string[]
  ): Feedback;
}
```

## Specific Code Patterns to Steal

### 1. LangGraph Director Pattern

**File**: `/tmp/OpenMAIC/lib/orchestration/director-graph.ts`

**Key Pattern**: Unified graph for single/multi-agent with conditional edges

```typescript
// Worth stealing for TTRPG initiative tracking
export function createOrchestrationGraph() {
  const graph = new StateGraph(OrchestratorState)
    .addNode('director', directorNode)
    .addNode('agent_generate', agentGenerateNode)
    .addEdge(START, 'director')
    .addConditionalEdges('director', directorCondition, {
      agent_generate: 'agent_generate',
      [END]: END,
    })
    .addEdge('agent_generate', 'director');

  return graph.compile();
}
```

### 2. Stateless SSE Streaming

**File**: `/tmp/OpenMAIC/app/api/chat/route.ts`

**Key Pattern**: Heartbeat mechanism to prevent connection timeout

```typescript
// Heartbeat: periodically send SSE comments
const HEARTBEAT_INTERVAL_MS = 15_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const startHeartbeat = () => {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    try {
      writer.write(encoder.encode(`:heartbeat\n\n`)).catch(() => stopHeartbeat());
    } catch {
      stopHeartbeat();
    }
  }, HEARTBEAT_INTERVAL_MS);
};
```

### 3. Action Engine Pattern

**File**: `/tmp/OpenMAIC/lib/action/engine.ts`

**Key Pattern**: Unified execution layer with fire-and-forget vs synchronous actions

```typescript
class ActionEngine {
  async execute(action: Action): Promise<void> {
    // Auto-open whiteboard if a draw/clear/delete action is attempted
    if (action.type.startsWith('wb_') && action.type !== 'wb_open' && action.type !== 'wb_close') {
      await this.ensureWhiteboardOpen();
    }

    switch (action.type) {
      case 'spotlight':
        this.executeSpotlight(action); // Fire-and-forget
        return;
      case 'speech':
        return this.executeSpeech(action); // Synchronous
      // ...
    }
  }
}
```

### 4. Zustand Store with IndexedDB

**File**: `/tmp/OpenMAIC/lib/store/stage.ts`

**Key Pattern**: Debounced auto-save with IndexedDB persistence

```typescript
// Debounced version of saveToStorage
const debouncedSave = debounce(() => {
  useStageStore.getState().saveToStorage();
}, 500);

// Save method
saveToStorage: async () => {
  const { stage, scenes, currentSceneId, chats } = get();
  if (!stage?.id) return;
  
  try {
    const { saveStageData } = await import('@/lib/utils/stage-storage');
    await saveStageData(stage.id, { stage, scenes, currentSceneId, chats });
  } catch (error) {
    log.error('Failed to save to storage:', error);
  }
},
```

### 5. Roundtable UI Component

**File**: `/tmp/OpenMAIC/components/roundtable/index.tsx`

**Key Pattern**: Complex interactive UI with multiple states and animations

```typescript
// Audio indicator pattern
const AudioIndicator = ({ state, agentId }: { state: AudioIndicatorState; agentId?: string }) => {
  const bars = Array.from({ length: 8 }, (_, i) => (
    <motion.div
      key={i}
      className="w-1 bg-current rounded-full"
      animate={{
        height: state === 'speaking' ? `${20 + Math.random() * 30}%` : '20%',
      }}
      transition={{ duration: 0.2, delay: i * 0.05 }}
    />
  ));
  return <div className="flex items-end gap-0.5 h-6">{bars}</div>;
};
```

### 6. Browser TTS with Chrome Bug Workaround

**File**: `/tmp/OpenMAIC/lib/playback/engine.ts`

**Key Pattern**: Sentence-level chunking to avoid Chrome's 15s cutoff

```typescript
private splitIntoChunks(text: string): string[] {
  // Split on sentence-ending punctuation (Latin + CJK) and newlines
  const chunks = text
    .split(/(?<=[.!?。！？\n])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return chunks.length > 0 ? chunks : [text];
}

private playBrowserTTSChunk(): Promise<void> {
  if (this.browserTTSChunkIndex >= this.browserTTSChunks.length) {
    // All chunks done
    this.browserTTSActive = false;
    this.callbacks.onSpeechEnd?.();
    if (this.mode === 'playing') this.processNext();
    return;
  }
  // ... play current chunk
}
```

### 7. Prompt Template System

**File**: `/tmp/OpenMAIC/lib/generation/prompts/`

**Key Pattern**: Organized prompt templates with variable substitution

```typescript
// Template structure
templates/slide-content/
├── system.md
└── user.md

// System prompt example
export const slideContentSystem = `You are an AI teaching assistant creating educational slides...

## Slide Structure Guidelines
- Title: Clear and concise
- Content: 3-5 bullet points maximum
- Visuals: Include relevant images/charts
- Examples: Real-world applications

## JSON Output Format
{
  "title": "string",
  "content": {
    "canvas": {
      "elements": [
        {
          "id": "text_1",
          "type": "text",
          "content": "<p>...</p>"
        }
      ]
    }
  }
}`;
```

## Integration Ideas for log-origin

### 1. DMlog.ai Integration

**Architecture Mapping**:
```
OpenMAIC Component → DMlog.ai Equivalent
─────────────────────────────────────────
StageStore → CampaignStore
Scene → GameScene (combat/social/exploration)
AgentRegistry → CharacterRegistry (PCs/NPCs)
Director Graph → Initiative Tracker
Whiteboard → Battle Map
SlideRenderer → Scene Visualizer
Roundtable → Game Chat Interface
ActionEngine → Game Mechanics Engine
```

**Implementation Steps**:
1. **Phase 1**: Port Zustand stores and IndexedDB persistence
2. **Phase 2**: Adapt LangGraph director for initiative tracking
3. **Phase 3**: Extend Whiteboard for battle maps with grid/tokens
4. **Phase 4**: Create TTRPG-specific actions (roll_dice, apply_damage, etc.)
5. **Phase 5**: Integrate character sheet management
6. **Phase 6**: Add rule system integration (D&D 5e, Pathfinder, etc.)

### 2. StudyLog.ai Integration

**Architecture Mapping**:
```
OpenMAIC Component → StudyLog.ai Equivalent
────────────────────────────────────────────
Generation Pipeline → Study Material Generator
Quiz System → Flashcard/Test System
Interactive Scenes → Educational Simulations
PBL System → Study Group Projects
Roundtable → Study Group Discussion
Whiteboard → Collaborative Note-taking
SlideRenderer → Study Note Visualizer
```

**Implementation Steps**:
1. **Phase 1**: Port slide generation for study notes
2. **Phase 2**: Enhance quiz system with spaced repetition
3. **Phase 3**: Create subject-specific templates (math, science, language)
4. **Phase 4**: Add collaborative study rooms
5. **Phase 5**: Integrate with existing educational resources
6. **Phase 6**: Add progress tracking and analytics

### 3. Shared Infrastructure

**Core Services to Build**:
1. **Multi-User Real-time System**: WebSocket/SSE for live collaboration
2. **Media Generation Service**: Images/videos for both TTRPG and education
3. **Voice Synthesis Service**: Character voices and narration
4. **Rule Engine**: Game mechanics and educational content validation
5. **Content Database**: Shared repository of scenes, characters, study materials

**Technical Stack Decisions**:
- **Frontend**: Keep React/Next.js for consistency
- **State Management**: Zustand with IndexedDB (proven in OpenMAIC)
- **Real-time**: SSE for streaming, consider WebSocket for bi-directional
- **Backend**: Next.js API routes + separate microservices for heavy tasks
- **Database**: PostgreSQL for relational data, Redis for caching
- **Media**: Cloud storage (S3-compatible) with CDN

## Risk Assessment

### What's Complex (High Risk)

1. **LangGraph Integration**:
   - Learning curve for state machine design
   - Debugging complex graph flows
   - Performance optimization for real-time

2. **Canvas-based Slide Renderer**:
   - Complex SVG manipulation
   - Performance with many elements
   - Cross-browser compatibility issues

3. **Multi-User Real-time Sync**:
   - Conflict resolution
   - Network latency handling
   - Offline support and sync

4. **Media Generation Pipeline**:
   - Cost management (AI API calls)
   - Quality control
   - Fallback strategies

### What's Moderate Risk

1. **Zustand Store Architecture**:
   - Well-documented pattern
   - Proven in OpenMAIC
   - Need careful design for TTRPG-specific state

2. **Action Engine Pattern**:
   - Clear separation of concerns
   - Extensible for new action types
   - Testing complexity

3. **SSE Streaming**:
   - Established pattern in OpenMAIC
   - Heartbeat mechanism proven
   - Need error handling improvements

4. **Whiteboard Component**:
   - SVG-based drawing works well
   - Need extensions for TTRPG (grid, tokens)
   - Performance with many elements

### What's Easy (Low Risk)

1. **Prompt Template System**:
   - Simple file-based organization
   - Easy to adapt for TTRPG/education
   - Well-structured in OpenMAIC

2. **Component Architecture**:
   - Clear separation (ui, components, lib)
   - Reusable patterns
   - Good TypeScript support

3. **Build/Deployment Setup**:
   - pnpm workspace proven
   - Vercel deployment straightforward
   - Docker support available

4. **Internationalization**:
   - i18n hooks in place
   - Easy to extend
   - Chinese/English support

### What's Not Worth Porting

1. **PPT Export** (`packages/pptxgenjs`):
   - TTRPG doesn't need PowerPoint export
   - StudyLog might want PDF/HTML instead
   - Heavy dependency with complex code

2. **MathML to OMML Conversion** (`packages/mathml2omml`):
   - Specific to Office integration
   - Not needed for TTRPG
   - StudyLog might need LaTeX instead

3. **Some Media Providers**:
   - China-specific providers (Doubao, Bailian)
   - Expensive commercial providers
   - Focus on open-source/affordable options

4. **Legacy Code Paths**:
   - Old Vercel AI SDK tool calls
   - Deprecated session management
   - Unused experimental features

## Conclusion

OpenMAIC provides a **goldmine of patterns and architectures** for log-origin's TTRPG and educational platforms. The key takeaways:

### Strengths to Emulate:
1. **Multi-Agent Orchestration**: LangGraph-based director system is perfect for TTRPG initiative tracking
2. **Real-time Interactive UI**: Canvas-based rendering with live effects translates well to game visuals
3. **Content Generation Pipeline**: Two-stage generation adaptable for both game scenes and study materials
4. **State Management**: Robust Zustand + IndexedDB system for session persistence
5. **Extensibility**: Plugin architecture for easy feature addition

### Adaptation Strategy:
1. **Start with Core Infrastructure**: Zustand stores, action engine, SSE streaming
2. **Adapt LangGraph for TTRPG**: Director → Initiative tracker, agents → characters
3. **Extend Whiteboard for Battle Maps**: Grid system, tokens, fog of war
4. **Create Domain-Specific Actions**: TTRPG mechanics, educational interactions
5. **Build on Proven Patterns**: Prompt templates, media generation, real-time updates

### Recommended Implementation Order:
1. **Phase 1**: Infrastructure (stores, API, basic UI)
2. **Phase 2**: Core gameplay (character sheets, dice rolling, basic combat)
3. **Phase 3**: Advanced features (battle maps, spell effects, rule integration)
4. **Phase 4**: StudyLog adaptation (slide generation, quizzes, collaboration)
5. **Phase 5**: Polish and optimization (performance, UX, mobile support)

OpenMAIC demonstrates that **complex interactive AI systems are buildable** with modern web technologies. By adapting its patterns rather than copying wholesale, log-origin can create innovative platforms for both TTRPG gaming and interactive learning.

---

**File Count**: 500+ TypeScript/React files  
**Total Lines**: ~50,000+ lines of code  
**Key Insights**: 28+ action types, unified state machine, real-time SSE, extensible architecture  
**Adaptation Potential**: Very high for both TTRPG and educational applications
