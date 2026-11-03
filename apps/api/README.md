<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Application Modules

### Tasks Module

Comprehensive task management system with full tracking capabilities.

**REST Endpoints:**
- `POST /tasks` - Create a new task
- `GET /tasks` - List tasks with filtering and pagination
- `GET /tasks/:id` - Get task details
- `PATCH /tasks/:id` - Update task (title, description, priority, estimated hours, due date, milestone)
- `PATCH /tasks/:id/status` - Update task status (todo → in_progress → review → done)
- `DELETE /tasks/:id` - Soft delete task and all subtasks
- `PATCH /tasks/:id/restore` - Restore soft-deleted task and subtasks

**Assignment Management:**
- `POST /tasks/:id/assignments` - Assign multiple users to task
- `DELETE /tasks/:id/assignments/:userId` - Unassign user from task

**Comments:**
- `POST /tasks/:id/comments` - Add comment to task
- `GET /tasks/:id/comments` - Get all comments (ordered by creation time)

**Time Logging:**
- `POST /tasks/:id/time-logs` - Log hours worked on task
- `GET /tasks/:id/time-logs` - Get time logs for task
- `DELETE /time-logs/:id` - Delete time log entry

**Features:**
- Subtasks: Create subtasks (max 1 level deep; subtasks inherit project from parent)
- Assignments: Many-to-many user assignments with timestamp tracking
- Comments: Task discussion with user attribution
- Time Logs: Hours-based tracking linked to both task and project
- Task Statistics: Real-time counts of assignments, comments, subtasks, and total time logged
- Status Workflow: Enforced state transitions (todo → in_progress → review → done)
- Priority Levels: CRITICAL, HIGH, MEDIUM, LOW
- Soft Delete: Cascades to subtasks; restores all related records
- Search: By title and description (case-insensitive)
- Filtering: By project, status, priority, assignee, date range
- Pagination: Configurable page/limit (defaults: 1/20)

**Business Rules:**
- Priority validation (must be CRITICAL, HIGH, MEDIUM, or LOW)
- Status validation (must be todo, in_progress, review, or done)
- Subtask depth validation (max 1 level; cannot create subtask of subtask)
- Estimated hours validation (must be positive if provided)
- Time log hours validation (must be greater than 0)
- Comment content validation (non-empty)

**RBAC:**
- Create/Update: SUPER_ADMIN, MANAGER, DEVELOPER
- Read: All roles
- Status Change: SUPER_ADMIN, MANAGER, DEVELOPER, QA
- Delete/Restore: SUPER_ADMIN, MANAGER

### Tickets Module

Support system ticket management with SLA tracking and comment support.

**REST Endpoints:**
- `POST /tickets` - Create new ticket (clientId, title, description, priority, category)
- `GET /tickets` - List tickets with filtering and pagination
- `GET /tickets/:id` - Get ticket with comments and client info
- `PATCH /tickets/:id` - Update ticket (title, description, priority, category)
- `PATCH /tickets/:id/status` - Update ticket status (status workflow)
- `PATCH /tickets/:id/assign` - Assign ticket to support agent
- `DELETE /tickets/:id` - Soft delete ticket
- `PATCH /tickets/:id/restore` - Restore soft-deleted ticket

**Comments:**
- `POST /tickets/:id/comments` - Add comment (internal flag for internal notes)
- `GET /tickets/:id/comments` - Get comments (filters internal notes by user role)
- `DELETE /comments/:commentId` - Delete comment

**Features:**
- **Status Workflow**: OPEN → IN_PROGRESS → PENDING_RESOLUTION → RESOLVED → CLOSED
  - OPEN ↔ IN_PROGRESS
  - PENDING_RESOLUTION ↔ IN_PROGRESS
  - RESOLVED ↔ CLOSED / REOPENED
  - REOPENED → IN_PROGRESS
  - Strict transition validation; prevents invalid state changes
- **SLA Tracking**:
  - Auto-calculated slaDeadline on ticket creation based on priority
  - CRITICAL: 4 hours
  - HIGH: 24 hours
  - MEDIUM: 72 hours
  - LOW: 168 hours (1 week)
  - Tracks SLA breach (resolvedAt > slaDeadline or current time past deadline)
  - Real-time breach detection in responses
