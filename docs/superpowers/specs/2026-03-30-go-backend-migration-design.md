# Go Backend Migration Design

**Date**: 2026-03-30
**Author**: AI Assistant
**Status**: Draft

---

## 1. Overview

### 1.1 Goal

Migrate the Python FastAPI backend to Go (Gin framework) while maintaining full API compatibility with the existing Next.js frontend.

### 1.2 Scope

- **In Scope**: All REST APIs and WebSocket endpoints under `/adh/*`
- **Out of Scope**: Frontend changes, database migrations (none exist), authentication system (not implemented in Python)

### 1.3 Success Criteria

1. All existing frontend features work without modification
2. Go backend passes all API compatibility tests
3. Response times are equal or better than Python backend
4. Memory usage is lower than Python backend

---

## 2. Technical Decisions

### 2.1 Technology Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| HTTP Framework | Gin | Mature ecosystem, similar DX to FastAPI |
| WebSocket | gorilla/websocket | Community standard, good documentation |
| Configuration | Viper | YAML + env vars support, matches Python yacs |
| Logging | Zap | High performance structured logging |
| JSON | encoding/json + jsoniter | Standard + performance optimization |

### 2.2 Migration Strategy

**Approach**: C. Module-by-Module Replacement

- Gradual migration with traffic routing via reverse proxy
- Order: Agent → TTS → ASR (simple to complex)
- Each module can be independently verified and rolled back

### 2.3 Deployment Strategy

**Approach**: C. Reverse Proxy Routing

```
Nginx/Gateway:
  /adh/agent/* → Go:8881
  /adh/tts/*  → Go:8881 (Phase 3)
  /adh/asr/*  → Go:8881 (Phase 4)
  other       → Python:8880
```

### 2.4 Code Organization

**Approach**: C. Layered Protocol

```
go-backend/
├── internal/
│   ├── protocol/        # Base types (shared)
│   │   ├── enums.go
│   │   ├── messages.go
│   │   └── response.go
│   ├── server/handlers/ # API handlers
│   ├── engine/          # Engine implementations
│   └── agent/           # Agent implementations
```

---

