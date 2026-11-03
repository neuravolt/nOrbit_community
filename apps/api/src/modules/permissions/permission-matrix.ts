export const PERMISSION_MATRIX = [
  // User permissions
  { resource: 'user', action: 'create', scope: 'organization' },
  { resource: 'user', action: 'read', scope: 'own' },
  { resource: 'user', action: 'read', scope: 'team' },
  { resource: 'user', action: 'read', scope: 'organization' },
  { resource: 'user', action: 'update', scope: 'own' },
  { resource: 'user', action: 'update', scope: 'team' },
  { resource: 'user', action: 'update', scope: 'organization' },
  { resource: 'user', action: 'delete', scope: 'organization' },

  // Role permissions
  { resource: 'role', action: 'create', scope: 'organization' },
  { resource: 'role', action: 'read', scope: 'organization' },
  { resource: 'role', action: 'update', scope: 'organization' },
  { resource: 'role', action: 'delete', scope: 'organization' },

  // Permission permissions
  { resource: 'permission', action: 'read', scope: 'organization' },

  // Client permissions
  { resource: 'client', action: 'create', scope: 'organization' },
  { resource: 'client', action: 'read', scope: 'own' },
  { resource: 'client', action: 'read', scope: 'team' },
  { resource: 'client', action: 'read', scope: 'organization' },
  { resource: 'client', action: 'update', scope: 'own' },
  { resource: 'client', action: 'update', scope: 'team' },
  { resource: 'client', action: 'update', scope: 'organization' },
  { resource: 'client', action: 'delete', scope: 'organization' },
  { resource: 'client', action: 'restore', scope: 'organization' },

  // Project permissions
  { resource: 'project', action: 'create', scope: 'organization' },
  { resource: 'project', action: 'read', scope: 'own' },
  { resource: 'project', action: 'read', scope: 'team' },
  { resource: 'project', action: 'read', scope: 'organization' },
  { resource: 'project', action: 'update', scope: 'own' },
  { resource: 'project', action: 'update', scope: 'team' },
  { resource: 'project', action: 'update', scope: 'organization' },
  { resource: 'project', action: 'delete', scope: 'organization' },
  { resource: 'project', action: 'restore', scope: 'organization' },

  // Task permissions
  { resource: 'task', action: 'create', scope: 'team' },
  { resource: 'task', action: 'read', scope: 'own' },
  { resource: 'task', action: 'read', scope: 'team' },
  { resource: 'task', action: 'read', scope: 'organization' },
  { resource: 'task', action: 'update', scope: 'own' },
  { resource: 'task', action: 'update', scope: 'team' },
  { resource: 'task', action: 'update', scope: 'organization' },
  { resource: 'task', action: 'delete', scope: 'organization' },
  { resource: 'task', action: 'restore', scope: 'organization' },
  { resource: 'task', action: 'comment', scope: 'team' },

  // Ticket permissions
  { resource: 'ticket', action: 'create', scope: 'organization' },
  { resource: 'ticket', action: 'read', scope: 'own' },
  { resource: 'ticket', action: 'read', scope: 'team' },
  { resource: 'ticket', action: 'read', scope: 'organization' },
  { resource: 'ticket', action: 'update', scope: 'own' },
  { resource: 'ticket', action: 'update', scope: 'team' },
  { resource: 'ticket', action: 'update', scope: 'organization' },
  { resource: 'ticket', action: 'delete', scope: 'organization' },

  // Asset permissions
  { resource: 'asset', action: 'create', scope: 'organization' },
  { resource: 'asset', action: 'read', scope: 'organization' },
  { resource: 'asset', action: 'update', scope: 'organization' },
  { resource: 'asset', action: 'delete', scope: 'organization' },
  { resource: 'asset', action: 'restore', scope: 'organization' },

  // AMC permissions
  { resource: 'amc', action: 'create', scope: 'organization' },
  { resource: 'amc', action: 'read', scope: 'organization' },
  { resource: 'amc', action: 'update', scope: 'organization' },
  { resource: 'amc', action: 'delete', scope: 'organization' },

  // Lead permissions
  { resource: 'lead', action: 'create', scope: 'organization' },
  { resource: 'lead', action: 'read', scope: 'own' },
  { resource: 'lead', action: 'read', scope: 'team' },
  { resource: 'lead', action: 'read', scope: 'organization' },
  { resource: 'lead', action: 'update', scope: 'own' },
  { resource: 'lead', action: 'update', scope: 'organization' },
  { resource: 'lead', action: 'delete', scope: 'organization' },
  { resource: 'lead', action: 'restore', scope: 'organization' },
  { resource: 'lead', action: 'convert', scope: 'organization' },

  // Invoice permissions
  { resource: 'invoice', action: 'create', scope: 'organization' },
  { resource: 'invoice', action: 'read', scope: 'organization' },
  { resource: 'invoice', action: 'update', scope: 'organization' },
  { resource: 'invoice', action: 'delete', scope: 'organization' },

  // Quote permissions
  { resource: 'quote', action: 'create', scope: 'organization' },
  { resource: 'quote', action: 'read', scope: 'organization' },
  { resource: 'quote', action: 'update', scope: 'organization' },
  { resource: 'quote', action: 'delete', scope: 'organization' },

  // Guardian permissions (base CRUD — pre-existing decorator usage in
  // guardian.controller.ts had no matching matrix entries until now)
  { resource: 'guardian', action: 'create', scope: 'organization' },
  { resource: 'guardian', action: 'read', scope: 'organization' },
  { resource: 'guardian', action: 'update', scope: 'organization' },
  { resource: 'guardian', action: 'delete', scope: 'organization' },

  // Guardian BYOVPS remote operations (granular — see GuardianCommand)
  { resource: 'guardian', action: 'service_restart', scope: 'organization' },
  { resource: 'guardian', action: 'logs_view', scope: 'organization' },
  { resource: 'guardian', action: 'diagnostics', scope: 'organization' },
  { resource: 'guardian', action: 'process_view', scope: 'organization' },
  { resource: 'guardian', action: 'remediation', scope: 'organization' },
  { resource: 'guardian', action: 'discovery', scope: 'organization' },
];