- **Comments**: 
  - isInternal flag distinguishes internal notes from client-visible comments
  - Role-based filtering: Only support staff see internal comments
  - User attribution with email and name
  - Ordered by creation time descending
- **Priority Levels**: CRITICAL, HIGH, MEDIUM, LOW
- **Soft Delete**: Preserves audit trail; deleted tickets can be restored
- **Search**: By title and description (case-insensitive)
- **Filtering**: By status, priority, client, assignee, date range
- **Pagination**: Configurable page/limit (defaults: 1/20)
- **Assignment**: Assign tickets to support agents for tracking

**Business Rules:**
- Priority validation (must be CRITICAL, HIGH, MEDIUM, or LOW)
- Status validation with strict transition rules
- Title and description required (non-empty)
- Category required (non-empty)
- Comment content validation (non-empty)
- SLA deadline automatically calculated on creation (immutable)
- resolvedAt timestamp set when moving to RESOLVED status
- closedAt timestamp set when moving to CLOSED status
- REOPENED status clears resolved/closed timestamps

**RBAC:**
- Create/Read: All roles
- Update/Status Change/Assign: SUPER_ADMIN, MANAGER, DEVELOPER, QA
- Delete/Restore: SUPER_ADMIN, MANAGER
- Comment Delete: SUPER_ADMIN, MANAGER, DEVELOPER

### Assets Module

IT asset management with renewal tracking and credential management.

**REST Endpoints:**
- `POST /assets` - Create asset (type: DOMAIN, HOSTING, VPS, WEBSITE, ADMIN_PANEL, MOBILE_APP, API_SERVICE, SSL_CERTIFICATE)
- `GET /assets` - List assets with filtering and pagination
- `GET /assets/:id` - Get asset details
- `PATCH /assets/:id` - Update asset information
- `PATCH /assets/:id/reset-password` - Reset credentials (admin only)
- `DELETE /assets/:id` - Soft delete asset
- `PATCH /assets/:id/restore` - Restore deleted asset
- `GET /assets/renewals/upcoming` - List upcoming renewals (next 30 days)
- `GET /assets/renewals/expired` - List expired assets

**Asset Types & Metadata:**
- **DOMAIN**: Registrar, expiry date, DNS records, auto-renew flag
- **HOSTING**: Provider, plan, server IP, control panel URL and credentials
- **VPS**: Provider, IP, OS, CPU, RAM, disk, root credentials, SSH port
- **WEBSITE**: URL, CMS, hosting asset link, admin URL and credentials
- **ADMIN_PANEL**: URL, username, password, purpose
- **MOBILE_APP**: Platform (iOS/Android/Both), store links, version
- **API_SERVICE**: Base URL, API key, documentation link, status
- **SSL_CERTIFICATE**: Issuer, expiry date, covered domains, certificate URL

**Features:**
- **Asset Types**: 8 different asset types with type-specific metadata
- **Renewal Tracking**:
  - Auto-calculate days until renewal
  - Flag assets expiring within 30 days
  - Separate endpoints for upcoming and expired assets
  - Real-time expiry status in responses
- **Credential Management**:
  - Secure storage of passwords (root, admin, control panel)
  - Admin-only password reset functionality
  - Separate credential types for different asset purposes
- **Client Linking**: All assets linked to clients for organization
- **Polymorphic Metadata**: Flexible JSONB field supports different metadata per asset type
- **Soft Delete**: Preserves audit trail; can restore deleted assets
- **Search & Filtering**: By name, description, type, client, renewal status
- **Pagination**: Configurable page/limit (defaults: 1/20)
- **Billing Tracking**: Cost and billing cycle (MONTHLY, QUARTERLY, ANNUALLY)

**Business Rules:**
- Asset name required (non-empty)
- Valid asset types only (8 types)
- Valid billing cycles (MONTHLY, QUARTERLY, ANNUALLY)
- Cost must be positive if provided
- Password reset limited to SUPER_ADMIN and MANAGER roles
- Renewal date calculations done in real-time
- Assets expiring ≤ 0 days marked as expired
- Assets expiring 1-30 days marked as upcoming renewal