## 3. Architecture

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Nginx / Gateway                         │
│   /adh/agent/* → Go:8881    Other → Python:8880                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│     Go Backend :8881     │     │   Python Backend :8880  │
│                         │     │   (Gradual deprecation) │
└─────────────────────────┘     └─────────────────────────┘
```

### 3.2 Go Backend Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Gin Router                            │
│  /adh/agent/v0/*  /adh/tts/v0/*  /adh/asr/v0/*              │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                      Handler Layer                            │
│  AgentHandler  TTSHandler  ASRHandler  WebSocketHandler      │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                   Engine/Agent Pool                           │
│  EnginePool (singleton)  AgentPool (singleton)               │
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                   External Services                           │
│  EdgeTTS API  Dify API  Coze API  OpenAI API  FunASR        │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Directory Structure

```
go-backend/
├── cmd/
│   └── server/
│       └── main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── protocol/
│   │   ├── enums.go
│   │   ├── messages.go
│   │   ├── response.go
│   │   └── websocket.go
│   ├── server/
│   │   ├── router.go
│   │   ├── middleware.go
│   │   └── handlers/
│   │       ├── common.go
│   │       ├── agent.go
│   │       ├── tts.go
│   │       ├── asr.go
│   │       └── websocket.go
│   ├── engine/
│   │   ├── engine.go
│   │   ├── pool.go
│   │   ├── asr/
│   │   │   ├── factory.go
│   │   │   └── types.go
│   │   ├── tts/
│   │   │   ├── factory.go
│   │   │   ├── edge.go
│   │   │   └── types.go
│   │   └── llm/
│   │       └── factory.go
│   ├── agent/
│   │   ├── agent.go
│   │   ├── pool.go
│   │   ├── factory.go
│   │   ├── repeater.go
│   │   ├── openai.go
│   │   ├── dify.go
│   │   ├── coze.go
│   │   ├── fastgpt.go
│   │   └── conversation.go
│   └── pkg/
│       ├── logger/
│       └── httputil/
├── configs/
│   ├── config.yaml
│   ├── engines/
│   └── agents/
├── test/
├── go.mod
└── go.sum
```

---

## 4. API Specification

### 4.1 Agent API Endpoints

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/adh/agent/v0/engine` | GET | List agents | - | `EngineListResp` |
| `/adh/agent/v0/engine/default` | GET | Get default agent | - | `EngineDefaultResp` |
| `/adh/agent/v0/engine/{engine}` | GET | Get agent params | - | `EngineParamResp` |
| `/adh/agent/v0/engine/{engine}` | POST | Create conversation | `ConversationInput` | `ConversationIdResp` |
| `/adh/agent/v0/engine` | POST | Agent inference (SSE) | `AgentEngineInput` | SSE Stream |

### 4.2 TTS API Endpoints

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/adh/tts/v0/engine` | GET | List TTS engines | - | `EngineListResp` |
| `/adh/tts/v0/engine/default` | GET | Get default engine | - | `EngineDefaultResp` |
| `/adh/tts/v0/engine/{engine}` | GET | Get engine params | - | `EngineParamResp` |
| `/adh/tts/v0/engine/{engine}/voice` | GET | Get voice list | - | `VoiceListResp` |
| `/adh/tts/v0/engine` | POST | TTS inference | `TTSEngineInput` | `TTSEngineOutput` |

### 4.3 ASR API Endpoints

| Endpoint | Method | Description | Request | Response |
|----------|--------|-------------|---------|----------|
| `/adh/asr/v0/engine` | GET | List ASR engines | - | `EngineListResp` |
| `/adh/asr/v0/engine/default` | GET | Get default engine | - | `EngineDefaultResp` |
| `/adh/asr/v0/engine/{engine}` | GET | Get engine params | - | `EngineParamResp` |
| `/adh/asr/v0/engine` | POST | ASR inference | `ASREngineInput` | `ASREngineOutput` |
| `/adh/asr/v0/engine/file` | POST | ASR file inference | FormData | `ASREngineOutput` |
| `/adh/asr/v0/engine/stream` | WS | Streaming ASR | Binary Protocol | Binary Protocol |

### 4.4 SSE Event Types

| Event | Data | Description |
|-------|------|-------------|
| `CONVERSATION_ID` | UUID | New conversation created |
| `MESSAGE_ID` | UUID | Message identifier |
| `TEXT` | String | Text chunk |
| `THINK` | String | Thinking content |
| `TASK` | Task ID | Task identifier |
| `DONE` | "Done" | Stream completed |
| `ERROR` | Error message | Error occurred |

### 4.5 WebSocket Protocol

**Binary Message Format** (22-byte header + payload):

```
┌──────────────────┬──────────────────────┬──────────────────┐
│  Action (18B)    │ Payload Size (4B)    │   Payload        │
│  UTF-8, padded   │  Big-endian uint32   │   Variable       │
└──────────────────┴──────────────────────┴──────────────────┘
```

**Client Actions**: `PING`, `ENGINE_START`, `PARTIAL_INPUT`, `FINAL_INPUT`, `ENGINE_STOP`

**Server Actions**: `PONG`, `ENGINE_INITIALZING`, `ENGINE_STARTED`, `PARTIAL_OUTPUT`, `FINAL_OUTPUT`, `ENGINE_STOPPED`, `ERROR`

---

## 5. Data Models

### 5.1 Enums

```go
type ENGINE_TYPE string
const (
    ENGINE_TYPE_ASR    ENGINE_TYPE = "ASR"
    ENGINE_TYPE_TTS    ENGINE_TYPE = "TTS"
    ENGINE_TYPE_LLM    ENGINE_TYPE = "LLM"
    ENGINE_TYPE_AGENT  ENGINE_TYPE = "AGENT"
)

type AUDIO_TYPE string
const (
    AUDIO_TYPE_MP3 AUDIO_TYPE = "mp3"
    AUDIO_TYPE_WAV AUDIO_TYPE = "wav"
)

type INFER_TYPE string
const (
    INFER_TYPE_NORMAL INFER_TYPE = "normal"
    INFER_TYPE_STREAM INFER_TYPE = "stream"
)
```

### 5.2 Core Models

```go
// Base response wrapper
type BaseResponse struct {
    Code    int         `json:"code"`
    Message string      `json:"message"`
    Data    interface{} `json:"data,omitempty"`
}

// Engine description
type EngineDesc struct {
    Name      string            `json:"name"`
    Type      ENGINE_TYPE       `json:"type"`
    InferType INFER_TYPE        `json:"infer_type"`
    Desc      string            `json:"desc"`
    Meta      map[string]string `json:"meta"`
}

// Parameter description
type ParamDesc struct {
    Name        string      `json:"name"`
    Description string      `json:"description"`
    Type        PARAM_TYPE  `json:"type"`
    Required    bool        `json:"required"`
    Range       []string    `json:"range,omitempty"`
    Choices     []string    `json:"choices,omitempty"`
    Default     interface{} `json:"default"`
}

// Audio message
type AudioMessage struct {
    Data        []byte     `json:"data,omitempty"`
    Type        AUDIO_TYPE `json:"type"`
    SampleRate  int        `json:"sampleRate"`
    SampleWidth int        `json:"sampleWidth"`
}
```

### 5.3 Request/Response Models

```go
// Agent request
type AgentEngineInput struct {
    Engine         string                 `json:"engine"`
    Config         map[string]interface{} `json:"config"`
    Data           string                 `json:"data"`
    ConversationID string                 `json:"conversation_id"`
}

// TTS request
type TTSEngineInput struct {
    Engine string                 `json:"engine"`
    Config map[string]interface{} `json:"config"`
    Data   string                 `json:"data"`
}

// ASR request
type ASREngineInput struct {
    Engine       string                 `json:"engine"`
    Config       map[string]interface{} `json:"config"`
    Data         string                 `json:"data"`
    Type         AUDIO_TYPE             `json:"type"`
    SampleRate   int                    `json:"sampleRate"`
    SampleWidth  int                    `json:"sampleWidth"`
}
```

---

## 6. Migration Phases

### Phase 1: Project Skeleton + RepeaterAgent (2-3 days)

**Goal**: Set up Go project infrastructure and implement simplest agent to validate the pipeline.

**Tasks**:
1. Initialize Go module and directory structure
2. Implement configuration system (Viper)
3. Implement logging system (Zap)
4. Define protocol layer (enums, messages, responses)
5. Set up Gin router with CORS middleware
6. Define Agent interface and AgentPool
7. Implement RepeaterAgent
8. Implement Agent API handlers
9. Write unit tests

**Deliverables**:
- Go project compiles and runs
- `/adh/agent/v0/engine` returns RepeaterAgent
- Agent streaming works via SSE

**Risk Points**:
- 🔴 SSE format must match exactly: `event: TEXT\ndata: xxx\n\n`
- 🔴 CORS must allow frontend origin
- 🟡 Config file path resolution

### Phase 2: Complete Agent Implementation (3-4 days)

**Goal**: Implement all agent types, fully compatible with Python backend.

**Tasks**:
1. Implement OpenAIAgent
2. Implement DifyAgent
3. Implement CozeAgent
4. Implement FastGPTAgent
5. Implement AgentFactory
6. Implement conversation management
7. Complete all Agent API endpoints
8. Write integration tests

**Deliverables**:
- All 5 agents work correctly
- Multi-turn conversations work
- Frontend `/adh/agent/*` routes to Go

**Risk Points**:
- 🔴 SSE event order: CONVERSATION_ID → TEXT... → DONE
- 🔴 Conversation history must be maintained correctly
- 🔴 API keys must not be hardcoded
- 🟡 External API timeouts
- 🟡 Goroutine cleanup on client disconnect

### Phase 3: TTS Implementation (4-5 days)

**Goal**: Implement TTS module, migrate Edge TTS and other providers.

**Tasks**:
1. Define TTS Engine interface
2. Implement EnginePool
3. Implement Edge TTS (HTTP call to Microsoft API)
4. Implement Tencent TTS
5. Implement Dify TTS
6. Implement Coze TTS
7. Implement TTS API handlers
8. Write tests

**Deliverables**:
- `/adh/tts/*` routes to Go
- Edge TTS produces correct audio

**Risk Points**:
- 🔴 Edge TTS API is undocumented, may change
- 🔴 Audio format conversion (mp3 vs wav)
- 🟡 Large audio responses may need streaming

### Phase 4: ASR Implementation (5-7 days)

**Goal**: Implement ASR module including WebSocket streaming.

**Tasks**:
1. Define ASR Engine interface
2. Implement WebSocket binary protocol
3. Implement FunASR streaming client
4. Implement Tencent ASR
5. Implement Dify ASR
6. Implement Coze ASR
7. Implement ASR API handlers
8. Implement WebSocket handler
9. Write tests

**Deliverables**:
- All `/adh/*` routes to Go
- Python backend can be stopped

**Risk Points**:
- 🔴 WebSocket binary protocol must match exactly (22-byte header)
- 🔴 Streaming state management in WebSocket
- 🔴 Audio chunk handling and timing
- 🟡 FunASR service connection management

### Phase 5: Integration & Cutover (2-3 days)

**Goal**: Final integration testing and production cutover.

**Tasks**:
1. End-to-end testing with frontend
2. Performance benchmarking
3. Load testing
4. Update Nginx configuration
5. Monitoring and alerting setup
6. Documentation
7. Python backend deprecation

**Deliverables**:
- Go backend handles all traffic
- Python backend stopped
- Documentation complete

---

## 7. Testing Strategy

### 7.1 Unit Tests

- Each agent/engine implementation
- Protocol encoding/decoding
- WebSocket message parsing
- SSE event formatting

### 7.2 Integration Tests

- API endpoint compatibility tests
- Compare Go vs Python responses
- Frontend integration tests

### 7.3 Compatibility Tests

Use the existing Python test suite:
- `test/test_agent_api.py`
- `test/test_tts_api.py`
- `test/test_asr_api.py`
- `test/test_asr_websocket_client.py`

---

## 8. Rollback Plan

Each phase can be independently rolled back via Nginx configuration:

```nginx
# Rollback Phase 2 (Agent)
location /adh/agent/ {
    proxy_pass http://python-backend:8880;
}

# Keep other modules on Go
location /adh/tts/ {
    proxy_pass http://go-backend:8881;
}
location /adh/asr/ {
    proxy_pass http://go-backend:8881;
}
```

---

## 9. Configuration

### 9.1 Go Config (configs/config.yaml)

```yaml
common:
  name: "Awesome-Digital-Human"
  version: "v3.0.0"
  log_level: "debug"

server:
  ip: "0.0.0.0"
  port: 8881
  workspace_path: "./outputs"

agents:
  support_list:
    - name: "RepeaterAgent"
      type: "AGENT"
      desc: "Repeat user input"
    - name: "OpenAIAgent"
      type: "AGENT"
      api_key: "${OPENAI_API_KEY}"
  default: "RepeaterAgent"

engines:
  tts:
    support_list:
      - name: "EdgeTTS"
        type: "TTS"
    default: "EdgeTTS"
  asr:
    support_list: []
    default: ""
```

### 9.2 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CONFIG_PATH` | Config file path | `./configs/config.yaml` |
| `LOG_LEVEL` | Logging level | `info` |
| `SERVER_PORT` | Server port | `8881` |
| `OPENAI_API_KEY` | OpenAI API key | - |

---

## 10. Dependencies

```go
// go.mod
require (
    github.com/gin-gonic/gin v1.9+
    github.com/gorilla/websocket v1.5+
    github.com/spf13/viper v1.18+
    go.uber.org/zap v1.26+
    github.com/sashabaranov/go-openai v1.17+
)
```

---

## 11. References

- Python backend: `digitalHuman/`
- Frontend protocol: `web/lib/protocol.ts`
- Streaming protocol: `docs/streaming_protocol.md`
- API client: `web/lib/api/server.ts`