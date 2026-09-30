# AI Based Public Grievances and Resource Allocation System — Backend Documentation

> Written from a developer's perspective, in simple student-friendly language.

---

## What Is This Project?

This is the **backend** of a web application that lets citizens file complaints (called grievances) to the government — like a broken road, water supply problem, or electricity issue. The system uses **AI (Artificial Intelligence)** to automatically categorize the complaint, decide its priority, route it to the right government department, and even suggest which government resources should be used to fix it.

Think of it like a smart complaint box that actually reads your complaint, understands it, sends it to the right department automatically, and keeps you updated at every step.

---

## Tech Stack (What Tools Are Used)

| Tool | What It Does |
|---|---|
| **Node.js** | The runtime — JavaScript runs on the server using this |
| **Express.js** | The web framework — handles all the API routes (URLs) |
| **MongoDB** | The database — stores all data (users, complaints, departments, etc.) |
| **Mongoose** | Helps us talk to MongoDB using JavaScript objects (called models) |
| **OpenAI API** | The AI brain — classifies complaints, suggests resources, finds duplicates |
| **JWT (JSON Web Tokens)** | For login authentication — proves who you are |
| **bcryptjs** | Hashes (encrypts) passwords so they are never stored as plain text |
| **Nodemailer** | Sends emails to users (like "your complaint was received") |
| **Multer** | Handles file uploads (photos, PDFs attached to complaints) |
| **Winston** | A logging library — records everything that happens on the server |
| **Helmet** | Adds security headers to protect the API |
| **express-rate-limit** | Limits how many requests a user can make (prevents abuse) |
| **express-validator** | Validates incoming data (checks that email is valid, password is strong, etc.) |
| **express-mongo-sanitize** | Prevents NoSQL injection attacks |
| **compression** | Compresses responses to make them faster |
| **cors** | Allows the frontend (React/Next.js) to talk to this backend from a different URL |

---

## Folder Structure Explained

```
backend/
├── server.js              ← Entry point: starts the server
├── app.js                 ← Sets up Express, middleware, and routes
├── .env                   ← Secret environment variables (API keys, DB URL, etc.)
├── package.json           ← Project info and list of all packages
│
├── config/
│   ├── db.js              ← Connects to MongoDB
│   └── logger.js          ← Sets up the Winston logger
│
├── models/                ← Database schemas (shape of data)
│   ├── User.js
│   ├── Grievance.js
│   ├── Department.js
│   ├── Resource.js
│   ├── Allocation.js
│   └── Notification.js
│
├── controllers/           ← The actual logic for each feature
│   ├── authController.js
│   ├── userController.js
│   ├── grievanceController.js
│   ├── departmentController.js
│   ├── resourceController.js
│   ├── adminController.js
│   ├── aiController.js
│   └── notificationController.js
│
├── routes/                ← URL definitions — which URL calls which controller
│   ├── authRoutes.js
│   ├── userRoutes.js
│   ├── grievanceRoutes.js
│   ├── departmentRoutes.js
│   ├── resourceRoutes.js
│   ├── adminRoutes.js
│   ├── aiRoutes.js
│   └── notificationRoutes.js
│
├── middleware/            ← Functions that run before the controller
│   ├── auth.js            ← Checks if user is logged in
│   ├── errorHandler.js    ← Handles all errors globally
│   ├── asyncHandler.js    ← Wraps async functions to catch errors
│   ├── validate.js        ← Returns validation errors to the client
│   ├── rateLimiter.js     ← Limits requests
│   ├── requestLogger.js   ← Logs every HTTP request
│   └── notFound.js        ← Returns 404 for unknown routes
│
├── services/              ← Reusable logic (not tied to a specific route)
│   ├── aiService.js       ← All OpenAI calls
│   └── notificationService.js  ← Email + in-app notifications
│
├── uploads/
│   └── grievances/        ← Uploaded files are stored here
│
└── logs/
    ├── combined.log       ← All logs
    ├── error.log          ← Only error logs
    └── exceptions.log     ← Uncaught exceptions
```