**RBAC:**
- Create: SUPER_ADMIN, MANAGER, DEVELOPER
- Read: All roles
- Update: SUPER_ADMIN, MANAGER, DEVELOPER
- Reset Password: SUPER_ADMIN, MANAGER only
- Delete/Restore: SUPER_ADMIN, MANAGER

### AMC (Annual Maintenance Contract) Module

Annual maintenance contract management with hour tracking and renewal reminders.

**REST Endpoints:**
- `POST /amc-contracts` - Create new AMC contract
- `GET /amc-contracts` - List contracts (paginated, with filters)
- `GET /amc-contracts/:id` - Get contract details with calculated fields
- `PATCH /amc-contracts/:id` - Update contract
- `PATCH /amc-contracts/:id/renew` - Renew contract with optional hour reset
- `DELETE /amc-contracts/:id` - Soft delete contract
- `PATCH /amc-contracts/:id/restore` - Restore soft-deleted contract
- `POST /amc-contracts/:id/log-hours` - Log hours against contract
- `GET /amc-contracts/:id/hours` - Get hour logs for contract
- `GET /amc-contracts/renewals/due` - Get contracts expiring soon (within 30 days)

**Contract Fields:**
- `contractNumber`: Unique identifier (unique constraint)
- `startDate`: Contract start date
- `endDate`: Contract end date
- `totalHours`: Total support hours in contract
- `usedHours`: Running total of logged hours
- `hourlyRate`: Cost per hour for rate-based billing
- `terms`: Contract terms and conditions
- `status`: ACTIVE, EXPIRED, or CANCELLED
- `autoRenew`: Flag for automatic renewal

**Features:**
- **Full Contract Lifecycle**: Create, update, renew, delete with soft-delete recovery
- **Hour Tracking**:
  - Log hours with description and optional ticket/task linking
  - Prevent logging against expired/cancelled contracts
  - Prevent exceeding totalHours limit (validation with helpful error message)
  - User attribution (who logged the hours)
  - Timestamp tracking for each log entry
- **Usage Analytics**:
  - Real-time calculation: usagePercentage = (usedHours / totalHours) × 100
  - Remaining hours: max(0, totalHours - usedHours)
  - Monetary tracking: totalValue = totalHours × hourlyRate, usedValue = usedHours × hourlyRate
  - Usage alerts: Flag when usagePercentage ≥ 80%
- **Renewal Tracking**:
  - Automatic renewal due detection (expiring within configurable days, default 30)
  - Days until expiry countdown
  - Renewal with optional hour reset for new contract period
  - Auto-renewal flag support
- **Validation**:
  - Contract number uniqueness
  - End date > start date validation
  - Positive hours and rates
  - Cannot log hours against inactive contracts
  - Linked ticket/task existence validation
- **Search & Filter**:
  - By contract number, status, client, expiry date range
  - Case-insensitive search
  - Paginated results (default: 1/20)
  - Sortable (default: createdAt DESC)
- **Soft Delete**: Full audit trail preservation with restore capability

**Calculated Fields (Returned in GET responses):**
- `remainingHours`: totalHours - usedHours
- `usagePercentage`: (usedHours / totalHours) × 100
- `hoursNearLimit`: usagePercentage ≥ 80 (boolean alert flag)
- `totalValue`: totalHours × hourlyRate
- `usedValue`: usedHours × hourlyRate
- `daysUntilExpiry`: Days from now until endDate
- `isExpired`: endDate < now
- `isRenewalDue`: expiring within 30 days and not expired
- `hourLogCount`: Number of logged hours entries

**Business Rules:**
- Start date must be before end date
- All monetary amounts and hours must be positive
- Cannot create contracts for non-existent clients
- Cannot log hours against EXPIRED or CANCELLED contracts
- Cannot log hours exceeding the totalHours limit
- Contract renewal requires new end date > current end date
- Renewal with resetHours flag sets usedHours to 0 and status to ACTIVE
- All contract operations preserve soft-deleted state (deletedAt tracking)

**RBAC:**
- Create: SUPER_ADMIN, MANAGER, DEVELOPER
- Read: All roles
- Update: SUPER_ADMIN, MANAGER, DEVELOPER
- Log Hours: SUPER_ADMIN, MANAGER, DEVELOPER
- Delete/Restore: SUPER_ADMIN, MANAGER

### Sales Module

Sales quote management with line item tracking and status workflow.

