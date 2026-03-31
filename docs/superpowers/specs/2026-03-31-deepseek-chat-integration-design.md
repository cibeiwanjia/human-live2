# DeepSeek Chat Integration Design

**Date**: 2026-03-31
**Status**: Approved
**Scope**: Backend configuration change to enable LLM chat in immersive mode

---

## Overview

Enable LLM-powered chat in the immersive mode by configuring the backend to use `OpenAIAgent` with DeepSeek API instead of the current `RepeaterAgent` (echo mode).

### Current State

- Backend has complete Agent infrastructure supporting OpenAI, Dify, Coze, FastGPT
- Frontend has complete chat components (ChatInput, ChatRecord) with SSE streaming
- TTS + Live2D integration is fully functional
- **Problem**: Backend config `default: "RepeaterAgent"` returns user input verbatim

### Target State

- Backend configured to use `OpenAIAgent` with DeepSeek API
- User text input → LLM response → TTS audio → Live2D lip-sync animation
- No frontend code changes required

---

## Architecture

### System Flow

```
User Input → ChatInput → useChatWithAgent → POST /adh/agent/v0/engine
                                                          ↓
                                          OpenAIAgent → DeepSeek API
                                                          ↓
                                          SSE Stream Events
                                                          ↓
                              ├→ ChatRecord: Display streaming text
                              └→ TTS: Sentence-by-sentence synthesis
                                    ↓
                              Live2dManager.pushAudioQueue → Lip-sync animation
```

### Key Components

| Component | File | Role |
|-----------|------|------|
| Agent Config | `go-backend/configs/config.yaml` | Defines available agents and default |
| Agent Factory | `go-backend/internal/agent/factory.go` | Creates agent instances by name |
| OpenAI Agent | `go-backend/internal/agent/openai.go` | OpenAI-compatible API client with SSE |
| Chat Hook | `web/app/(products)/sentio/hooks/chat.ts` | Orchestrates Agent + TTS flow |
| Chat Input | `web/app/(products)/sentio/components/chatbot/input.tsx` | Text/voice input UI |
| Chat Record | `web/app/(products)/sentio/components/chatbot/record.tsx` | Message display with Markdown |
| Live2D Manager | `web/lib/live2d/live2dManager.ts` | Audio queue + lip-sync control |

---

## Implementation

### 1. Backend Configuration

**File**: `go-backend/configs/config.yaml`

```yaml
agents:
  support_list:
    - name: "RepeaterAgent"
      type: "agent"
      desc: "Repeat user input (for testing)"
    - name: "OpenAIAgent"
      type: "agent"
      desc: "OpenAI compatible agent"
      config:
        api_key: "${LLM_API_KEY}"
        base_url: "${LLM_BASE_URL}"
        model: "${LLM_MODEL:deepseek-chat}"
  default: "OpenAIAgent"
```

### 2. Environment Variables

Required at backend startup:

```bash
export LLM_API_KEY="sk-xxxxx"                    # DeepSeek API key
export LLM_BASE_URL="https://api.deepseek.com/v1" # DeepSeek endpoint
export LLM_MODEL="deepseek-chat"                  # Model name (optional)
```

### 3. Frontend (No Changes)

Existing logic works unchanged:
- `useSentioAgentStore().engine === "default"` → maps to backend's `OpenAIAgent`
- `api_agent_stream()` handles SSE parsing
- `useChatWithAgent` orchestrates TTS scheduling

---

## Data Flow Details

### Agent Request/Response Protocol

**Request** (POST `/adh/agent/v0/engine`):
```json
{
  "engine": "OpenAIAgent",
  "config": {},
  "data": "用户输入的文字",
  "conversation_id": ""
}
```

**Response** (SSE Stream):
```
event: CONVERSATION_ID
data: uuid-xxx

event: MESSAGE_ID
data: uuid-yyy

event: TEXT
data: 你好

event: TEXT
data: ！我是

event: TEXT
data: DeepSeek助手

event: DONE
data: Done
```

### TTS Integration Flow

Inside `useChatWithAgent.chat.ts`:

1. Accumulate TEXT events into `agentResponse` buffer
2. Find sentence boundaries (punctuation marks)
3. For each sentence segment:
   - Call `api_tts_infer()` → returns base64 audio
   - Convert MP3 → WAV array buffer
   - Push to `Live2dManager.pushAudioQueue()`
4. Live2D manager plays audio and drives lip-sync

---

## Error Handling

| Error Type | Handling |
|------------|----------|
| API Key invalid | SSE event `ERROR` → Toast notification |
| Network timeout | AbortController timeout → Stop streaming, show error |
| TTS synthesis fail | Skip audio, continue text display |
| Rate limit | SSE ERROR event → Display message to user |

---

## Testing

### Manual Testing Checklist

1. Start backend with DeepSeek credentials
2. Open `/sentio` page, switch to immersive mode
3. Send text message → Verify AI response streams
4. Verify TTS audio plays → Live2D mouth moves
5. Test abort (stop button) → Streaming stops
6. Test error case (invalid API key) → Error toast shown

### Integration Points

- OpenAIAgent.Run() → DeepSeek API streaming
- SSE parsing → TEXT/ERROR/DONE events
- Sentence splitting → TTS scheduling
- Audio queue → Live2D lip-sync

---

## Deployment

### Docker Compose

Add environment variables to `docker-compose.yml`:

```yaml
services:
  go-backend:
    environment:
      - LLM_API_KEY=${LLM_API_KEY}
      - LLM_BASE_URL=${LLM_BASE_URL:-https://api.deepseek.com/v1}
      - LLM_MODEL=${LLM_MODEL:-deepseek-chat}
```

### Config Override

Environment variables override config.yaml values via Viper's `AutomaticEnv()`.

---

## Limitations & Future Enhancements

### Current Limitations
- No conversation history (single-turn only)
- No system prompt customization
- Agent selection hardcoded to default

### Future Enhancements (Not in Scope)
- Multi-turn conversation with history
- System prompt configuration in settings page
- Agent switcher in frontend UI
- Voice input (ASR) → LLM → TTS loop

---

## Summary

| Aspect | Change |
|--------|--------|
| Backend Config | `config.yaml`: Add OpenAIAgent, set default |
| Backend Code | None (OpenAIAgent already implemented) |
| Frontend Code | None (existing flow works) |
| Deployment | Add LLM env vars |

**Total Files Modified**: 1 (`go-backend/configs/config.yaml`)
**Estimated Effort**: 30 minutes