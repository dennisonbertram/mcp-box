# Task 0001: Authentication System & Server Foundation

## Overview

This task implements the core authentication system and foundational MCP server structure for the Box integration. This is a prerequisite for all other features as it handles secure connection to Box API and establishes the base server architecture.

## Dependencies

- None (this is the foundational task)

## Deliverables

### 1. MCP Server Foundation
- Basic MCP server setup with TypeScript
- STDIO transport implementation
- Server initialization and capability declaration
- Error handling framework
- Logging infrastructure

### 2. Authentication Module
- OAuth 2.0 implementation
- JWT authentication support
- Service Account handling
- Token management system
- Secure credential storage

### 3. Configuration System
- Environment variable management
- Configuration file support
- Multi-environment setup (dev/staging/prod)
- Secrets management

## Implementation Details

### Project Structure
```
mcp-box-server/
├── src/
│   ├── index.ts                 # Main server entry
│   ├── server.ts                 # MCP server implementation
│   ├── auth/
│   │   ├── index.ts             # Auth module exports
│   │   ├── oauth.ts             # OAuth 2.0 implementation
│   │   ├── jwt.ts               # JWT authentication
│   │   ├── service-account.ts   # Service account auth
│   │   └── token-manager.ts     # Token storage/refresh
│   ├── config/
│   │   ├── index.ts             # Config exports
│   │   ├── environment.ts       # Environment config
│   │   └── credentials.ts       # Credential management
│   ├── transport/
│   │   └── stdio.ts             # STDIO transport
│   ├── utils/
│   │   ├── logger.ts            # Logging utility
│   │   └── errors.ts            # Error definitions
│   └── types/
│       └── index.ts             # TypeScript types
├── tests/
│   └── auth/
│       └── auth.test.ts        # Authentication tests
├── .env.example                 # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

### Core Components

#### 1. Server Initialization (`src/server.ts`)
```typescript
import { McpServer } from '@modelcontextprotocol/sdk';
import { StdioTransport } from './transport/stdio';
import { AuthManager } from './auth';
import { ConfigManager } from './config';

export class BoxMcpServer {
  private server: McpServer;
  private auth: AuthManager;
  private config: ConfigManager;

  constructor() {
    this.config = new ConfigManager();
    this.auth = new AuthManager(this.config);
    this.server = new McpServer({
      name: 'box-mcp-server',
      version: '1.0.0',
      capabilities: {
        tools: true,
        resources: true,
        prompts: true
      }
    });
  }

  async initialize(): Promise<void> {
    await this.auth.initialize();
    this.registerHandlers();
  }

  private registerHandlers(): void {
    // Tool, resource, and prompt handlers
  }

  async start(): Promise<void> {
    const transport = new StdioTransport();
    await this.server.connect(transport);
  }
}
```

#### 2. Authentication Manager (`src/auth/index.ts`)
```typescript
export class AuthManager {
  private oauthClient?: OAuth2Client;
  private jwtClient?: JWTClient;
  private serviceAccount?: ServiceAccountClient;
  private tokenManager: TokenManager;

  constructor(config: ConfigManager) {
    this.tokenManager = new TokenManager(config);
    this.initializeAuthMethod(config);
  }

  private initializeAuthMethod(config: ConfigManager): void {
    const authType = config.get('AUTH_TYPE');

    switch(authType) {
      case 'oauth':
        this.oauthClient = new OAuth2Client(config);
        break;
      case 'jwt':
        this.jwtClient = new JWTClient(config);
        break;
      case 'service_account':
        this.serviceAccount = new ServiceAccountClient(config);
        break;
      default:
        throw new Error(`Unsupported auth type: ${authType}`);
    }
  }

  async getAccessToken(): Promise<string> {
    return this.tokenManager.getValidToken();
  }

  async refreshToken(): Promise<string> {
    // Implement token refresh logic
  }
}
```

#### 3. OAuth 2.0 Implementation (`src/auth/oauth.ts`)
```typescript
import { BoxSDK } from 'box-node-sdk';