**REST Endpoints:**
- `POST /quotes` - Create quote with line items
- `GET /quotes` - List quotes (paginated, filterable)
- `GET /quotes/:id` - Get quote details with items and client info
- `PATCH /quotes/:id` - Update quote (only if DRAFT)
- `PATCH /quotes/:id/send` - Send quote (DRAFT → SENT)
- `PATCH /quotes/:id/accept` - Accept quote (SENT → ACCEPTED)
- `PATCH /quotes/:id/reject` - Reject quote (SENT → REJECTED)
- `DELETE /quotes/:id` - Delete quote (only DRAFT)

**Quote Fields:**
- `title`: Quote title/description
- `description`: Additional details
- `items`: Array of line items (description, quantity, unitPrice)
- `totalAmount`: Auto-calculated from items (Σ quantity × unitPrice)
- `status`: DRAFT, SENT, ACCEPTED, REJECTED, or EXPIRED
- `validUntil`: Expiration date for the quote
- `client`: Reference to Client

**Quote Item Fields:**
- `description`: Item description
- `quantity`: Item quantity (positive integer)
- `unitPrice`: Price per unit (non-negative)
- `amount`: Auto-calculated (quantity × unitPrice)

**Features:**
- **Quote Lifecycle**: DRAFT → SENT → ACCEPTED/REJECTED
- **Line Item Management**:
  - Multiple items per quote
  - Auto-calculation of item amount (quantity × unitPrice)
  - Total quote amount auto-calculated from all items
  - Items can only be edited in DRAFT status
- **Expiration Tracking**:
  - ValidUntil date must be in the future
  - Automatic expiry detection with daysUntilExpiry calculation
  - Cannot accept expired quotes
  - isExpired flag in responses
- **Status Workflow**:
  - Strict transitions: DRAFT → SENT → ACCEPTED or REJECTED
  - Only DRAFT quotes can be updated or deleted
  - Only SENT quotes can be accepted or rejected
  - Accepted quotes cannot transition to other states
- **Search & Filtering**:
  - By status (DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED)
  - By client ID
  - By title and description (case-insensitive search)
  - By creation date range (createdFrom, createdTo)
  - Paginated results (default: 1/20)
  - Sortable by any field (default: createdAt DESC)
- **Validation**:
  - At least one line item required
  - All item quantities must be positive (> 0)
  - All item unit prices must be non-negative (≥ 0)
  - Item descriptions cannot be empty
  - ValidUntil date must be in future
  - Cannot accept expired quotes
  - Cannot update/delete non-DRAFT quotes
  - Cannot send non-DRAFT quotes
  - Cannot accept/reject non-SENT quotes
- **Soft Delete**: Draft quotes can be deleted; other statuses prevent deletion
- **Calculated Fields**:
  - `isExpired`: validUntil < now
  - `daysUntilExpiry`: Days from now until validUntil
  - `itemCount`: Number of line items

**RBAC:**
- Create: SUPER_ADMIN, MANAGER, DEVELOPER
- Read: All roles
- Update: SUPER_ADMIN, MANAGER, DEVELOPER (DRAFT only)
- Send/Accept/Reject: SUPER_ADMIN, MANAGER, DEVELOPER
- Delete: SUPER_ADMIN, MANAGER (DRAFT only)

### Projects Module

Project management with milestone tracking and statistics aggregation.

**Features:**
- Automatic "Project Kickoff" milestone creation on project creation
- Status workflow: PLANNING → IN_PROGRESS / ON_HOLD / COMPLETED / CANCELLED
- Milestone management with auto-incremented ordering and status tracking
- Statistics: Task count, completion %, time logged on project tasks
- Soft delete with active task checking

### Leads Module

Sales pipeline management with lead status workflow and conversion.

**Features:**
- Lead status workflow: new → contacted → qualified → converted/lost
- Lead-to-client conversion creates Client and ContactPerson automatically
- Conversion metrics calculation
- Source tracking: Website, Referral, LinkedIn, Cold Outreach, Other
- Email uniqueness validation
- Soft delete support

### Clients Module

CRM client management with contact person tracking.

**Features:**
- Contact person management
- Client project association
- Email uniqueness validation
- Soft delete support with project count tracking
- Pagination and filtering

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
