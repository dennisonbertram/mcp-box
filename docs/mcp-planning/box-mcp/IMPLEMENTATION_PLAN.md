# Box MCP Server - Complete Implementation Plan

## Executive Summary

A Model Context Protocol (MCP) server that enables Large Language Models to securely interact with Box cloud storage without local file persistence. This server provides an intuitive, intent-based interface for document management, sharing, and AI-powered analysis.

## Project Philosophy

### Core Principles
- **Zero Local Storage**: Documents remain in Box cloud only
- **Intent-Based Design**: Tools match user intentions, not API operations
- **Security First**: Enterprise-grade security with encrypted credentials
- **Progressive Complexity**: Simple interface with advanced mode available

### Target Users
- LLM applications requiring secure document storage
- Enterprise teams using AI assistants
- Developers building document-aware AI systems
- Organizations with compliance requirements

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   LLM Client    │────▶│  Box MCP Server  │────▶│   Box API   │
│ (Claude, etc.)  │◀────│  (8 Core Tools)  │◀────│   Cloud     │
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                        │                      │
        │                        ▼                      ▼
        │                ┌──────────────────┐    ┌─────────────┐
        └────────────────│  Advanced Mode   │    │  Box Files  │
                         │  (45+ Tools)     │    └─────────────┘
                         └──────────────────┘
```

Transports
- stdio (Claude Desktop, local clients)
- HTTP + SSE (remote clients), with Bearer auth per MCP spec

MCP Objects
- Tools: intent-based set + advanced catalog
- Resources: optional Box file/folder references by URI
- Prompts: optional templates for common actions (e.g., share, analyze)

## Core Tool Set (8 Intent-Based Tools)

### 1. box_save_documents
**Intent**: "Save these documents to these folders"
- Batch upload multiple documents
- Automatic folder path creation
- Support for text, base64, and URL content
- Optional metadata and classification
- Sharing settings on upload

### 2. box_retrieve_documents
**Intent**: "Get these documents and optionally save locally"
- Batch retrieval by ID or path
- Optional local saving
- Include/exclude metadata
- Version selection support

### 3. box_read_document
**Intent**: "Read this document without saving it"
- Stream content without local storage
- Text extraction from PDFs/Office files
- Include comments and metadata
- Content truncation for large files
- Perfect for AI analysis workflows

### 4. box_manage_folders
**Intent**: "Create or organize this folder structure"
- Create nested folder paths
- Move, rename, delete operations
- Intelligent organization rules
- Batch folder operations

### 5. box_explore_storage
**Intent**: "Get the full directory listing"
- Tree structure visualization
- Configurable depth exploration
- File/folder filtering
- Size and date information
- Pattern matching support

### 6. box_share_content
**Intent**: "Share this with these people"
- Create shared links with settings
- Add collaborators with roles
- Batch sharing operations
- Password protection and expiration

### 7. box_analyze_document
**Intent**: "Use AI to understand this document"
- Document summarization
- Information extraction
- Q&A about content
- Classification
- Translation
- Powered by Box AI

### 8. box_search_content
**Intent**: "Find documents matching this query"
- Natural language search
- Filter by type, date, size, owner
- Search within content
- Tag and metadata search

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [x] Project setup and structure
- [x] Authentication system (OAuth 2.0, CCG, JWT)
- [x] MCP server foundation
- [x] Error handling framework
- [x] Configuration management

### Phase 2: Core Tools (Week 2-3)
- [ ] Implement 8 intent-based tools
- [ ] Path resolution utilities
- [ ] Batch operation support
- [ ] Content streaming
- [ ] Metadata handling

### Phase 3: Advanced Mode (Week 4)
- [ ] Advanced tool router
- [ ] 45+ granular tools
- [ ] Tool discovery system
- [ ] Migration helpers

### Phase 4: Production (Week 5-6)
- [ ] HTTP/SSE transport
- [ ] Rate limiting
- [ ] Caching layer
- [ ] Monitoring and logging
- [ ] Security hardening

## Technical Stack

### Core Dependencies
```json
{
  "@modelcontextprotocol/sdk": "*",
  "@box/sdk-gen": "*",
  "dotenv": "*",
  "winston": "*"
}
```

Notes
- Use Box TypeScript SDK v10 (published as `@box/sdk-gen`) for latest API coverage (v2025.0) and strong typing.
- Pin exact versions in `package.json` during implementation; keep SDKs up to date via Dependabot.

### Development Stack
- Language: TypeScript/Node.js
- Testing: Jest
- Linting: ESLint
- Formatting: Prettier
- CI/CD: GitHub Actions

## Security Architecture

### Authentication Flow
1. Client request → MCP Server
2. Token validation/refresh
3. Secure Box API call
4. Response sanitization
5. Return to client

### Security Features
- Encrypted credential storage (keychain/vault)
- Token auto-refresh
- Input sanitization
- Rate limiting per user
- Audit logging
- IP whitelisting (optional)

### Box API Considerations
- Respect rate limits (HTTP 429) and `Retry-After` header with exponential backoff + jitter.
- Scope-restricted tokens; follow least-privilege for OAuth/CCG/JWT.
- Stream uploads/downloads; prefer chunked uploads for large files.

## Configuration

### Environment Variables
```env
# Authentication
AUTH_TYPE=oauth              # oauth | ccg | jwt (legacy)
BOX_CLIENT_ID=xxx
BOX_CLIENT_SECRET=xxx
BOX_ENTERPRISE_ID=xxx