---

## How the Server Starts (`server.js` and `app.js`)

### `server.js`
This is the entry point of the whole application. When you run `node server.js`, this file:
1. Loads environment variables from `.env` using `dotenv`
2. Calls `connectDB()` to connect to MongoDB
3. If connection is successful, starts listening on a port (default: 5000)
4. Sets up graceful shutdown so the server closes cleanly when stopped

```
MongoDB connects → Server starts on port 5000 → Ready to accept requests
```

### `app.js`
This file creates and configures the Express app. It adds all the middleware in order:

1. `helmet()` — Security headers
2. `cors()` — Allows frontend to connect
3. `rateLimit()` — Global limit: max 200 requests per 15 minutes per IP
4. `compression()` — Compresses responses
5. `express.json()` — Parses JSON request bodies (limit: 10mb)
6. `mongoSanitize()` — Blocks NoSQL injection
7. `morgan` — HTTP request logger
8. `requestLogger` — Custom structured logger
9. Static file serving for `/uploads`
10. All 8 route groups
11. `notFound` — 404 handler (must come after routes)
12. `errorHandler` — Global error handler (must be last)

> Important: Middleware order matters in Express. The error handler must always be last.

---

## Database Models (What Data Looks Like)

### User Model (`models/User.js`)

Stores everyone who uses the system. There are 4 types of users (called roles):

| Role | Who They Are |
|---|---|
| `citizen` | A normal person filing a complaint |
| `officer` | A government employee handling complaints |
| `department_head` | The head of a department (e.g., Water Department Head) |
| `admin` | The superuser who manages everything |

**Important fields:**
- `password` — Never stored as plain text. It is hashed using bcrypt with a salt of 12 rounds before saving
- `refreshToken` — Used for silent login (keeps user logged in without re-entering password)
- `emailVerificationToken` — A random token sent to email to prove ownership
- `passwordResetToken` — A random token for resetting forgotten passwords
- `isActive` — If false, the account is deactivated (user cannot log in)
- `toPublicJSON()` — A method that removes sensitive fields (password, tokens) before sending data to the frontend

---

### Grievance Model (`models/Grievance.js`)

The core of the whole system. A grievance is a complaint filed by a citizen.

**Auto-generated Tracking ID:** When a grievance is created, it automatically gets a unique ID like `GRV-2026-00001`. This is generated in a `pre('save')` hook (a function that runs before saving to database).

**Categories (12 types):**
`infrastructure`, `sanitation`, `water_supply`, `electricity`, `healthcare`, `education`, `public_safety`, `transportation`, `environment`, `social_welfare`, `corruption`, `other`

**Statuses (lifecycle of a complaint):**
```
pending → under_review → in_progress → resolved → closed
                                     ↘ rejected
```

**Priority levels:** `low`, `medium`, `high`, `critical`

**AI Fields** (filled in automatically by OpenAI):
- `aiCategory` — AI's guess at the category
- `aiPriority` — AI's suggested priority
- `aiSentimentScore` — How negative/positive the complaint sounds (-1.0 to 1.0)
- `aiSummary` — A short AI-written summary of the complaint
- `aiProcessed` — Whether AI has already processed it (true/false)

**Sub-schemas** (nested data inside the grievance):
- `comments` — Array of comments from officers/citizens
- `statusHistory` — Every time status changes, it is recorded here (audit trail)
- `attachments` — Files uploaded with the complaint

**Geolocation index (`2dsphere`):** Allows location-based queries (find grievances near a point)

**Virtuals (calculated fields, not stored in DB):**
- `upvoteCount` — Count of how many users upvoted this grievance
- `daysOpen` — Number of days the grievance has been open

---

### Department Model (`models/Department.js`)

Represents a government department like "Water Supply Department" or "Roads Department".

