# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DingTalk Reminder System (钉钉智能提醒系统) - A comprehensive scheduling and reminder system integrated with DingTalk (钉钉) for managing automated notifications, supporting complex scheduling rules, Excel bulk imports, and task associations. The system features a cross-platform architecture with separate frontend (Vue 3 + Vite) and backend (Node.js + Express) applications.

## Common Development Commands

### Quick Start
```bash
# Using the automated startup script (recommended)
./start-dev.sh

# Manual startup
docker-compose up -d mongodb  # Start MongoDB
npm install                    # Install root dependencies
cd backend && npm install      # Install backend dependencies  
cd ../frontend && npm install  # Install frontend dependencies
```

### Backend Development
```bash
cd backend
npm run dev    # Development mode with nodemon (auto-restart on changes)
npm start      # Production mode
```

### Frontend Development  
```bash
cd frontend
npm run dev     # Development server on port 8080
npm run build   # Build for production
npm run preview # Preview production build
```

### Database Management
```bash
docker-compose up -d mongodb    # Start MongoDB container
docker-compose logs -f mongodb  # View MongoDB logs
docker-compose down             # Stop all containers
```

### Service Monitoring
```bash
# Check service health
curl http://localhost:3000/api/health

# View application logs
tail -f backend/logs/app.log

# Monitor Docker containers
docker-compose ps
docker-compose logs -f
```

## Architecture & Key Design Patterns

### System Architecture
- **Backend**: Node.js + Express API server running on port 3000
  - MongoDB as primary database (Mongoose ODM)
  - Redis for optional caching layer
  - Cronicle scheduler for task execution
  - JWT-based authentication with refresh tokens
  - Comprehensive middleware stack for security, rate limiting, and monitoring

- **Frontend**: Vue 3 + Vite SPA running on port 8080
  - Pinia for state management
  - Element Plus component library
  - Unified API client architecture
  - Cross-platform shared code structure (desktop + mobile ready)

### Key Architectural Decisions

1. **Unified API Management**: All task-related API calls are centralized in `frontend/src/api/modules/tasks-unified.js` to ensure consistency and maintainability.

2. **MongoDB-First Approach**: The system has migrated from PostgreSQL to MongoDB as the primary database. All routes use MongoDB models and the `mongoAuthMiddleware`.

3. **Middleware Pipeline**: Security is enforced through a layered middleware approach:
   - Helmet for security headers
   - CORS configuration
   - Rate limiting (global, login-specific, upload-specific)
   - CSRF protection
   - JWT authentication
   - Request validation and XSS protection

4. **Cross-Platform Ready**: The frontend structure includes:
   - `shared/` directory for cross-platform code
   - `mobile/` directory for mobile-specific implementations
   - Platform adapters and hooks for different environments

5. **Task Scheduling System**: Uses Cronicle scheduler integrated with MongoDB for complex scheduling patterns including daily, weekly, monthly, yearly, and interval-based schedules.

### Authentication Flow
1. User login via `/api/mongo/auth/login` returns access token and refresh token
2. Access tokens expire in 15 minutes (configurable)
3. Refresh tokens valid for 7 days
4. All protected routes require `mongoAuthMiddleware` which validates JWT tokens
5. Token refresh happens automatically via `/api/mongo/auth/refresh`

### Data Models
- **User**: Authentication, profile, preferences
- **Task**: Core scheduling entity with complex recurrence rules
- **Group**: Task grouping and organization
- **File**: Excel import handling and task batch creation
- **TaskAssociation**: Relationships between tasks for priority management

### API Route Structure
All API routes follow RESTful conventions:
- `/api/mongo/auth/*` - Authentication endpoints (no auth required)
- `/api/mongo/tasks/*` - Task CRUD operations (auth required)
- `/api/mongo/groups/*` - Group management (auth required)
- `/api/mongo/files/*` - File upload and Excel processing (auth required)
- `/api/mongo/dashboard/*` - Statistics and monitoring (auth required)
- `/api/scheduler/*` - Scheduler control (auth required)

### Environment Configuration
Critical environment variables (see `.env.example`):
- `MONGODB_URI`: MongoDB connection string with authentication
- `JWT_SECRET` & `JWT_REFRESH_SECRET`: Token signing keys
- `PORT`: Backend server port (default: 3000)
- `REDIS_*`: Optional Redis cache configuration
- `DINGTALK_WEBHOOK` & `DINGTALK_SECRET`: DingTalk bot integration

### Frontend Build & Deployment
The frontend is built as a static SPA and served by the Express backend:
- Built files go to `frontend/dist/`
- Express serves static files from `backend/frontend/dist/`
- Vue Router handles client-side routing with server-side fallback

### Error Handling Strategy
- Centralized error handling middleware
- Structured error responses with appropriate HTTP status codes
- Comprehensive logging with Winston
- Graceful shutdown handling for SIGTERM/SIGINT signals

## Important Implementation Details

### Security Considerations
- All routes except auth endpoints require JWT authentication
- Rate limiting applied globally and specifically for sensitive operations
- CSRF tokens required for state-changing operations
- SQL injection and XSS protection middleware active
- Helmet security headers configured for production

### Performance Optimizations
- Redis caching layer (optional but recommended)
- Response compression enabled
- Memory management with periodic garbage collection in production
- Connection pooling for database operations
- Lazy loading and code splitting in frontend

### Cross-Origin Resource Sharing (CORS)
- Development mode allows localhost:8080, localhost:5173
- Production mode typically disabled (frontend served from same origin)
- Credentials included for cookie-based CSRF tokens

### File Upload Handling
- Multer middleware for file uploads
- Excel parsing with ExcelJS library
- Uploaded files stored in `uploads/` directory
- Maximum file size configurable via environment variables

## Code Quality and Structure Requirements

### Important: Maintain Project Structure Integrity
- **必须保持项目结构的整洁和统一** (MUST maintain clean and unified project structure)
- All code modifications must preserve the existing architectural patterns
- Follow established naming conventions and file organization
- Do not introduce new dependencies without explicit approval
- Keep changes minimal and focused on specific requirements
- Maintain consistent code formatting throughout the project

### Code Modification Guidelines
- **Review existing code patterns before making changes**
- **Preserve existing functionality when refactoring**
- **Use the same coding style as the surrounding code**
- **Maintain separation of concerns between frontend and backend**
- **Keep API contracts stable and backward compatible**
- **Document any breaking changes clearly**

### When Making Changes
1. First understand the existing implementation
2. **Check if any APIs or routes are used by other components before modifying**
3. Follow the established patterns in the codebase
4. Make minimal, focused changes
5. Test thoroughly to ensure no regression
6. Keep the git history clean with meaningful commits

### API Modification Guidelines
- **Always check API usage across all components before modifying any endpoint**
- **Use grep or search tools to find all references to the API endpoint**
- **Document any breaking changes if unavoidable**
- **Consider creating new endpoints instead of modifying existing ones when multiple components depend on them**
- **Maintain backward compatibility whenever possible**