# Authentication & Authorization

This document describes the centralized authentication and role-based authorization
system for paperless-ai.

---

## Overview

All protected routes require JWT-based authentication. The system uses a hierarchical
role model where higher roles inherit permissions from lower roles.

**Authentication Flow:**
1. User submits credentials via `/login`
2. Server validates credentials against the local SQLite database
3. On success, a JWT token is issued and set as an `httpOnly` cookie
4. Subsequent requests include the JWT cookie for authentication
5. Protected routes validate the token and check role permissions

---

## User Roles

The system defines three roles in a strict hierarchy:

| Role | Level | Description | Permissions |
|------|-------|-------------|-------------|
| `admin` | 100 | System administrator | Full access to all routes, settings, and system configuration |
| `user` | 50 | Standard user | Access to workspace, documents, chat, history, and manual processing |
| `viewer` | 10 | Read-only access | View documents and thumbnails only |

**Hierarchy Rule:** Each role inherits all permissions of roles below it.
An `admin` can access everything a `user` or `viewer` can access.

---

## Middleware Functions

The auth middleware (`middleware/auth.js`) exports the following:

### Core Authentication

| Function | Purpose | Failure Behavior |
|----------|---------|------------------|
| `authenticate` | Page route authentication | Redirects to `/login` |
| `authenticateApi` | API route authentication | Returns `401 JSON` |

### Role Enforcement

| Function | Required Role | Usage |
|----------|---------------|-------|
| `requireRole(role)` | Factory for any role | Returns middleware |
| `requireAdmin` | `admin` | Settings, system config |
| `requireUser` | `user` | Workspace, documents |
| `requireViewer` | `viewer` | Thumbnails, read-only |

### Combined Middleware

| Function | Description |
|----------|-------------|
| `protectPage(role)` | `authenticate` + `requireRole` for pages |
| `protectApi(role)` | `authenticateApi` + `requireRole` for APIs |

---

## Route Protection Matrix

### Public Routes (No Authentication)

| Route | Purpose |
|-------|---------|
| `/login` | Login page |
| `/logout` | Logout endpoint |
| `/setup` | Initial setup (first-run only) |
| `/health` | Health check endpoint |
| `/api-docs` | Swagger documentation |

### Admin-Only Routes

| Route | Purpose |
|-------|---------|
| `/settings` | Application settings |
| `/debug` | Debug tools |
| `/api/settings/*` | Settings API |
| `/system/*` | System administration |

### User-Level Routes

| Route | Purpose |
|-------|---------|
| `/document` | Document workspace |
| `/chat` | Document chat |
| `/history` | Processing history |
| `/manual` | Manual processing |
| `/api/documents/*` | Document API |
| `/api/chat/*` | Chat API |
| `/api/feedback/*` | Feedback API |

### Viewer-Level Routes

| Route | Purpose |
|-------|---------|
| `/thumb/*` | Document thumbnails |
| `/sampleData/*` | Sample data access |

---

## JWT Token Structure

The JWT payload contains:

```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "iat": 1706832000,
  "exp": 1706918400
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | User ID from database |
| `username` | string | Username |
| `role` | string | One of: `admin`, `user`, `viewer` |
| `iat` | number | Issued-at timestamp |
| `exp` | number | Expiration timestamp |

---

## Token Extraction

Tokens are extracted in the following order:

1. **Cookie** (`jwt`): Primary method for browser sessions
2. **Authorization Header** (`Bearer <token>`): For API clients

```javascript
// Cookie example
Cookie: jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

// Header example
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Error Responses

### Page Routes

Unauthenticated requests redirect to `/login` with the original URL preserved
for post-login redirect.

### API Routes

| Status | Error | When |
|--------|-------|------|
| `401` | `Authentication required` | No token provided |
| `403` | `Invalid token` | Token verification failed |
| `403` | `Forbidden` | Insufficient role permissions |

**Example Error Response:**

```json
{
  "error": "Forbidden",
  "message": "This action requires admin role or higher"
}
```

---

## Usage Examples

### Protecting a Page Route

```javascript
const { authenticate, requireAdmin } = require('../middleware/auth');

// Admin-only page
router.get('/settings', authenticate, requireAdmin, (req, res) => {
  res.render('settings', { user: req.user });
});

// User-level page (default)
router.get('/workspace', authenticate, (req, res) => {
  res.render('workspace', { user: req.user });
});
```

### Protecting an API Route

```javascript
const { authenticateApi, requireUser } = require('../middleware/auth');

// User-level API
router.get('/api/documents', authenticateApi, requireUser, async (req, res) => {
  const docs = await getDocuments(req.user.id);
  res.json(docs);
});
```

### Using Combined Middleware

```javascript
const { protectPage, protectApi, ROLES } = require('../middleware/auth');

// Page with specific role
router.get('/admin', ...protectPage(ROLES.ADMIN), (req, res) => {
  res.render('admin');
});

// API with specific role
router.post('/api/settings', ...protectApi(ROLES.ADMIN), (req, res) => {
  // Handle settings update
});
```

---

## User Management

### Database Schema

Users are stored in the SQLite database (`documents.db`):

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Creating Users

```javascript
const documentModel = require('./services/documentModel');

// Create admin user
await documentModel.addUser('admin', 'hashed_password', 'admin');

// Create standard user
await documentModel.addUser('user1', 'hashed_password', 'user');

// Create viewer
await documentModel.addUser('viewer1', 'hashed_password', 'viewer');
```

### Updating User Roles

```javascript
// Promote user to admin
await documentModel.updateUserRole('user1', 'admin');

// Demote to viewer
await documentModel.updateUserRole('user1', 'viewer');
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | `your-secret-key` | **Required.** Secret for signing JWTs. Use a strong random value in production. |
| `SESSION_TIMEOUT` | `480` | Session timeout in minutes (8 hours) |

**Security Warning:** Always set a strong, unique `JWT_SECRET` in production.
The default value is insecure and should never be used outside development.

---

## Security Considerations

1. **httpOnly Cookies:** JWT tokens are stored in httpOnly cookies to prevent XSS attacks
2. **Secure Flag:** Enable `Secure` flag in production (HTTPS only)
3. **Token Expiration:** Tokens expire based on `SESSION_TIMEOUT`
4. **Password Hashing:** Passwords are hashed with bcryptjs before storage
5. **Role Validation:** Role checks happen server-side on every request

---

## Logging

Authentication events are logged with the `[AUTH]` prefix:

```
[AUTH] No token found, redirecting to /login { path: '/settings' }
[AUTH] Token verification failed: jwt expired { path: '/api/documents' }
[AUTH] Insufficient permissions: { user: 'viewer1', userRole: 'viewer', requiredRole: 'admin', path: '/settings' }
```

---

## Related Documentation

- [Environment Variables](ENVIRONMENT_VARIABLES.md) - JWT_SECRET configuration
- [Architecture Overview](ARCHITECTURE_OVERVIEW.md) - System design
- [Error Handling](ERROR_HANDLING.md) - Error response patterns