export class OAuth2Client {
  private sdk: BoxSDK;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config: ConfigManager) {
    this.clientId = config.get('BOX_CLIENT_ID');
    this.clientSecret = config.get('BOX_CLIENT_SECRET');
    this.redirectUri = config.get('BOX_REDIRECT_URI');

    this.sdk = new BoxSDK({
      clientID: this.clientId,
      clientSecret: this.clientSecret
    });
  }

  async authorize(): Promise<string> {
    // Generate authorization URL
    const authUrl = this.sdk.getAuthorizeURL({
      response_type: 'code'
    });

    // Handle authorization flow
    return authUrl;
  }

  async getTokensFromCode(code: string): Promise<TokenSet> {
    const tokens = await this.sdk.getTokensAuthorizationCodeGrant(code);
    return tokens;
  }
}
```

#### 4. Token Manager (`src/auth/token-manager.ts`)
```typescript
import * as keytar from 'keytar';
import { createCipheriv, createDecipheriv } from 'crypto';

export class TokenManager {
  private serviceName = 'box-mcp-server';
  private encryptionKey: Buffer;

  constructor(private config: ConfigManager) {
    this.encryptionKey = this.deriveKey(config.get('ENCRYPTION_SECRET'));
  }

  async storeTokens(tokens: TokenSet): Promise<void> {
    const encrypted = this.encrypt(JSON.stringify(tokens));

    if (this.config.get('USE_KEYCHAIN')) {
      await keytar.setPassword(this.serviceName, 'tokens', encrypted);
    } else {
      // Store in secure file storage
      await this.storeToFile(encrypted);
    }
  }

  async getValidToken(): Promise<string> {
    const tokens = await this.getStoredTokens();

    if (this.isExpired(tokens.accessToken)) {
      return this.refreshToken(tokens.refreshToken);
    }

    return tokens.accessToken;
  }

  private isExpired(token: string): boolean {
    // Check token expiration
    const decoded = this.decodeJWT(token);
    return decoded.exp < Date.now() / 1000;
  }
}
```

#### 5. Configuration Management (`src/config/index.ts`)
```typescript
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

export class ConfigManager {
  private config: Map<string, any>;

  constructor() {
    this.config = new Map();
    this.loadEnvironment();
    this.loadConfigFile();
    this.validateConfiguration();
  }

  private loadEnvironment(): void {
    dotenv.config();

    // Load from environment variables
    const envVars = [
      'BOX_CLIENT_ID',
      'BOX_CLIENT_SECRET',
      'BOX_REDIRECT_URI',
      'AUTH_TYPE',
      'USE_KEYCHAIN',
      'ENCRYPTION_SECRET',
      'LOG_LEVEL'
    ];

    envVars.forEach(key => {
      if (process.env[key]) {
        this.config.set(key, process.env[key]);
      }
    });
  }

  private validateConfiguration(): void {
    const required = ['AUTH_TYPE', 'ENCRYPTION_SECRET'];

    for (const key of required) {
      if (!this.config.has(key)) {
        throw new Error(`Missing required configuration: ${key}`);
      }
    }
  }

  get(key: string): any {
    return this.config.get(key);
  }
}
```

### Environment Configuration

#### `.env.example`
```env
# Authentication
AUTH_TYPE=oauth # oauth, jwt, or service_account
BOX_CLIENT_ID=your_client_id
BOX_CLIENT_SECRET=your_client_secret
BOX_REDIRECT_URI=http://localhost:3000/callback
BOX_ENTERPRISE_ID=your_enterprise_id

# JWT Auth (if using JWT)
BOX_JWT_PUBLIC_KEY_ID=your_public_key_id
BOX_JWT_PRIVATE_KEY_PATH=./keys/private.pem
BOX_JWT_PASSPHRASE=your_passphrase

# Security
ENCRYPTION_SECRET=your_32_char_encryption_secret_here
USE_KEYCHAIN=true