# Security
ENCRYPTION_SECRET=xxx
USE_KEYCHAIN=true

# Server
MCP_TRANSPORT=stdio          # stdio | http
LOG_LEVEL=info
NODE_ENV=development

# E2E/Testing (optional)
BOX_TEST_USER_LOGIN=tester@example.com
BOX_TEST_ROOT_FOLDER=mcp-e2e
BOX_API_VERSION=2025.0
```

### Deployment Modes
```yaml
development:
  transport: stdio
  auth: oauth
  logging: debug

staging:
  transport: http
  auth: jwt
  logging: info
  ssl: true

production:
  transport: http
  auth: service_account
  logging: warn
  ssl: true
  monitoring: true
```

## Usage Examples

### Save Documents
```javascript
{
  "name": "box_save_documents",
  "arguments": {
    "documents": [
      {
        "content": "Quarterly report content...",
        "path": "Reports/2024/Q1/summary.md",
        "metadata": {
          "classification": "Confidential"
        }
      },
      {
        "contentUrl": "https://data.example.com/metrics.csv",
        "path": "Data/2024/Q1/metrics.csv"
      }
    ],
    "options": {
      "createFolders": true,
      "shareSettings": {
        "createLink": true,
        "linkAccess": "company"
      }
    }
  }
}
```

### Read for Analysis
```javascript
{
  "name": "box_read_document",
  "arguments": {
    "path": "Contracts/2024/agreement.pdf",
    "options": {
      "extractText": true,
      "includeMetadata": true,
      "includeComments": true
    }
  }
}
```

### AI Analysis
```javascript
{
  "name": "box_analyze_document",
  "arguments": {
    "path": "Legal/contract.pdf",
    "analysisType": "summarize",
    "options": {
      "summaryLength": "detailed",
      "summaryFocus": "payment terms and obligations"
    }
  }
}
```

### Natural Language Search
```javascript
{
  "name": "box_search_content",
  "arguments": {
    "query": "quarterly financial reports from 2024",
    "filters": {
      "type": "file",
      "extensions": ["pdf", "xlsx"],
      "dateRange": {
        "from": "2024-01-01"
      }
    }
  }
}
```

## Testing Strategy

### Quality Gates
- Unit tests: ≥90% statements/branches on internal modules
- Integration tests: All core tools (8) with Box SDK mocked + live smoke
- E2E tests: Critical workflows over stdio and HTTP/SSE
- Type safety: `tsc --noEmit` clean; ESLint clean
- Performance: p95 tool latency budget ≤ 750ms (excluding upload/download time)

### Test Design
- Unit tests (Jest)
  - Path resolution, ID lookup, pagination handling
  - Error normalization and retry/backoff policies
  - Input schema validation (positive/negative cases)
- Integration tests (Jest + nock/Polly)
  - Mock `@box/sdk-gen` HTTP calls; record/replay fixtures
  - Upload/download streams; chunked upload boundaries
  - Search queries, folder listings, metadata ops
- MCP contract tests
  - Validate `initialize`, `tools/list`, `tools/call`, error shapes against MCP schemas
  - Verify tool schemas render correctly and reject invalid payloads
- E2E tests
  - Spawn built server (`child_process`) in stdio mode and drive JSON-RPC
  - Start HTTP server variant and drive via SSE client
  - Exercise flows:
    - save → read → analyze
    - manage_folders → explore_storage
    - share_content (link + collaborator)
    - search_content with filters
  - Use isolated test root folder `mcp-e2e/<run-id>`; clean up on success/failure

### TDD Workflow
For each tool:
1) Specify input/output schema and acceptance criteria
2) Write failing unit + integration tests (mock Box)
3) Implement handler mapping intent → Box SDK calls
4) Add E2E spec for the happy path + key edge cases
5) Refactor, ensure coverage thresholds met
6) Document examples and error cases

### CI/CD
- GitHub Actions matrix: Node 18/20; OS ubuntu-latest
- Jobs: lint → typecheck → unit → integration (mock) → e2e (nightly, requires secrets)
- Artifacts: coverage report; junit XML for CI annotations

### Representative Scenarios
- Batch operations with 100+ files (throttling + retries)
- Large file handling (>= 1 GB) via chunked uploads
- Concurrent operations and ordering guarantees
- Network failure recovery (timeouts, 5xx, 429 with backoff)
- Token refresh cycles (expired/invalid tokens)
- Permission errors (403) and missing-path semantics

## Deployment Options

### 1. Docker Container
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci --production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### 2. Cloud Functions
- AWS Lambda with API Gateway
- Google Cloud Run
- Azure Functions

### 3. Self-Hosted
```bash
npm install -g box-mcp-server
box-mcp-server start --config ./config.json
```

## Monitoring & Observability

### Key Metrics
- Request latency (p50, p95, p99)
- Upload/download throughput
- API quota usage
- Error rates by type
- Active users
- Storage managed

### Logging
```javascript
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "action": "document_saved",
  "user": "user@example.com",
  "path": "Reports/2024/Q1/summary.pdf",
  "size": 1048576,
  "duration": 1234
}
```

## Advanced Mode

The complete 45+ tool set remains available for power users:

### Tool Categories
- **File Operations** (12 tools): Individual CRUD operations
- **Folder Management** (10 tools): Granular folder control
- **Sharing & Collaboration** (8 tools): Detailed permission management
- **Search & Discovery** (6 tools): Advanced search capabilities
- **Metadata & Classification** (5 tools): Metadata operations
- **Advanced Operations** (4+ tools): ZIP, watermark, preview

### Accessing Advanced Tools
```javascript
{
  "name": "box_advanced_mode",
  "arguments": {
    "tool": "box_set_retention_policy",
    "parameters": {
      "fileId": "123456",
      "policy": "7_years"
    }
  }
}
```

## Success Metrics

### Performance KPIs
- Response time <500ms (p95)
- Upload speed >10MB/s
- 99.9% uptime
- Zero data loss

### Adoption Metrics
- Daily active users
- Documents processed/day
- Storage managed (TB)
- AI analyses performed

## Timeline

### Development (6 weeks)
- Week 1: Foundation & Auth (MCP stdio + OAuth/CCG, scaffolding) ✓
- Week 2: TDD for save/read/manage tools; E2E baseline (stdio)
- Week 3: TDD for explore/share/search; E2E HTTP/SSE variant
- Week 4: Box AI analyze tool + advanced mode router; integration tests
- Week 5: Hardening (rate limits, retries, streaming); perf and security tests
- Week 6: Production polish (logging, metrics), docs, release

### Post-Launch
- Week 7-8: Beta testing
- Week 9-10: Performance optimization
- Week 11-12: Feature additions
- Ongoing: Maintenance

## Risk Mitigation

### Technical Risks
- **Large Files**: Chunked upload/streaming
- **API Limits**: Smart rate limiting
- **Network Issues**: Exponential backoff
- **Token Expiry**: Proactive refresh

### Security Risks
- **Credential Leaks**: Encrypted storage
- **Unauthorized Access**: Role validation
- **Data Exposure**: Minimal responses
- **API Abuse**: User-level throttling

## Documentation Structure

```
docs/
├── mcp-planning/
│   └── box-mcp/
│       ├── IMPLEMENTATION_PLAN.md     # This document
│       ├── 0000_overview.md                 # Full project overview
│       ├── 0001_authentication_foundation.md# Auth implementation
│       ├── 0002_file_operations.md          # Advanced file tools
│       ├── 0003_folder_sharing_tools.md     # Advanced folder tools
│       ├── 0004_simplified_intent_tools.md  # Core 8 tools detail
│       ├── mcp-protocol-reference.md        # MCP documentation
│       └── box-api-reference.md             # Box API documentation
└── user/
    ├── README.md                       # User documentation
    ├── QUICK_START.md                 # Getting started
    └── API_REFERENCE.md               # Tool reference

```

## Next Steps

1. **Immediate Actions**
   - Set up development environment (Node 20, TypeScript, Jest)
   - Configure Box application (OAuth or CCG per environment)
   - Initialize repository with CI, lint, typecheck, test scaffolding

2. **Week 1 Goals**
   - Complete authentication system (OAuth + CCG) with token refresh
   - TDD: implement `box_save_documents` with unit/integration + fixtures
   - Establish E2E harness (stdio) with ephemeral test folder

3. **Communication**
   - Weekly progress updates
   - Tool documentation as completed
   - Beta tester recruitment

## Contact & Resources

### Resources
- [Box API Documentation](https://developer.box.com)
- [MCP Specification](https://modelcontextprotocol.io)
- [Project Repository](https://github.com/[org]/box-mcp-server)

### Support
- Technical Issues: GitHub Issues
- Security Concerns: security@[org].com
- General Questions: Discussions forum

---

*Last Updated: 2025-09-23*
*Version: 1.0.0*
*Status: Planning Updated with TDD & E2E*