**Key fields:**
- `code` — A short uppercase code like `WATER`, `PWD`, `HEALTH`
- `handledCategories` — Which types of grievances this department handles (array). This is how AI routing works — it matches the grievance category to a department
- `sla` — Service Level Agreement: how many hours the department has to resolve each priority level
  - `low`: 168 hours (7 days)
  - `medium`: 72 hours (3 days)
  - `high`: 24 hours (1 day)
  - `critical`: 6 hours
- `head` — Reference to the User who is the department head
- `stats` — Summary statistics like total/open/resolved grievances

**Virtual:** `resolutionRate` — Calculated as `(resolved / total) * 100`

---

### Resource Model (`models/Resource.js`)

Represents a government resource that can be allocated to fix a grievance.

**6 resource types:**
| Type | Example |
|---|---|
| `human` | Officers, staff |
| `financial` | Budget money |
| `equipment` | Vehicles, machinery |
| `material` | Construction supplies, medicines |
| `facility` | Buildings, offices |
| `technology` | Software, devices |

**For physical resources:** Tracks `quantity.total`, `quantity.available`, `quantity.allocated`

**For financial resources:** Tracks `budget.total`, `budget.allocated`, `budget.spent`, `budget.currency`

**Auto-status hook:** Before saving, the model automatically updates its status:
- If `allocated === 0` → status = `available`
- If `allocated < total` → status = `partially_allocated`
- If `allocated === total` → status = `fully_allocated`

**AI fields:** `aiRecommended`, `aiAllocationScore`, `aiRecommendationNote` — filled when AI suggests this resource for a grievance

---

### Allocation Model (`models/Allocation.js`)

A separate record created every time a resource is assigned to a grievance. This is the **audit trail** — even if the resource is released later, this record still exists.

**Statuses:** `pending_approval` → `approved` → `active` → `completed` / `cancelled`

**AI fields:** `isAiSuggested`, `aiConfidenceScore`, `aiRationale` — tells whether this allocation was suggested by AI and how confident the AI was

**`utilizationReport`:** After the resource is used, an officer fills in how much was actually used and what the outcome was

---

### Notification Model (`models/Notification.js`)

Stores in-app notifications for each user (like a bell icon notification).

**10 notification types:**
`grievance_submitted`, `grievance_status_update`, `grievance_assigned`, `grievance_resolved`, `grievance_escalated`, `comment_added`, `resource_allocated`, `resource_approved`, `system_alert`, `account_activity`

**Channels:**
- `inApp` — Shows in the app (like a bell notification)
- `email` — Sends an email. `emailSentAt` records when it was actually sent

**Reference:** Optional link to which Grievance, Resource, or Department this notification is about (a polymorphic reference)

---

## Controllers (The Business Logic)

### Auth Controller (`controllers/authController.js`)

Handles everything related to login and accounts.

| Function | Route | What It Does |
|---|---|---|
| `register` | POST `/api/auth/register` | Creates new account, sends email verification link |
| `login` | POST `/api/auth/login` | Checks password, returns JWT access token + refresh token |
| `refreshToken` | POST `/api/auth/refresh-token` | Issues a new access token using the refresh token |
| `logout` | POST `/api/auth/logout` | Clears the refresh token from database |
| `verifyEmail` | GET `/api/auth/verify-email/:token` | Verifies email address using token from email |
| `forgotPassword` | POST `/api/auth/forgot-password` | Sends password reset link to email |
| `resetPassword` | PATCH `/api/auth/reset-password/:token` | Sets a new password using the reset token |
| `getMe` | GET `/api/auth/me` | Returns the currently logged-in user's profile |
| `changePassword` | PATCH `/api/auth/change-password` | Changes password (requires current password) |

**How JWT authentication works:**
1. User logs in → server creates an `accessToken` (valid 7 days) and a `refreshToken` (valid 30 days)
2. Frontend stores both tokens
3. Every API request sends `Authorization: Bearer <accessToken>` in the header
4. When access token expires, frontend sends refresh token to get a new access token
5. When user logs out, refresh token is deleted from DB so it can't be reused