# Server Configuration
MCP_TRANSPORT=stdio # stdio or http
LOG_LEVEL=info # debug, info, warn, error
NODE_ENV=development

# Optional
REDIS_URL=redis://localhost:6379
RATE_LIMIT_PER_MINUTE=100
```

### Testing Strategy

#### 1. Unit Tests
```typescript
// tests/auth/auth.test.ts
describe('AuthManager', () => {
  it('should initialize OAuth client correctly', async () => {
    const config = new ConfigManager();
    config.set('AUTH_TYPE', 'oauth');

    const auth = new AuthManager(config);
    expect(auth).toBeDefined();
  });

  it('should handle token refresh', async () => {
    const auth = new AuthManager(mockConfig);
    const newToken = await auth.refreshToken();
    expect(newToken).toBeDefined();
  });

  it('should store tokens securely', async () => {
    const tokenManager = new TokenManager(mockConfig);
    await tokenManager.storeTokens(mockTokens);
    const retrieved = await tokenManager.getValidToken();
    expect(retrieved).toBe(mockTokens.accessToken);
  });
});
```

#### 2. Integration Tests
- Test actual Box API connection
- Verify token refresh flow
- Test credential storage/retrieval
- Validate error handling

#### 3. Security Tests
- Token encryption/decryption
- Secure storage verification
- Input validation
- Rate limiting

### API Testing Commands

#### Test OAuth Flow
```bash
# Get authorization URL
curl -X POST http://localhost:3000/auth/authorize

# Exchange code for tokens
curl -X POST http://localhost:3000/auth/token \
  -d "code=AUTH_CODE"

# Test token refresh
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer REFRESH_TOKEN"
```

#### Test MCP Server Initialization
```bash
# Initialize server
echo '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}' | node dist/index.js

# Expected response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "serverInfo": {
      "name": "box-mcp-server",
      "version": "1.0.0"
    }
  }
}
```

### Error Handling

#### Error Types
```typescript
export class BoxAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BoxAuthError';
  }
}

export class TokenExpiredError extends BoxAuthError {
  constructor() {
    super('Access token has expired', 'TOKEN_EXPIRED');
  }
}

export class InvalidCredentialsError extends BoxAuthError {
  constructor() {
    super('Invalid credentials provided', 'INVALID_CREDENTIALS');
  }
}
```

### Security Considerations

1. **Token Storage**
   - Use system keychain when available
   - Encrypt tokens at rest
   - Never log sensitive data

2. **Network Security**
   - Always use HTTPS for Box API
   - Validate SSL certificates
   - Implement request signing

3. **Access Control**
   - Validate all inputs
   - Implement rate limiting
   - Log authentication attempts

### Monitoring & Logging

```typescript
// src/utils/logger.ts
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Usage
logger.info('Server initialized', {
  authType: config.get('AUTH_TYPE'),
  transport: 'stdio'
});
```

## Success Criteria

1. **Functional Requirements**
   - [ ] MCP server starts successfully
   - [ ] OAuth 2.0 flow works end-to-end
   - [ ] JWT authentication functional
   - [ ] Service account auth works
   - [ ] Token refresh mechanism operational
   - [ ] Secure token storage implemented

2. **Security Requirements**
   - [ ] All tokens encrypted at rest
   - [ ] No sensitive data in logs
   - [ ] Input validation on all endpoints
   - [ ] Rate limiting implemented

3. **Quality Requirements**
   - [ ] 90%+ test coverage
   - [ ] All tests passing
   - [ ] No security vulnerabilities
   - [ ] Documentation complete

## Completion Checklist

- [ ] Project structure created
- [ ] Dependencies installed
- [ ] Authentication module implemented
- [ ] Token management functional
- [ ] Configuration system complete
- [ ] STDIO transport working
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Unit tests written and passing
- [ ] Integration tests complete
- [ ] Security review passed
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Ready for next phase

## Notes

- This foundation will be used by all subsequent tasks
- Ensure robust error handling for auth failures
- Consider implementing auth method auto-detection
- Plan for multi-tenant scenarios in the future