export const DEFAULT_ROLES = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full system access',
    isSystem: true,
    permissions: PERMISSION_MATRIX.map(
      (p) => `${p.resource}:${p.action}:${p.scope}`,
    ),
  },
  {
    name: 'MANAGER',
    description: 'Team and project management',
    isSystem: true,
    permissions: [
      'user:read:organization',
      'user:update:team',
      'role:read:organization',
      'client:read:organization',
      'client:create:organization',
      'client:update:organization',
      'client:delete:organization',
      'client:restore:organization',
      'project:create:organization',
      'project:read:organization',
      'project:update:organization',
      'project:delete:organization',
      'project:restore:organization',
      'task:create:team',
      'task:read:organization',
      'task:update:organization',
      'task:comment:team',
      'ticket:create:organization',
      'ticket:read:organization',
      'ticket:update:organization',
      'asset:read:organization',
      'asset:create:organization',
      'asset:update:organization',
      'amc:read:organization',
      'amc:create:organization',
      'amc:update:organization',
      'invoice:read:organization',
      'quote:read:organization',
      'lead:read:organization',
      'lead:create:organization',
      'lead:update:organization',
      'lead:convert:organization',
      // Guardian: MANAGER gets every action @Roles already lists it for in
      // guardian.controller.ts, including guardian:delete and
      // guardian:remediation (the two actions DEVELOPER is deliberately
      // excluded from — see DEVELOPER's list below).
      'guardian:create:organization',
      'guardian:read:organization',
      'guardian:update:organization',
      'guardian:delete:organization',
      'guardian:service_restart:organization',
      'guardian:logs_view:organization',
      'guardian:diagnostics:organization',
      'guardian:process_view:organization',
      'guardian:remediation:organization',
      'guardian:discovery:organization',
    ],
  },
  {
    name: 'DEVELOPER',
    description: 'Project development access',
    isSystem: true,
    permissions: [
      'user:read:team',
      'project:read:team',
      'task:create:team',
      'task:read:team',
      'task:update:own',
      'task:comment:team',
      'ticket:create:organization',
      'ticket:read:team',
      'ticket:update:own',
      // Guardian: every action @Roles lists DEVELOPER for in
      // guardian.controller.ts, except guardian:delete and
      // guardian:remediation — those two stay MANAGER/SUPER_ADMIN-only,
      // matching the narrower @Roles arrays already on those specific routes
      // (installer-tokens delete, disable/enable/rotate-secret, remediation).
      'guardian:create:organization',
      'guardian:read:organization',
      'guardian:update:organization',
      'guardian:service_restart:organization',
      'guardian:logs_view:organization',
      'guardian:diagnostics:organization',
      'guardian:process_view:organization',
    ],
  },
  {
    name: 'QA',
    description: 'Quality assurance access',
    isSystem: true,
    permissions: [
      'project:read:team',
      'task:read:team',
      'task:comment:team',
      'ticket:create:organization',
      'ticket:read:team',
      'ticket:update:team',
      // Guardian: QA only ever appears on read-only routes in
      // guardian.controller.ts (dashboard/monitors/alerts/status views).
      'guardian:read:organization',
    ],
  },
  {
    name: 'SALES',
    description: 'Sales and client management',
    isSystem: true,
    permissions: [
      'client:create:organization',
      'client:read:organization',
      'client:update:organization',
      'project:read:organization',
      'quote:create:organization',
      'quote:read:organization',
      'quote:update:organization',
      'lead:create:organization',
      'lead:read:organization',
      'lead:update:organization',
      'lead:convert:organization',
    ],
  },
  {
    name: 'SUPPORT',
    description: 'Support ticket management',
    isSystem: true,
    permissions: [
      'client:read:organization',
      'ticket:create:organization',
      'ticket:read:organization',
      'ticket:update:organization',
      'amc:read:organization',
    ],
  },
  {
    name: 'EMPLOYEE',
    description: 'General employee access for all team members',
    isSystem: true,
    permissions: [
      'client:read:organization',
      'project:read:organization',
      'task:create:team',
      'task:read:organization',
      'task:update:own',
      'task:comment:team',
      'ticket:create:organization',
      'ticket:read:organization',
      'ticket:update:own',
      'lead:read:organization',
      'asset:read:organization',
      'amc:read:organization',
      'invoice:read:organization',
      'quote:read:organization',
      // Guardian: EMPLOYEE only ever appears on read-only routes in
      // guardian.controller.ts, same as QA above.
      'guardian:read:organization',
    ],
  },
];
