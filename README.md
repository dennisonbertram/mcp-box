# Box MCP Server

A Model Context Protocol (MCP) server that provides secure access to Box cloud storage without local file persistence. This server enables Large Language Models to interact with Box files, folders, and AI capabilities through a standardized MCP interface.

## Features

### 🔧 **8 Core Tools (Intent-Based)**
- **`box_save_documents`** - Batch upload documents with automatic folder creation
- **`box_read_document`** - Stream document content without local storage
- **`box_manage_folders`** - Create and organize folder structures
- **`box_explore_storage`** - Navigate Box directory tree with filtering
- **`box_share_content`** - Create shared links and manage collaborations
- **`box_analyze_document`** - Use Box AI for document analysis, Q&A, and extraction
- **`box_search_content`** - Natural language search with advanced filtering
- **`box_retrieve_documents`** - Batch retrieval with optional local saving

### 📚 **MCP Resources (6 URI Templates)**
- `box://file/{fileId}` - Access specific Box files by ID
- `box://folder/{folderId}` - Access specific Box folders by ID
- `box://search?q={query}` - Search Box content with query parameters
- `box://user/storage` - Current user's storage quota and usage
- `box://user/recent` - Recently accessed files
- `box://folder/root/tree` - Complete folder structure from root

### 💬 **MCP Prompts (5 Interactive Templates)**
- **`share_file`** - Create shared links with customizable permissions
- **`analyze_document`** - Use Box AI to analyze documents with specific prompts
- **`organize_folder`** - Organize files using different strategies (by date, type, name)
- **`bulk_upload`** - Upload multiple files with folder organization
- **`collaboration_setup`** - Set up collaboration with specific users and roles

### 🔒 **Security & Compliance**
- **Zero Local Storage** - All documents remain in Box cloud
- **Multi-Auth Support** - OAuth 2.0, Client Credentials Grant (CCG), JWT
- **Encrypted Credentials** - Secure token storage and auto-refresh
- **Enterprise-Grade** - Leverages Box's enterprise security features

## Quick Start

### Prerequisites

1. **Box Developer Account** - [Create at Box Developer Console](https://developer.box.com/)
2. **Node.js 18+** - [Download Node.js](https://nodejs.org/)
3. **Box App Configuration** - OAuth 2.0 or Client Credentials Grant app

### Installation

```bash
# Clone and install
git clone https://github.com/your-org/mcp-box
cd mcp-box
npm install

# Build the server
npm run build
```

### Configuration

Create a `.env` file in the project root:

```env
# Authentication Method (oauth | ccg)
AUTH_TYPE=oauth

# Box App Credentials
BOX_CLIENT_ID=your_client_id_here
BOX_CLIENT_SECRET=your_client_secret_here
BOX_ENTERPRISE_ID=your_enterprise_id_here  # Required for CCG

# Server Configuration
MCP_TRANSPORT=stdio              # stdio | http
LOG_LEVEL=info                   # debug | info | warn | error
NODE_ENV=development
```

### Authentication Setup

#### OAuth 2.0 (Recommended for individual use)
```bash
# The server will guide you through OAuth flow on first use
npm start
```

#### Client Credentials Grant (Enterprise)
```env
AUTH_TYPE=ccg
BOX_CLIENT_ID=your_app_id
BOX_CLIENT_SECRET=your_app_secret
BOX_ENTERPRISE_ID=your_enterprise_id
```

## Integration Guides

### Claude Code Integration

Add this MCP server to Claude Code for seamless Box integration:

1. **Build the server:**
   ```bash
   npm run build
   ```

2. **Add to Claude Code configuration:**

   **Option A: Via Claude Code UI**
   - Open Claude Code settings
   - Navigate to "MCP Servers"
   - Add new server with these settings:
     - **Name**: `box-mcp-server`
     - **Command**: `node`
     - **Args**: `["/Users/your-username/path-to/mcp-box/dist/index.js"]`
     - **Environment Variables**: Add your `.env` variables

   **Option B: Edit Claude Code config file**
   ```json
   {
     "mcpServers": {
       "box-mcp-server": {
         "command": "node",
         "args": ["/Users/your-username/path-to/mcp-box/dist/index.js"],
         "env": {
           "AUTH_TYPE": "oauth",
           "BOX_CLIENT_ID": "your_client_id",
           "BOX_CLIENT_SECRET": "your_client_secret"
         }
       }
     }
   }
   ```

3. **Restart Claude Code** and verify the server appears in MCP servers list

4. **Test the integration:**
   ```
   @box-mcp-server List my recent Box files
   @box-mcp-server Analyze the quarterly report in folder "Reports/2024"
   @box-mcp-server Share the presentation with my team
   ```

### Claude Desktop Integration

For Claude Desktop, add to your MCP configuration:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "box-mcp-server": {
      "command": "node",
      "args": ["/path/to/mcp-box/dist/index.js"],
      "env": {
        "AUTH_TYPE": "oauth",
        "BOX_CLIENT_ID": "your_client_id",
        "BOX_CLIENT_SECRET": "your_client_secret"
      }
    }
  }
}
```

### Other MCP Clients

The server supports standard MCP transports:

**STDIO (Default):**
```bash
node dist/index.js
```

**HTTP with Server-Sent Events:**
```bash
MCP_TRANSPORT=http MCPSERVER_PORT=3000 AUTH_TOKEN=your_secret node dist/index.js
```

## Usage Examples

### Document Management
```javascript
// Save multiple documents with organization
{
  "name": "box_save_documents",
  "arguments": {
    "documents": [
      {
        "content": "Meeting notes content...",
        "path": "Projects/2024/Q4/meeting-notes.md",
        "metadata": { "classification": "Internal" }
      }
    ],
    "options": {
      "createFolders": true,
      "shareSettings": { "createLink": true, "linkAccess": "company" }
    }
  }
}
```

### AI-Powered Analysis
```javascript
// Analyze document with Box AI
{
  "name": "box_analyze_document",
  "arguments": {
    "path": "Contracts/partnership-agreement.pdf",
    "analysisType": "qa",
    "options": {
      "questions": ["What are the key payment terms?", "When does this contract expire?"]
    }
  }
}
```

### Smart Search
```javascript
// Natural language search
{
  "name": "box_search_content",
  "arguments": {
    "query": "quarterly financial reports from 2024 with revenue data",
    "filters": {
      "extensions": ["pdf", "xlsx"],
      "dateRange": { "from": "2024-01-01" },
      "includeContent": true
    }
  }
}
```

## MCP Protocol Support

This server implements the full MCP specification (v2025-06-18):

- **✅ Tools** - 8 intent-based tools with structured input/output
- **✅ Resources** - 6 Box URI templates for LLM context
- **✅ Prompts** - 5 interactive templates for common workflows
- **✅ Transports** - STDIO and HTTP/SSE support
- **✅ Authentication** - Bearer token support for HTTP transport
- **✅ Error Handling** - Comprehensive error responses with user-friendly messages

## Development

### Running Tests
```bash
# Unit + Integration tests
npm test

