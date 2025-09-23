# Box API Reference Documentation

## Overview

Box is a cloud content management platform that provides secure file sharing, storage, and collaboration. The Box API enables developers to integrate Box's capabilities into their applications.

## Authentication

### OAuth 2.0
Primary authentication method for user-based access:
- Authorization Code flow for web apps
- JWT for server-to-server authentication
- Client Credentials for app-only access

### API Token Structure
```
Authorization: Bearer ACCESS_TOKEN
```

### Service Accounts
For automated server-side operations without user interaction

## Core API Endpoints

### File Operations

#### Upload File
```
POST https://upload.box.com/api/2.0/files/content
```
- Multipart form data
- Attributes JSON must precede file content
- 50MB limit for single upload (use chunked for larger)

#### Upload New Version
```
POST https://upload.box.com/api/2.0/files/{file_id}/content
```

#### Download File
```
GET https://api.box.com/2.0/files/{file_id}/content
```

#### Get File Information
```
GET https://api.box.com/2.0/files/{file_id}
```

#### Delete File
```
DELETE https://api.box.com/2.0/files/{file_id}
```

#### Copy File
```
POST https://api.box.com/2.0/files/{file_id}/copy
```

#### Move File
```
PUT https://api.box.com/2.0/files/{file_id}
```
Body: `{"parent": {"id": "new_folder_id"}}`

### Folder Operations

#### Create Folder
```
POST https://api.box.com/2.0/folders
```

#### Get Folder Items
```
GET https://api.box.com/2.0/folders/{folder_id}/items
```

#### Delete Folder
```
DELETE https://api.box.com/2.0/folders/{folder_id}
```

#### Copy Folder
```
POST https://api.box.com/2.0/folders/{folder_id}/copy
```

### Chunked Upload (Large Files)

#### Create Upload Session
```
POST https://upload.box.com/api/2.0/files/upload_sessions
```

#### Upload Part
```
PUT https://upload.box.com/api/2.0/files/upload_sessions/{session_id}
```

#### Commit Session
```
POST https://upload.box.com/api/2.0/files/upload_sessions/{session_id}/commit
```

### Sharing & Collaboration

#### Create Shared Link
```
PUT https://api.box.com/2.0/files/{file_id}
```
Body:
```json
{
  "shared_link": {
    "access": "open|company|collaborators",
    "password": "optional_password",
    "unshared_at": "2025-12-31T23:59:59Z",
    "permissions": {
      "can_download": true,
      "can_preview": true
    }
  }
}
```

#### Add Collaborator
```
POST https://api.box.com/2.0/collaborations
```

### Search

#### Search for Content
```
GET https://api.box.com/2.0/search
```
Query parameters:
- `query`: Search term
- `type`: file, folder, or web_link
- `content_types`: name, description, file_content, comments, tags

### Metadata

#### Add Metadata
```
POST https://api.box.com/2.0/files/{file_id}/metadata/{scope}/{template}
```

#### Get Metadata
```
GET https://api.box.com/2.0/files/{file_id}/metadata/{scope}/{template}
```

### Security Classifications

#### Add Classification
```
POST https://api.box.com/2.0/files/{file_id}/metadata/enterprise/securityClassification-6VMVochwUWo
```
Body:
```json
{
  "Box__Security__Classification__Key": "Sensitive|Confidential|Public"
}
```

## File Upload Examples

### Simple Upload (cURL)
```bash
curl -X POST "https://upload.box.com/api/2.0/files/content" \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F attributes='{"name":"document.pdf","parent":{"id":"0"}}' \
  -F file=@/path/to/document.pdf
```

### Upload Session Response
```json
{
  "id": "F971964745A5CD0C001BBE4E58196BFD",
  "type": "upload_session",
  "session_endpoints": {
    "upload_part": "https://upload.box.com/api/2.0/files/upload_sessions/F971964745A5CD0C001BBE4E58196BFD",
    "commit": "https://upload.box.com/api/2.0/files/upload_sessions/F971964745A5CD0C001BBE4E58196BFD/commit",
    "abort": "https://upload.box.com/api/2.0/files/upload_sessions/F971964745A5CD0C001BBE4E58196BFD"
  },
  "session_expires_at": "2025-12-31T23:59:59Z",
  "part_size": 8388608,
  "total_parts": 10
}
```

## Response Structures

### File Object
```json
{
  "id": "12345",
  "type": "file",
  "name": "Contract.pdf",
  "size": 629644,
  "created_at": "2024-01-01T10:00:00Z",
  "modified_at": "2024-01-15T15:30:00Z",
  "parent": {
    "id": "0",
    "type": "folder",
    "name": "All Files"
  },
  "sha1": "85136C79CBF9FE36BB9D05D0639C70C265C18D37",
  "shared_link": {
    "url": "https://app.box.com/s/unique_id",
    "download_url": "https://app.box.com/shared/static/unique_id.pdf",
    "access": "open",
    "permissions": {
      "can_download": true,
      "can_preview": true
    }
  }
}
```

### Folder Object
```json
{
  "id": "11446498",
  "type": "folder",
  "name": "Pictures",
  "created_at": "2024-01-01T10:00:00Z",
  "modified_at": "2024-01-15T15:30:00Z",
  "size": 629644,
  "item_collection": {
    "total_count": 2,
    "entries": [
      {"id": "file_1", "type": "file", "name": "image1.jpg"},
      {"id": "folder_1", "type": "folder", "name": "Vacation"}
    ]
  }
}
```

## Error Handling

### Common Error Codes
- `400`: Bad Request - Invalid parameters
- `401`: Unauthorized - Invalid or expired token
- `403`: Forbidden - Insufficient permissions
- `404`: Not Found - Resource doesn't exist
- `409`: Conflict - Name conflict or storage limit
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error

### Error Response Format
```json
{
  "type": "error",
  "status": 409,
  "code": "item_name_in_use",
  "message": "Item with the same name already exists",
  "request_id": "abcd1234"
}
```

## Rate Limits

- API calls: 1,000 requests per minute per user
- Uploads: 240 uploads per minute per user
- Downloads: Subject to bandwidth limits
- Search: 10 requests per second per user

## Best Practices

1. **Use Chunked Upload** for files > 50MB
2. **Implement Exponential Backoff** for rate limit errors
3. **Cache Responses** when appropriate
4. **Use Fields Parameter** to limit response data
5. **Batch Operations** when possible
6. **Handle Token Refresh** proactively
7. **Validate File Names** before upload
8. **Use If-Match Headers** for safe updates

## SDK Support

Official SDKs available:
- JavaScript/Node.js
- Python
- Java
- .NET
- iOS
- Android

## Useful Resources

- [Box API Documentation](https://developer.box.com)
- [API Reference](https://developer.box.com/reference)
- [Authentication Guide](https://developer.box.com/guides/authentication)
- [SDK Downloads](https://github.com/box)