**Security details:**
- Tokens are hashed with `sha256` before storing in the database (so even if DB is leaked, tokens are useless)
- Forgot password responds generically to prevent knowing which emails are registered (user enumeration prevention)
- On password reset, all existing refresh tokens are invalidated (logs out all devices)

---

### Grievance Controller (`controllers/grievanceController.js`)

The most important controller. Handles the full lifecycle of a complaint.

| Function | Route | What It Does |
|---|---|---|
| `createGrievance` | POST `/api/grievances` | Files a new complaint (with optional file uploads) |
| `getGrievances` | GET `/api/grievances` | Lists complaints (filtered by the user's role) |
| `getGrievanceById` | GET `/api/grievances/:id` | Gets one complaint in detail |
| `trackGrievance` | GET `/api/grievances/track/:trackingId` | Public tracking — no login required |
| `updateGrievance` | PATCH `/api/grievances/:id` | Updates a complaint |
| `deleteGrievance` | DELETE `/api/grievances/:id` | Deletes a complaint |
| `addComment` | POST `/api/grievances/:id/comments` | Adds a comment (officers can mark as internal) |
| `toggleUpvote` | POST `/api/grievances/:id/upvote` | Vote for a complaint (or remove vote) |
| `submitFeedback` | POST `/api/grievances/:id/feedback` | Rate the resolution (1-5 stars) |
| `escalateGrievance` | POST `/api/grievances/:id/escalate` | Mark as critical priority |

**Role-based access control:**
- `citizen` — Can only see their own complaints. Can only edit `pending` complaints. Cannot see internal comments
- `officer` — Can see complaints in their department or assigned to them
- `department_head` — Can see all complaints in their department
- `admin` — Can see and edit everything

**What happens when a citizen files a complaint:**
1. Grievance is saved to the database with status `pending`
2. AI classification runs **asynchronously** (in the background) so the user doesn't wait
3. A notification email is sent to the citizen **asynchronously**
4. The API responds immediately with the new grievance data

This is called "fire and forget" — the background tasks run without blocking the response.

**File uploads:** Uses Multer. Files are saved to `uploads/grievances/` with a random 8-character hex name. Allowed types: JPEG, PNG, GIF, PDF, DOC, DOCX, MP4, MOV. Max size: 5MB per file, max 5 files per grievance.

---

### Admin Controller (`controllers/adminController.js`)

Only accessible by users with the `admin` role. Heavy use of MongoDB aggregation pipelines.

| Function | Route | What It Does |
|---|---|---|
| `getDashboardStats` | GET `/api/admin/dashboard` | 17 database queries run in parallel — returns KPIs |
| `getGrievanceAnalytics` | GET `/api/admin/analytics/grievances` | Time-series trend, by category/status/priority/department |
| `getDepartmentPerformance` | GET `/api/admin/analytics/departments` | Resolution rates and avg resolution time per department |
| `getResourceAnalytics` | GET `/api/admin/analytics/resources` | Resource usage statistics |
| `getUserAnalytics` | GET `/api/admin/analytics/users` | User registration trend, by role, active vs inactive |
| `getSLABreaches` | GET `/api/admin/grievances/sla-breaches` | Complaints that passed their deadline |
| `getUnassignedGrievances` | GET `/api/admin/grievances/unassigned` | Complaints with no officer assigned |
| `bulkAssignGrievances` | POST `/api/admin/grievances/bulk-assign` | Assign multiple complaints at once |
| `getAuditLog` | GET `/api/admin/audit-log` | Full history of all status changes across all complaints |
| `broadcastNotification` | POST `/api/admin/notifications/broadcast` | Send a notification to all users (or a specific role) |

**Dashboard uses `Promise.all()`** — runs 17 database queries at the same time instead of one by one, making it much faster.

**Audit log** is generated by "unwinding" the `statusHistory` array in every grievance — each status change becomes a separate row in the audit log result.

---

### AI Controller (`controllers/aiController.js`)

These are manual trigger endpoints for AI operations (the automatic ones run in the background on grievance creation).

| Function | Route | Who Can Use |
|---|---|---|
| `classifyGrievanceById` | POST `/api/ai/classify/:id` | admin, officer, department_head |
| `routeGrievance` | POST `/api/ai/route/:id` | admin, department_head |
| `findDuplicates` | GET `/api/ai/duplicates/:id` | admin, officer, department_head |
| `getResolutionSuggestion` | GET `/api/ai/resolve-suggestion/:id` | admin, officer, department_head |
| `batchClassify` | POST `/api/ai/batch-classify` | admin only |

`batchClassify` processes up to 50 unprocessed grievances at once and returns immediately (`202 Accepted`). The actual AI calls run in the background.

---

### Resource Controller (`controllers/resourceController.js`)

Manages government resources and their allocation to grievances.

| Function | Route | What It Does |
|---|---|---|
| `createResource` | POST `/api/resources` | Adds a new resource |
| `getResources` | GET `/api/resources` | Lists resources (department_heads only see their department's) |
| `getResourceById` | GET `/api/resources/:id` | Gets one resource with full allocation history |
| `updateResource` | PATCH `/api/resources/:id` | Updates resource details |
| `deleteResource` | DELETE `/api/resources/:id` | Deletes resource (fails if it has active allocations) |
| `allocateResource` | POST `/api/resources/allocate` | Assigns resource to a grievance |
| `releaseAllocation` | PATCH `/api/resources/allocations/:id/release` | Frees a resource back |
| `approveAllocation` | PATCH `/api/resources/allocations/:id/approve` | Approves a pending allocation |
| `getAllocations` | GET `/api/resources/allocations/list` | Lists all allocations |
| `suggestResources` | GET `/api/resources/suggest/:grievanceId` | AI suggests best resources for this grievance |

**Allocation flow:**
1. Officer requests an allocation — if they are not admin, it is created with status `pending_approval`
2. Admin approves it → status becomes `approved` → `active`
3. When the grievance is resolved, officer releases the resource
4. The quantity/budget is reversed and the resource becomes available again

---

### Department Controller (`controllers/departmentController.js`)

Manages government departments.

Key things it does beyond basic CRUD:
- `assignHead` — When you assign a user as department head, it automatically upgrades their role from `officer` to `department_head`
- `getDepartmentStats` — Returns three aggregation results: status breakdown, priority breakdown, and a 30-day daily trend chart
- Cannot delete a department if it has assigned users — must reassign them first

---

### User Controller (`controllers/userController.js`)

Admin manages users through this. Key safety checks:
- Admin cannot deactivate their own account
- Admin cannot delete their own account
- `updateProfile` only allows changing `name`, `phone`, `address`, `avatar` — not role or email

---

### Notification Controller (`controllers/notificationController.js`)

Every user manages their own notifications.

| Function | Route | What It Does |
|---|---|---|
| `getMyNotifications` | GET `/api/notifications` | Gets your notifications (with unread count) |
| `getUnreadCount` | GET `/api/notifications/unread-count` | Just the count number |
| `markAsRead` | PATCH `/api/notifications/:id/read` | Marks one as read |
| `markAllAsRead` | PATCH `/api/notifications/read-all` | Marks all as read |
| `deleteNotification` | DELETE `/api/notifications/:id` | Deletes one |
| `clearAllNotifications` | DELETE `/api/notifications/clear-all` | Deletes all your notifications |

---

## Services (Reusable Logic)

### AI Service (`services/aiService.js`)

This is where all the OpenAI calls happen. Uses the `gpt-4o-mini` model which is cheaper and fast enough for this use case.

The client is "lazily initialized" — it is only created when the first AI call is made (not when the server starts). This means the server can still boot even if `OPENAI_API_KEY` is not set.

**5 functions:**

**1. `classifyGrievance(grievance)`**
- Sends the title + description to OpenAI
- Asks it to return: `category`, `priority`, `sentimentScore`, `summary`, `subCategory`, `reasoning`
- Validates the response (only accepts valid enum values)
- Saves the results back to the grievance document in the database
- Marks `aiProcessed: true` even if it fails (to avoid infinite retries)

**2. `suggestResourceAllocation(grievance)`**
- Fetches up to 30 available resources from the relevant department
- Sends grievance details + resource list to OpenAI
- Asks it to recommend up to 3 resources with quantity, purpose, and confidence score
- Validates that returned resource IDs actually exist in the fetched list

**3. `autoRouteToDepartment(grievance)`**
- No AI call needed for this one — it just does a database query
- Finds a department where `handledCategories` includes the grievance's AI category
- If found, updates the grievance's `department` field

**4. `detectDuplicates(grievance)`**
- Fetches up to 20 similar grievances from the same category (last 90 days)
- Sends them all to OpenAI and asks it to find duplicates with similarity > 0.75
- Returns an array of `{ trackingId, similarityScore, reason }`

**5. `generateResolutionSuggestion(grievance)`**
- Sends the grievance to OpenAI and asks for a step-by-step resolution plan
- Returns a plain text response (max 200 words)
- This is shown to officers to help them know what action to take

---

### Notification Service (`services/notificationService.js`)

Handles both in-app and email notifications.

**4 functions:**

**1. `sendEmail({ to, subject, html })`**
- Uses Nodemailer with SMTP settings from `.env`
- Only tries to send if `EMAIL_USER` and `EMAIL_PASS` are configured
- The transporter is lazily created (same pattern as OpenAI client)

**2. `createInAppNotification({ recipientId, type, title, message, ... })`**
- Creates a `Notification` document in the database
- Optionally also sends an email asynchronously (does not block the DB save)

**3. `sendGrievanceNotification(event, grievance, actor)`**
- Called when a grievance lifecycle event happens: `submitted`, `status_update`, `assigned`, `resolved`, `escalated`, `comment`
- Each event has a predefined message template and HTML email template
- Automatically looks up the citizen's email from the User collection
- Calls `createInAppNotification` with email option enabled

**4. `notifyDepartmentOfficers(departmentId, grievance)`**
- Finds all active officers and department heads in the department
- Sends an in-app notification to each of them
- Uses `Promise.allSettled()` so if one notification fails, the others still go through

---

## Middleware Explained

Middleware is code that runs between receiving a request and sending a response.

### `auth.js` — Authentication & Authorization

**`protect` middleware:**
- Reads the JWT from the `Authorization: Bearer <token>` header
- Verifies it with `JWT_SECRET`
- Finds the user in the database
- Checks if the account is still active
- Attaches the user object to `req.user` so all controllers can access it

**`authorize(...roles)` middleware:**
- Called like: `authorize('admin', 'department_head')`
- Checks if `req.user.role` is in the allowed roles
- Returns 403 Forbidden if not

---

### `errorHandler.js` — Global Error Handler

This single function handles ALL errors from the entire application. It recognizes specific error types and returns the right status code:

| Error Type | Status Code | When It Happens |
|---|---|---|
| Mongoose `CastError` | 400 | Invalid MongoDB ObjectId in URL |
| Mongoose Duplicate Key (`11000`) | 409 | Email already registered |
| Mongoose `ValidationError` | 422 | Required field missing or invalid |
| `JsonWebTokenError` | 401 | Token is corrupted or invalid |
| `TokenExpiredError` | 401 | Token has expired |
| Multer `LIMIT_FILE_SIZE` | 413 | Uploaded file is too large |
| Multer `LIMIT_UNEXPECTED_FILE` | 400 | Wrong file field name |
| Any other error | 500 | Unknown server error |

In development mode, 500 errors also include the full stack trace so developers can debug easily.

---

### `asyncHandler.js` — Async Error Wrapper

Without this, every async controller would need its own `try/catch` block. This helper wraps any async function and automatically forwards any error to the global error handler.

```js
// Instead of writing this in every controller:
try { ... } catch (err) { next(err); }

// We just wrap the function:
router.get('/path', asyncHandler(async (req, res) => { ... }));
```

---

### `rateLimiter.js` — Prevents Abuse

Four different rate limiters for different sensitivity levels:

| Limiter | Limit | Used For |
|---|---|---|
| `apiLimiter` | 200 requests / 15 min | All API routes (global) |
| `authLimiter` | 20 requests / 15 min | Login, register, forgot password |
| `uploadLimiter` | 30 requests / hour | File uploads |
| `aiLimiter` | 50 requests / hour | AI endpoints (costly to run) |

---

### `validate.js` — Input Validation

After `express-validator` rules run on the request, this middleware reads the results. If there are any errors, it returns a `422` response with a clear list of which fields failed and why.

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Valid email is required", "value": "notanemail" },
    { "field": "password", "message": "Password must be at least 8 characters", "value": "abc" }
  ]
}
```

---

### `requestLogger.js` — Request Logging

Logs every HTTP request after it completes:
- `info` for successful responses (2xx)
- `warn` for client errors (4xx)
- `error` for server errors (5xx)

Example log entry:
```
2026-09-30 14:32:01 [info]: GET /api/grievances 200 – 45ms | IP: 192.168.1.1
```

---

## Config Files

### `config/db.js` — MongoDB Connection

Connects to MongoDB using the `MONGO_URI` from `.env`. Key settings:
- `autoIndex: false` in production (creating indexes manually is safer and faster)
- `maxPoolSize: 10` — Up to 10 simultaneous database connections
- `serverSelectionTimeoutMS: 5000` — If it can't connect in 5 seconds, it fails fast
- Listens for `disconnected`, `reconnected`, and `error` events and logs them

---

### `config/logger.js` — Winston Logger

Sets up structured logging with 3 output destinations:
1. **Console** — colorized output for easy reading during development
2. **`logs/error.log`** — only error-level messages
3. **`logs/combined.log`** — all messages (debug, info, warn, error)

A separate `exceptions.log` catches any unhandled exceptions that crash the process.

In production, the minimum log level is `warn` (skips debug/info to reduce noise).

---

## API Routes Summary

### Auth Routes — `/api/auth`
| Method | URL | Auth Required | Description |
|---|---|---|---|
| POST | `/register` | No | Create account |
| POST | `/login` | No | Login |
| POST | `/refresh-token` | No | Get new access token |
| GET | `/verify-email/:token` | No | Verify email |
| POST | `/forgot-password` | No | Request password reset |
| PATCH | `/reset-password/:token` | No | Set new password |
| GET | `/me` | Yes | Get my profile |
| PATCH | `/change-password` | Yes | Change password |
| POST | `/logout` | Yes | Logout |

### Grievance Routes — `/api/grievances`
| Method | URL | Auth Required | Description |
|---|---|---|---|
| GET | `/track/:trackingId` | No | Public complaint tracking |
| GET | `/` | Yes | List complaints |
| POST | `/` | Yes | File a complaint |
| GET | `/:id` | Yes | Get one complaint |
| PATCH | `/:id` | Yes | Update complaint |
| DELETE | `/:id` | Yes | Delete complaint |
| POST | `/:id/comments` | Yes | Add comment |
| POST | `/:id/upvote` | Yes | Toggle upvote |
| POST | `/:id/feedback` | Yes | Submit rating |
| POST | `/:id/escalate` | Officer/Admin | Escalate to critical |

### Resource Routes — `/api/resources`
| Method | URL | Role Required | Description |
|---|---|---|---|
| GET | `/` | Officer+ | List resources |
| POST | `/` | Admin/Dept Head | Create resource |
| GET | `/:id` | Officer+ | Get resource detail |
| PATCH | `/:id` | Admin/Dept Head | Update resource |
| DELETE | `/:id` | Admin only | Delete resource |
| POST | `/allocate` | Officer+ | Allocate to grievance |
| GET | `/allocations/list` | Officer+ | List all allocations |
| PATCH | `/allocations/:id/release` | Officer+ | Release resource |
| PATCH | `/allocations/:id/approve` | Admin/Dept Head | Approve allocation |
| GET | `/suggest/:grievanceId` | Officer+ | AI resource suggestion |

### Department Routes — `/api/departments`
| Method | URL | Role Required | Description |
|---|---|---|---|
| GET | `/` | Any logged-in user | List departments |
| GET | `/:id` | Any logged-in user | Get department |
| POST | `/` | Admin only | Create department |
| PATCH | `/:id` | Admin only | Update department |
| DELETE | `/:id` | Admin only | Delete department |
| PATCH | `/:id/assign-head` | Admin only | Assign department head |
| GET | `/:id/officers` | Admin/Dept Head | List officers |
| GET | `/:id/grievances` | Officer+ | Get dept complaints |
| GET | `/:id/stats` | Admin/Dept Head | Department statistics |

### Admin Routes — `/api/admin` (Admin only)
| Method | URL | Description |
|---|---|---|
| GET | `/dashboard` | Main KPI dashboard |
| GET | `/analytics/grievances` | Grievance trends and charts |
| GET | `/analytics/departments` | Department performance |
| GET | `/analytics/resources` | Resource usage |
| GET | `/analytics/users` | User statistics |
| GET | `/grievances/sla-breaches` | Overdue complaints |
| GET | `/grievances/unassigned` | Unassigned complaints |
| POST | `/grievances/bulk-assign` | Assign multiple at once |
| GET | `/audit-log` | Full status change history |
| POST | `/notifications/broadcast` | Send to all/group users |

### AI Routes — `/api/ai` (Officer+)
| Method | URL | Description |
|---|---|---|
| POST | `/classify/:grievanceId` | Run AI classification |
| POST | `/route/:grievanceId` | Auto-route to department |
| GET | `/duplicates/:grievanceId` | Find duplicate complaints |
| GET | `/resolve-suggestion/:grievanceId` | Get resolution plan |
| POST | `/batch-classify` | Classify all unprocessed (Admin only) |

### Notification Routes — `/api/notifications`
| Method | URL | Description |
|---|---|---|
| GET | `/` | Get my notifications |
| GET | `/unread-count` | Get unread count |
| PATCH | `/read-all` | Mark all as read |
| DELETE | `/clear-all` | Delete all notifications |
| PATCH | `/:id/read` | Mark one as read |
| DELETE | `/:id` | Delete one notification |

---

## Environment Variables (`.env`)

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/grievances_db

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=30d

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@grievanceportal.com

# OpenAI
OPENAI_API_KEY=sk-...

# Frontend URL (for email links)
CLIENT_URL=http://localhost:3000

# File upload
MAX_FILE_SIZE=5242880  # 5MB in bytes
```

