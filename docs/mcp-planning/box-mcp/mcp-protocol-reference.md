# Model Context Protocol (MCP) Reference Documentation

## Overview

The Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to Large Language Models (LLMs). It enables building agents and complex LLM workflows by offering a standardized way for AI models to integrate with various data and services.

## Core Concepts

### Architecture

MCP follows a client-server architecture where:
- **MCP Servers**: Programs that expose tools, resources, and prompts to LLMs
- **MCP Clients/Hosts**: Applications (like Claude Desktop, LM Studio) that connect to MCP servers and make their resources available to models

### Key Components

1. **Tools**: Executable functions that LLMs can invoke
2. **Resources**: Data sources accessible via URI patterns
3. **Prompts**: Pre-defined conversation templates
4. **Transport Layers**: Communication protocols (stdio, HTTP/SSE)

## Building an MCP Server

### Server Capabilities

MCP servers should implement:
- Tool discovery and execution
- Resource management with URI-based access
- Prompt templates and handling
- Capability negotiation
- Concurrent client connections
- Structured logging and notifications

### Development Process

1. **Initialize Server**
   - Set up transport layer (stdio or HTTP)
   - Configure server info (name, version)
   - Define capabilities

2. **Define Tools**
   ```typescript
   {
     name: "tool-name",
     description: "Tool description",
     inputSchema: { /* JSON Schema */ },
     handler: async (args) => { /* implementation */ }
   }
   ```

3. **Define Resources**
   ```typescript
   {
     uri: "resource://pattern",
     name: "Resource Name",
     handler: async ({ uri }) => { /* fetch resource */ }
   }
   ```

4. **Define Prompts**
   ```typescript
   {
     name: "prompt-name",
     description: "Prompt description",
     arguments: { /* schema */ },
     handler: async (args) => { /* generate prompt */ }
   }
   ```

### Transport Protocols

#### STDIO Transport (Default)
- Uses standard input/output for communication
- JSON-RPC 2.0 messages
- Ideal for local development

#### HTTP/SSE Transport
- RESTful endpoints
- Server-Sent Events for real-time updates
- Suitable for remote servers

### Testing MCP Servers

#### Basic STDIO Testing Pattern
```bash
echo 'JSON_RPC_MESSAGE' | ENV_VARS node path/to/server.js
```

#### Essential Test Sequence

1. **Initialize Connection**
```bash
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' | node server.js
```

2. **List Tools**
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","id":2,"params":{}}' | node server.js
```

3. **Execute Tool**
```bash
echo '{"jsonrpc":"2.0","method":"tools/call","id":3,"params":{"name":"tool-name","arguments":{"param":"value"}}}' | node server.js
```

#### MCP Inspector
Visual debugging tool for testing MCP servers:
```bash
npx @modelcontextprotocol/inspector node server.js
```

## SDK Support

Official SDKs available in multiple languages:
- TypeScript/JavaScript
- Python
- Go
- Java
- C#
- Rust
- Ruby
- Swift
- Kotlin

All SDKs provide:
- Server and client creation
- Local and remote transport support
- Protocol compliance with type safety
- Full feature support

## Security Considerations

### Authentication Methods
- OAuth 2.0
- API Keys
- Service Accounts
- Token-based auth

### Best Practices
- Never hardcode credentials
- Use encrypted token storage
- Implement rate limiting
- Validate all inputs
- Use HTTPS for remote servers
- Whitelist IP addresses where applicable

## Production Deployment

### Deployment Options
- Docker containers
- Cloud platforms (AWS, GCP, Azure)
- Serverless functions
- Self-hosted servers

### Monitoring & Logging
- Structured logging
- Health check endpoints
- Performance metrics
- Error tracking
- Request/response logging

## Configuration Examples

### Claude Desktop Configuration
```json
{
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@org/server-package"]
    }
  }
}
```

### Remote Server with Authentication
```json
{
  "mcpServers": {
    "remote-api": {
      "transport_type": "streamable_http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

## Development Resources

- [Official Specification](https://modelcontextprotocol.io/specification)
- [SDK Documentation](https://modelcontextprotocol.io/docs/sdk)
- [Example Servers](https://github.com/modelcontextprotocol/servers)
- [MCP Inspector](https://modelcontextprotocol.io/tools/inspector)