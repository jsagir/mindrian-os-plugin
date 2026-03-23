# Live Join Interface -- External Transcript Source Design Spec

*Design specification for future `--join` and `--latest` flags. NOT implemented in Phase 6.*

---

## Status

| Feature | Phase | Status |
|---------|-------|--------|
| `file-meeting` (paste/upload) | Phase 6 | Active development |
| `file-meeting --latest` | Phase 8 | Design only |
| `file-meeting --join <url>` | Phase 9+ | Design only |

This document defines the interface contract so that future phases can implement external transcript sources without changing the core filing pipeline.

---

## Interface Contract

All external transcript sources MUST produce output in one of the supported formats defined in `references/meeting/transcript-patterns.md`. The filing pipeline does not change -- only the input source changes.

```
External Source -> Transcript (supported format) -> file-meeting pipeline -> Room
```

### Input Normalization

Any external source adapter must output:
1. A text file in Zoom, Teams, Otter, Meet, or Raw format, OR
2. A JSON file in Velma format (with `speaker_id`, `text`, `start_time`, `end_time`, `emotions[]`)

The `file-meeting` command does not know or care where the transcript came from. It only knows formats.

---

## `--latest` Flag (Phase 8)

**Purpose:** Pull the most recent meeting transcript from a connected service.

### Usage

```bash
/mindrian-os:file-meeting --latest
/mindrian-os:file-meeting --latest --source read-ai
/mindrian-os:file-meeting --latest --source velma
```

### Behavior

1. Query the configured transcript source for the most recent meeting
2. Download the transcript
3. Convert to a supported format if needed
4. Pass to the standard `file-meeting` pipeline
5. Include `source: {service-name}` in artifact frontmatter

### Source Priority (when no `--source` specified)

1. Velma (if configured) -- highest quality (emotions, diarization)
2. Read AI MCP (if configured) -- broadest meeting platform coverage
3. Recall.ai (if configured) -- fallback

### Configuration

```json
// .mcp.json or room config
{
  "transcript_sources": {
    "velma": {
      "api_url": "ENV:VELMA_API_URL",
      "api_key": "ENV:VELMA_API_KEY"
    },
    "read_ai": {
      "mcp_server": "read-ai-mcp"
    },
    "recall_ai": {
      "api_key": "ENV:RECALL_API_KEY"
    }
  }
}
```

---

## `--join` Flag (Phase 9+)

**Purpose:** Join a live meeting and transcribe in real-time, filing segments as they occur.

### Usage

```bash
/mindrian-os:file-meeting --join https://zoom.us/j/123456789
/mindrian-os:file-meeting --join https://teams.microsoft.com/l/meetup-join/...
```

### Behavior

1. Connect to the meeting via an attend-mcp compatible service
2. Stream transcript segments in real-time
3. Classify and file segments as they arrive (with user confirmation batched)
4. Produce the meeting summary when the meeting ends or user disconnects

### Live Filing Modes

| Mode | Description | User Interaction |
|------|-------------|------------------|
| silent | Transcribe and classify, file after meeting ends | Post-meeting confirm-then-file |
| notify | Transcribe and classify, surface high-priority items live | User sees notifications during meeting |
| interactive | Full confirm-then-file during the meeting | User approves each filing in real-time |

Default: `silent` -- do not interrupt the meeting.

---

## External Service Comparison

### attend-mcp (github.com/xpos/attend-mcp)

| Attribute | Value |
|-----------|-------|
| Type | MCP server |
| Cost | Open source (free) |
| Self-hostable | Yes |
| Platforms | Zoom, Teams, Google Meet |
| Diarization | Basic (speaker labels from platform) |
| Emotions | No |
| Real-time | Yes (streaming) |
| Integration | MCP tool calls |

**Best for:** Self-hosted deployments, privacy-conscious users, developers.

### Recall.ai

| Attribute | Value |
|-----------|-------|
| Type | API service |
| Cost | ~$0.50/hour |
| Self-hostable | No |
| Platforms | Zoom, Teams, Google Meet, Webex, GoTo |
| Diarization | Yes (high quality) |
| Emotions | No |
| Real-time | Yes (webhooks) |
| Integration | REST API + webhooks |

**Best for:** Production deployments, broadest platform support, reliable diarization.

### Vexa

| Attribute | Value |
|-----------|-------|
| Type | Open source platform |
| Cost | Free (self-hosted) |
| Self-hostable | Yes (Apache-2.0) |
| Platforms | Zoom, Teams, Google Meet |
| Diarization | Yes |
| Emotions | Basic sentiment |
| Real-time | Yes |
| Integration | REST API |

**Best for:** Self-hosted deployments, budget-conscious teams, open-source preference.

### Modulate Velma (already integrated -- Phase 6, Plan 02)

| Attribute | Value |
|-----------|-------|
| Type | API service |
| Cost | ~$0.03/hour |
| Self-hostable | No |
| Platforms | Audio files (not live join) |
| Diarization | Yes (native, high quality) |
| Emotions | Yes (20+ categories) |
| Real-time | No (file upload) |
| Integration | REST API (scripts/transcribe-velma) |

**Best for:** Audio file transcription, emotion-aware filing, lowest cost per hour.

---

## Adapter Interface

Future adapters must implement this contract:

```bash
# Adapter script interface
# Input: meeting URL or "latest" command
# Output: transcript file in supported format, written to stdout or specified path
# Exit: 0 on success, 1 on failure

scripts/adapters/{source-name} [--latest | --join <url>] [--output <path>]
```

### Required Adapter Outputs

1. Transcript file (in a supported format)
2. Meeting metadata (written to stderr as JSON):
   ```json
   {
     "meeting_name": "...",
     "meeting_date": "YYYY-MM-DD",
     "duration_minutes": 60,
     "platform": "zoom",
     "speakers_detected": 4
   }
   ```

### Error Handling

| Error | Adapter Behavior |
|-------|-----------------|
| Auth required | Exit 1 with message: "Authentication required. Run: {auth command}" |
| Meeting not found | Exit 1 with message: "No meeting found at {url}" |
| Service unavailable | Exit 1 with message: "{service} is unreachable" |
| Timeout | Exit 1 after 30 seconds with message: "Connection timed out" |

---

## Phase Dependencies

```
Phase 6 (current):
  - file-meeting accepts paste/upload
  - Velma transcribes audio files
  - No external live sources

Phase 8 (--latest):
  - Read AI MCP integration
  - Pull most recent transcript
  - Same pipeline, new input source

Phase 9+ (--join):
  - attend-mcp or Recall.ai integration
  - Live meeting attendance
  - Real-time transcript streaming
  - Post-meeting or live filing modes
```

---

## Cross-Reference

- Supported transcript formats: `references/meeting/transcript-patterns.md`
- Velma integration: `scripts/transcribe-velma` (Phase 6, Plan 02)
- Filing pipeline: `references/meeting/artifact-template.md`
- Read AI requirements: RDAI-01, RDAI-02, RDAI-03 (Phase 8)
