# DeepSeek Chat Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure backend to use OpenAIAgent with DeepSeek API for LLM-powered chat in immersive mode.

**Architecture:** Modify single backend config file to switch default agent from RepeaterAgent to OpenAIAgent with DeepSeek API credentials via environment variables.

**Tech Stack:** Go backend with Viper config, OpenAI-compatible API, SSE streaming

---

## Chunk 0: Code Bug Fix (Critical)

### Task 0: Fix OpenAIAgent Implementation Bug

**Files:**
- Modify: `go-backend/internal/agent/openai.go:72,124`

**Problem:** The `Run` method receiver has a typo (`OpenAgent` instead of `OpenAIAgent`), causing compilation error. Also, the local `client` variable is declared but the method uses `a.client` directly.

- [ ] **Step 1: Verify compilation error**

Run: `cd go-backend && go build ./...`

Expected: Error `undefined: OpenAgent` at line 72

- [ ] **Step 2: Fix method receiver typo**

Change line 72 from:
```go
func (a *OpenAgent) Run(ctx context.Context, req *AgentRequest) (<-chan *protocol.SSEEvent, error) {
```

To:
```go
func (a *OpenAIAgent) Run(ctx context.Context, req *AgentRequest) (<-chan *protocol.SSEEvent, error) {
```

- [ ] **Step 3: Fix client variable usage**

Change line 124 from:
```go
stream, err := a.client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
```

To:
```go
stream, err := client.CreateChatCompletionStream(ctx, openai.ChatCompletionRequest{
```

- [ ] **Step 4: Fix model variable usage**

Change line 125 from:
```go
Model:    a.model,
```

To:
```go
Model:    model,
```

- [ ] **Step 5: Verify compilation**

Run: `cd go-backend && go build ./...`

Expected: No errors

- [ ] **Step 6: Commit bug fix**

```bash
git add go-backend/internal/agent/openai.go
git commit -m "fix: correct OpenAIAgent Run method receiver and variable usage"
```

---

## Chunk 1: Backend Configuration

### Task 1: Update Agent Configuration

**Files:**
- Modify: `go-backend/configs/config.yaml:25-30`

- [ ] **Step 1: Read current config file**

Run: Read `go-backend/configs/config.yaml` to verify current state

Expected: See `default: "RepeaterAgent"` at line 30

- [ ] **Step 2: Update agents configuration**

Modify `go-backend/configs/config.yaml`:

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

- [ ] **Step 3: Verify config syntax**

Run: `cat go-backend/configs/config.yaml | grep -A 15 "agents:"`

Expected: See updated agent list with OpenAIAgent as default

- [ ] **Step 4: Commit configuration change**

```bash
git add go-backend/configs/config.yaml
git commit -m "feat: configure OpenAIAgent with DeepSeek as default agent"
```

---

## Chunk 2: Deployment Configuration

### Task 2: Update Docker Compose (Optional)

**Files:**
- Modify: `go-backend/docker-compose.yml` (if exists)

- [ ] **Step 1: Check if docker-compose.yml exists**

Run: `ls -la go-backend/docker-compose.yml`

If file exists, proceed to Step 2. If not, skip this task.

- [ ] **Step 2: Add LLM environment variables to docker-compose**

Add to `go-backend/docker-compose.yml` under `services.go-backend.environment`:

```yaml
- LLM_API_KEY=${LLM_API_KEY}
- LLM_BASE_URL=${LLM_BASE_URL:-https://api.deepseek.com/v1}
- LLM_MODEL=${LLM_MODEL:-deepseek-chat}
```

- [ ] **Step 3: Commit docker-compose update**

```bash
git add go-backend/docker-compose.yml
git commit -m "feat: add LLM environment variables to docker-compose"
```

---

## Chunk 3: Verification

### Task 3: Manual Integration Test

**Files:**
- None (verification only)

- [ ] **Step 1: Set environment variables**

```bash
export LLM_API_KEY="your-deepseek-api-key"
export LLM_BASE_URL="https://api.deepseek.com/v1"
export LLM_MODEL="deepseek-chat"
```

- [ ] **Step 2: Start backend server**

```bash
cd go-backend
go run ./cmd/server
```

Expected: Server starts on port 8881

- [ ] **Step 3: Verify agent endpoint**

Run: `curl http://localhost:8881/adh/agent/v0/engine/default`

Expected: JSON response with `"name": "OpenAIAgent"`

- [ ] **Step 4: Test chat flow (requires frontend)**

1. Start frontend: `cd web && pnpm dev`
2. Open browser to `/sentio`
3. Switch to immersive mode
4. Send text message "你好"
5. Verify: AI response streams (not echo)
6. Verify: TTS audio plays
7. Verify: Live2D lip-sync animation

- [ ] **Step 5: Test error handling**

1. Set invalid API key: `export LLM_API_KEY="invalid"`
2. Restart backend
3. Send message in frontend
4. Verify: Error toast displayed

---

## Summary

| Task | Files Modified | Est. Time |
|------|----------------|-----------|
| Fix OpenAIAgent bug | `openai.go` | 3 min |
| Update agent config | `config.yaml` | 2 min |
| Update docker-compose | `docker-compose.yml` | 2 min |
| Manual verification | None | 10 min |

**Total Estimated Time**: 20 minutes

## Execution Notes

- **Critical**: Bug fix in `openai.go` is required for OpenAIAgent to compile
- Frontend code unchanged
- OpenAIAgent implementation exists but has a typo in method receiver
- Environment variables are loaded via Viper's `AutomaticEnv()` with `LLM_` prefix mapping

## Prerequisites

- DeepSeek API key (get from https://platform.deepseek.com/)
- Backend running on port 8881
- Frontend running on port 3000