# E2E tests (requires Box credentials)
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Development Server
```bash
# Watch mode with hot reload
npm run dev

# Debug mode with verbose logging
LOG_LEVEL=debug npm start
```

### Project Structure
```
mcp-box/
├── src/
│   ├── server.ts           # MCP server implementation
│   ├── index.ts           # Entry point & transport setup
│   ├── types.ts           # TypeScript definitions
│   ├── box/               # Box API client
│   └── tools/             # Individual MCP tools
├── tests/                 # Test suites
├── docs/                  # Planning documentation
└── dist/                  # Compiled JavaScript
```

## API Reference

### Tools

| Tool | Description | Key Features |
|------|-------------|--------------|
| `box_save_documents` | Upload files to Box | Batch upload, auto-folder creation, metadata |
| `box_read_document` | Read file content | Stream content, no local storage, text extraction |
| `box_manage_folders` | Folder operations | Create, move, rename, delete, batch operations |
| `box_explore_storage` | Navigate folders | Tree view, filtering, size info |
| `box_share_content` | Sharing & collaboration | Shared links, collaborator management |
| `box_analyze_document` | Box AI analysis | Summarize, extract, Q&A, classify, translate |
| `box_search_content` | Content search | Natural language, filters, metadata search |
| `box_retrieve_documents` | Download files | Batch download, optional local save |

### Resources

| URI Template | Description |
|--------------|-------------|
| `box://file/{fileId}` | Access file by ID |
| `box://folder/{folderId}` | Access folder by ID |
| `box://search?q={query}` | Search results |
| `box://user/storage` | Storage quota info |
| `box://user/recent` | Recent files |
| `box://folder/root/tree` | Complete folder tree |

### Prompts

| Prompt | Purpose | Arguments |
|--------|---------|-----------|
| `share_file` | Create shared links | `fileId`, `access`, `password`, `expiresAt` |
| `analyze_document` | AI document analysis | `fileId`, `analysisType`, `prompt`, `focus` |
| `organize_folder` | File organization | `folderId`, `strategy`, `createSubfolders` |
| `bulk_upload` | Multiple file upload | `targetFolder`, `createFolders`, `classification` |
| `collaboration_setup` | Team collaboration | `itemId`, `itemType`, `collaborators`, `role` |

## Troubleshooting

### Authentication Issues
- **OAuth Flow**: Ensure redirect URL matches Box app configuration
- **CCG Setup**: Verify enterprise ID and app approval status
- **Token Refresh**: Check credential storage permissions

### Common Errors
- **File Not Found**: Use `box_search_content` to find correct file paths
- **Permission Denied**: Verify Box app scopes and user permissions
- **Rate Limits**: Server handles throttling automatically with exponential backoff

### Debugging
```bash
# Enable debug logging
LOG_LEVEL=debug node dist/index.js

# Test MCP protocol compliance
npm run test:contract

# Validate Box API connectivity
npm run test:integration
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Follow TDD: Write tests first, then implementation
4. Ensure all tests pass: `npm test`
5. Update documentation as needed
6. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/your-org/mcp-box/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/mcp-box/discussions)
- **Box API**: [Box Developer Documentation](https://developer.box.com/)
- **MCP Protocol**: [MCP Specification](https://modelcontextprotocol.io/)

---

**Secure document management meets AI** - Keep your files in Box cloud while enabling powerful AI interactions through the Model Context Protocol.