---

## How to Run the Project

```bash
# Go into the backend folder
cd backend

# Install all packages
npm install

# Run in development mode (auto-restarts on file changes)
npm run dev

# Run in production mode
npm start
```

The server will start at `http://localhost:5000`.

Health check: `GET http://localhost:5000/api/health` — returns `200 OK` if the server is running.

---

## Key Design Patterns Used

**1. MVC (Model-View-Controller)**
- Models define the data structure
- Controllers contain the business logic
- Routes define the URLs
- (No "View" in a REST API — the frontend handles that)

**2. Async/Await with centralized error handling**
- All controllers use `async/await` instead of callbacks
- Errors are passed to `next(err)` and handled in one place

**3. Role-based Access Control (RBAC)**
- Every route checks the user's role using the `authorize()` middleware
- This keeps security logic separate from business logic

**4. Lazy initialization**
- OpenAI client and Nodemailer transporter are created only when first used
- This prevents the app from failing to start just because an external service is not configured

**5. Fire-and-forget async operations**
- AI classification and email notifications run in the background after filing a complaint
- The user gets an instant response without waiting for these slow operations

**6. Aggregation pipelines for analytics**
- MongoDB's aggregation framework is used for all analytics queries
- It is much more efficient than loading all data into JavaScript and processing it there

---

*This documentation covers the complete backend of the AI Based Public Grievances and Resource Allocation System as of September 2026.*
