import type {
  ComplaintWithRelations,
  ComplaintListResponse,
  CreateComplaintInput,
  TransitionInput,
  AssignInput,
  CreateCommentInput,
  Comment,
  Notification,
  Department,
  Category,
  Profile,
  ComplaintStatus,
  UserRole,
} from '@complaintease/shared';
import { ALLOWED_TRANSITIONS } from '@complaintease/shared';

export interface StoredUser {
  user: { id: string; email: string };
  password: string;
  profile: Profile;
}

export const BASELINE_USERS: Record<string, StoredUser> = {
  'admin@demo.com': {
    user: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', email: 'admin@demo.com' },
    password: 'Demo1234!',
    profile: {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      full_name: 'Marcus Vance (Plant Operations Director)',
      role: 'admin',
      department_id: null,
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
  'employee@demo.com': {
    user: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'employee@demo.com' },
    password: 'Demo1234!',
    profile: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      full_name: 'Alex Rivera (Plant Shift Operator)',
      role: 'employee',
      department_id: '11111111-1111-1111-1111-111111111111',
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
  'priya.it@demo.com': {
    user: { id: 'wwwwwwww-1111-1111-1111-111111111111', email: 'priya.it@demo.com' },
    password: 'Demo1234!',
    profile: {
      id: 'wwwwwwww-1111-1111-1111-111111111111',
      full_name: 'Priya Sharma (SCADA & Automation Lead)',
      role: 'employee',
      department_id: '55555555-5555-5555-5555-555555555555',
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
  'ravi.facilities@demo.com': {
    user: { id: 'wwwwwwww-2222-2222-2222-222222222222', email: 'ravi.facilities@demo.com' },
    password: 'Demo1234!',
    profile: {
      id: 'wwwwwwww-2222-2222-2222-222222222222',
      full_name: 'Ravi Kumar (Boiler & Utilities Specialist)',
      role: 'employee',
      department_id: '44444444-4444-4444-4444-444444444444',
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
  'vikram.electrician@demo.com': {
    user: { id: 'wwwwwwww-3333-3333-3333-333333333333', email: 'vikram.electrician@demo.com' },
    password: 'Demo1234!',
    profile: {
      id: 'wwwwwwww-3333-3333-3333-333333333333',
      full_name: 'Vikram Singh (Industrial Electrical Lead)',
      role: 'employee',
      department_id: '22222222-2222-2222-2222-222222222222',
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
  'ananya.hr@demo.com': {
    user: { id: 'wwwwwwww-4444-4444-4444-444444444444', email: 'ananya.hr@demo.com' },
    password: 'Demo1234!',
    profile: {
      id: 'wwwwwwww-4444-4444-4444-444444444444',
      full_name: 'Ananya Roy (Industrial Safety & EHS Officer)',
      role: 'employee',
      department_id: '33333333-3333-3333-3333-333333333333',
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
};

// Re-export for compatibility with other files referencing DEMO_PROFILES
export const DEMO_PROFILES: Record<string, { user: any; profile: Profile }> = BASELINE_USERS;

const INITIAL_DEPARTMENTS: Department[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Plant Mechanical & Heavy Equipment', description: 'Hydraulics, compressors, stamping presses, and conveyor systems', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Electrical & Power Distribution', description: '415V/11kV MCC switchgear, transformers, motor drives, and backup gensets', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Industrial Safety & EHS', description: 'Environmental health, hazmat containment, machine guards, and OSHA protocols', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Utilities, Steam & HVAC', description: 'Boiler house, 12-bar steam headers, chillers, cooling towers, and air compressors', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Automation, SCADA & Plant IT', description: 'PLCs, fieldbus telemetry, control room SCADA, sensors, and plant networking', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 'a1111111-1111-1111-1111-111111111111', name: 'Hydraulic & Pneumatic Line Failure', description: 'High-pressure line bursts, cylinder leakage, manifold seal blowouts', department_id: '11111111-1111-1111-1111-111111111111', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'a2222222-2222-2222-2222-222222222222', name: 'Conveyor & Gearbox Acoustic Vibration', description: 'Bearing degradation, roller seizure, abnormal gearbox harmonics', department_id: '11111111-1111-1111-1111-111111111111', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'b1111111-1111-1111-1111-111111111111', name: '415V Switchgear & Motor Drive Trip', description: 'MCC feeder trips, VFD overcurrent fault, terminal busbar thermal spike', department_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'b2222222-2222-2222-2222-222222222222', name: 'Emergency Power & UPS Fault', description: 'Diesel generator failover stall, battery bank cell discharge', department_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'c1111111-1111-1111-1111-111111111111', name: 'Hazardous Chemical Spill & Fume Alert', description: 'Coolant/acid containment breach, exhaust scrubber failure', department_id: '33333333-3333-3333-3333-333333333333', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'c2222222-2222-2222-2222-222222222222', name: 'E-Stop & Guard Interlock Defect', description: 'Safety light curtains, perimeter cage door interlocks, trip wires', department_id: '33333333-3333-3333-3333-333333333333', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'd1111111-1111-1111-1111-111111111111', name: 'High-Pressure Steam Flange Leak', description: '12-bar boiler header leak, valve gland blowout, live steam hazard', department_id: '44444444-4444-4444-4444-444444444444', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'e1111111-1111-1111-1111-111111111111', name: 'PLC Bus Timeout & Sensor Fault', description: 'Profibus/Modbus drops, 4-20mA pressure/temp transmitter drift', department_id: '55555555-5555-5555-5555-555555555555', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'f1111111-1111-1111-1111-111111111111', name: 'General Plant Hazard / Near Miss', description: 'Loose catwalk guardrail, tripping hazard, overhead crane cable wear', department_id: null, created_at: '2026-10-01T00:00:00.000Z' },
];

class MockStore {
  private users: Record<string, StoredUser> = {};
  private complaints: any[] = [];
  private departments: Department[] = [];
  private categories: Category[] = [];
  private comments: Record<string, Comment[]> = {};
  private attachments: Record<string, any[]> = {};
  private notifications: Notification[] = [];
  private auditLogs: any[] = [];

  constructor() {
    this.cleanLegacyDummyData();
    this.loadAll();

    // Listen to localStorage storage events across browser tabs
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('complaintease_')) {
          this.loadAll();
        }
      });
    }
  }

  /**
   * One-time cleanup to ensure all old hardcoded dummy complaints/comments
   * are purged from the browser localStorage for a clean slate.
   */
  private cleanLegacyDummyData() {
    if (typeof window === 'undefined') return;
    try {
      const CLEAN_FLAG = 'complaintease_clean_slate_v4';
      if (localStorage.getItem(CLEAN_FLAG) !== 'true') {
        localStorage.removeItem('complaintease_complaints');
        localStorage.removeItem('complaintease_comments');
        localStorage.removeItem('complaintease_attachments');
        localStorage.removeItem('complaintease_notifications');
        localStorage.removeItem('complaintease_audit_logs');
        localStorage.setItem(CLEAN_FLAG, 'true');
      }
    } catch (e) {
      // ignore
    }
  }

  private loadAll() {
    if (typeof window === 'undefined') {
      this.users = { ...BASELINE_USERS };
      this.complaints = [];
      this.departments = [...INITIAL_DEPARTMENTS];
      this.categories = [...INITIAL_CATEGORIES];
      this.comments = {};
      this.attachments = {};
      this.notifications = [];
      this.auditLogs = [];
      return;
    }

    try {
      // 1. Users
      const rawUsers = localStorage.getItem('complaintease_users');
      if (rawUsers) {
        this.users = JSON.parse(rawUsers);
      } else {
        this.users = { ...BASELINE_USERS };
        localStorage.setItem('complaintease_users', JSON.stringify(this.users));
      }

      // Ensure baseline admin and employee exist
      Object.entries(BASELINE_USERS).forEach(([email, u]) => {
        if (!this.users[email]) {
          this.users[email] = u;
        }
      });

      // 2. Complaints: starts empty
      const rawComplaints = localStorage.getItem('complaintease_complaints');
      this.complaints = rawComplaints ? JSON.parse(rawComplaints) : [];

      // 3. Departments
      const rawDepts = localStorage.getItem('complaintease_departments');
      this.departments = rawDepts ? JSON.parse(rawDepts) : [...INITIAL_DEPARTMENTS];

      // 4. Categories
      const rawCats = localStorage.getItem('complaintease_categories');
      this.categories = rawCats ? JSON.parse(rawCats) : [...INITIAL_CATEGORIES];

      // 5. Comments: starts empty
      const rawComments = localStorage.getItem('complaintease_comments');
      this.comments = rawComments ? JSON.parse(rawComments) : {};

      // 6. Attachments: starts empty
      const rawAtts = localStorage.getItem('complaintease_attachments');
      this.attachments = rawAtts ? JSON.parse(rawAtts) : {};

      // 7. Notifications: starts empty
      const rawNotifs = localStorage.getItem('complaintease_notifications');
      this.notifications = rawNotifs ? JSON.parse(rawNotifs) : [];

      // 8. Audit logs: starts empty
      const rawAudit = localStorage.getItem('complaintease_audit_logs');
      this.auditLogs = rawAudit ? JSON.parse(rawAudit) : [];
    } catch (err) {
      console.warn('Error reading from localStorage:', err);
    }
  }

  private persist(key: string, data: any) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(`complaintease_${key}`, JSON.stringify(data));
      this.broadcastSync();
    } catch (e) {
      console.error(`Failed to persist complaintease_${key}:`, e);
    }
  }

  private broadcastSync() {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('complaintease_sync_ping', Date.now().toString());
      window.dispatchEvent(new CustomEvent('complaintease_storage_sync'));
    } catch (e) {
      // ignore
    }
  }

  // =========================================================================
  // USER AUTHENTICATION & REGISTRATION
  // =========================================================================

  registerUser(data: {
    email: string;
    password?: string;
    full_name: string;
    role?: UserRole;
    department_id?: string | null;
  }): { id: string; email: string; message: string } {
    const normEmail = data.email.toLowerCase().trim();

    // Prevent anyone from registering or overtaking the single administrator account
    if (normEmail === 'admin@demo.com' || normEmail === 'admin@plant.com') {
      throw new Error('This is a reserved administrative account. Please sign in directly using admin credentials.');
    }

    if (this.users[normEmail]) {
      throw new Error(`An account with email "${data.email}" already exists. Please sign in.`);
    }

    const userId = crypto.randomUUID();
    const newUser: StoredUser = {
      user: { id: userId, email: normEmail },
      password: data.password || 'Demo1234!',
      profile: {
        id: userId,
        full_name: data.full_name.trim(),
        role: 'employee', // STRICT: All public registrations are employee accounts only
        department_id: data.department_id || null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    this.users[normEmail] = newUser;
    this.persist('users', this.users);

    // Audit log
    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor: userId,
      action: 'INSERT',
      table_name: 'profiles',
      row_id: userId,
      old_data: null,
      new_data: newUser.profile,
      created_at: new Date().toISOString(),
      actor_profile: newUser.profile,
    });
    this.persist('audit_logs', this.auditLogs);

    return {
      id: userId,
      email: normEmail,
      message: 'Account registered successfully.',
    };
  }

  authenticate(email: string, password: string): { user: any; profile: Profile } {
    const normEmail = email.toLowerCase().trim();
    const stored = this.users[normEmail];

    if (!stored) {
      throw new Error(`No account found for "${email}". Please register or check your email.`);
    }

    if (stored.password !== password) {
      throw new Error('Incorrect password. Please try again.');
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('complaintease_demo_user', normEmail);
      this.broadcastSync();
    }

    return {
      user: stored.user,
      profile: stored.profile,
    };
  }

  getUserByEmail(email: string): StoredUser | undefined {
    return this.users[email.toLowerCase().trim()];
  }

  getCurrentProfile(): Profile | undefined {
    if (typeof window === 'undefined') return undefined;
    const activeEmail = localStorage.getItem('complaintease_demo_user');
    if (!activeEmail) return undefined;
    return this.users[activeEmail.toLowerCase().trim()]?.profile;
  }

  getUsers(): Profile[] {
    return Object.values(this.users).map((u) => u.profile);
  }

  updateUserRole(id: string, data: { role: string; department_id?: string | null }): Profile {
    const target = Object.values(this.users).find((u) => u.profile.id === id);
    if (!target) throw new Error('User not found');

    // Protect primary root admin from accidental demotion
    if (target.user.email === 'admin@demo.com' && data.role !== 'admin') {
      throw new Error('Cannot demote the primary Plant Operations Director account.');
    }

    const oldData = { ...target.profile };
    target.profile.role = data.role as UserRole;
    if (data.department_id !== undefined) target.profile.department_id = data.department_id;
    target.profile.updated_at = new Date().toISOString();

    this.persist('users', this.users);

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor: this.getCurrentProfile()?.id || null,
      action: 'UPDATE',
      table_name: 'profiles',
      row_id: id,
      old_data: oldData,
      new_data: target.profile,
      created_at: new Date().toISOString(),
      actor_profile: this.getCurrentProfile() || target.profile,
    });
    this.persist('audit_logs', this.auditLogs);

    return target.profile;
  }

  // =========================================================================
  // DEPARTMENTS & CATEGORIES
  // =========================================================================

  getDepartments(): Department[] {
    return this.departments;
  }

  createDepartment(data: any): Department {
    const dept: Department = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description || null,
      head_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.departments.push(dept);
    this.persist('departments', this.departments);
    return dept;
  }

  deleteDepartment(id: string) {
    this.departments = this.departments.filter((d) => d.id !== id);
    this.persist('departments', this.departments);
  }

  getCategories(): Category[] {
    return this.categories;
  }

  createCategory(data: any): Category {
    const cat: Category = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description || null,
      department_id: data.department_id || null,
      created_at: new Date().toISOString(),
    };
    this.categories.push(cat);
    this.persist('categories', this.categories);
    return cat;
  }

  deleteCategory(id: string) {
    this.categories = this.categories.filter((c) => c.id !== id);
    this.persist('categories', this.categories);
  }

  getAuditLogs(): any[] {
    return this.auditLogs;
  }

  // =========================================================================
  // COMPLAINTS MANAGEMENT
  // =========================================================================

  listComplaints(params: Record<string, any>, currentProfile?: Profile): ComplaintListResponse {
    let list = [...this.complaints];

    // RLS emulation:
    // If user is employee: they see ONLY their own reported complaints!
    // If user is admin: they see ALL complaints across the entire plant!
    if (currentProfile?.role === 'employee') {
      list = list.filter((c) => c.created_by === currentProfile.id);
    }

    if (params.status) list = list.filter((c) => c.status === params.status);
    if (params.priority) list = list.filter((c) => c.priority === params.priority);
    if (params.department_id) list = list.filter((c) => c.department_id === params.department_id);
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.location_address && c.location_address.toLowerCase().includes(q)),
      );
    }

    const formatted = list.map((c) => ({
      ...c,
      category: this.categories.find((cat) => cat.id === c.category_id) || { id: c.category_id, name: 'General' },
      department: this.departments.find((d) => d.id === c.department_id) || { id: c.department_id, name: 'General' },
      creator:
        Object.values(this.users).find((u) => u.profile.id === c.created_by)?.profile || {
          id: c.created_by,
          full_name: 'Employee',
          avatar_url: null,
        },
      comment_count: (this.comments[c.id] || []).length,
      attachment_count: (this.attachments[c.id] || []).length,
    }));

    return {
      data: formatted as any,
      next_cursor: null,
      total_count: formatted.length,
    };
  }

  getComplaint(id: string): any {
    const c = this.complaints.find((comp) => comp.id === id);
    if (!c) throw new Error('Plant incident not found.');

    return {
      ...c,
      category: this.categories.find((cat) => cat.id === c.category_id) || { id: c.category_id, name: 'General' },
      department: this.departments.find((d) => d.id === c.department_id) || { id: c.department_id, name: 'General' },
      creator:
        Object.values(this.users).find((u) => u.profile.id === c.created_by)?.profile || {
          id: c.created_by,
          full_name: 'Employee',
          avatar_url: null,
        },
      status_history: c.status_history || [],
    };
  }

  createComplaint(data: CreateComplaintInput, currentProfile?: Profile): any {
    const creator = currentProfile || this.getCurrentProfile() || this.users['employee@demo.com']?.profile;
    const creatorId = creator?.id || crypto.randomUUID();

    const newComp = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      category_id: data.category_id,
      department_id: data.department_id,
      priority: data.priority,
      location_lat: data.location_lat ?? null,
      location_lng: data.location_lng ?? null,
      location_address: data.location_address ?? null,
      image_url: data.image_url ?? null,
      created_by: creatorId,
      status: 'submitted' as ComplaintStatus,
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resolved_at: null,
      assigned_to: null,
      status_history: [
        {
          id: crypto.randomUUID(),
          complaint_id: '',
          from_status: null,
          to_status: 'submitted',
          changed_by: creatorId,
          note: 'Reported by employee via portal with live telemetry',
          created_at: new Date().toISOString(),
          changer: { full_name: creator?.full_name || 'Shift Operator' },
        },
      ],
    };
    newComp.status_history[0].complaint_id = newComp.id;

    this.complaints.unshift(newComp);
    this.persist('complaints', this.complaints);

    // Notify admins of new incident
    const adminUser = Object.values(this.users).find((u) => u.profile.role === 'admin');
    if (adminUser) {
      this.notifications.unshift({
        id: crypto.randomUUID(),
        user_id: adminUser.profile.id,
        complaint_id: newComp.id,
        type: 'status_changed',
        title: 'New Plant Incident Reported',
        body: `[${newComp.priority.toUpperCase()}] ${newComp.title}`,
        is_read: false,
        created_at: new Date().toISOString(),
      });
      this.persist('notifications', this.notifications);
    }

    // Audit log
    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor: creatorId,
      action: 'INSERT',
      table_name: 'complaints',
      row_id: newComp.id,
      old_data: null,
      new_data: newComp,
      created_at: new Date().toISOString(),
      actor_profile: creator,
    });
    this.persist('audit_logs', this.auditLogs);

    return newComp;
  }

  transitionComplaint(id: string, data: TransitionInput, currentProfile?: Profile) {
    const comp = this.complaints.find((c) => c.id === id);
    if (!comp) throw new Error('Plant incident not found.');

    // Optimistic lock check
    if (comp.version !== data.expected_version) {
      throw new Error(`Conflict: expected version ${data.expected_version}, but current version is ${comp.version}. Please refresh.`);
    }

    // Allowed transition check
    const allowed = ALLOWED_TRANSITIONS[comp.status as ComplaintStatus] || [];
    if (!allowed.includes(data.new_status)) {
      throw new Error(`Invalid status transition from ${comp.status} to ${data.new_status}`);
    }

    const actor = currentProfile || this.getCurrentProfile();
    const oldStatus = comp.status;
    comp.status = data.new_status;
    comp.version += 1;
    comp.updated_at = new Date().toISOString();
    if (data.new_status === 'resolved') comp.resolved_at = new Date().toISOString();
    if (data.new_status === 'reopened') comp.resolved_at = null;

    comp.status_history = comp.status_history || [];
    comp.status_history.push({
      id: crypto.randomUUID(),
      complaint_id: id,
      from_status: oldStatus,
      to_status: data.new_status,
      changed_by: actor?.id || 'admin',
      note: data.note || null,
      created_at: new Date().toISOString(),
      changer: { full_name: actor?.full_name || 'Plant Supervisor' },
    });

    this.persist('complaints', this.complaints);

    // Notify author of status change
    this.notifications.unshift({
      id: crypto.randomUUID(),
      user_id: comp.created_by,
      complaint_id: id,
      type: 'status_changed',
      title: 'Plant Incident Status Updated',
      body: `Incident "${comp.title}" is now ${data.new_status.replace('_', ' ')}.`,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    this.persist('notifications', this.notifications);

    // Audit log
    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor: actor?.id || null,
      action: 'UPDATE',
      table_name: 'complaints',
      row_id: id,
      old_data: { status: oldStatus, version: comp.version - 1 },
      new_data: { status: comp.status, version: comp.version },
      created_at: new Date().toISOString(),
      actor_profile: actor,
    });
    this.persist('audit_logs', this.auditLogs);

    return { message: 'Transition succeeded', result: comp };
  }

  assignComplaint(id: string, data: AssignInput, currentProfile?: Profile) {
    const comp = this.complaints.find((c) => c.id === id);
    if (!comp) throw new Error('Plant incident not found.');

    const assignee = Object.values(this.users).find((u) => u.profile.id === data.assigned_to)?.profile;
    comp.assigned_to = assignee ? { id: assignee.id, full_name: assignee.full_name } : null;
    comp.updated_at = new Date().toISOString();

    const oldStatus = comp.status;
    if (comp.status === 'submitted' || comp.status === 'under_review') {
      comp.status = 'assigned';
      comp.version += 1;
    }

    const actor = currentProfile || this.getCurrentProfile();

    comp.status_history = comp.status_history || [];
    comp.status_history.push({
      id: crypto.randomUUID(),
      complaint_id: id,
      from_status: oldStatus,
      to_status: comp.status,
      changed_by: actor?.id || 'admin',
      note: data.note || `Assigned to ${assignee?.full_name || 'specialist'}`,
      created_at: new Date().toISOString(),
      changer: { full_name: actor?.full_name || 'Plant Supervisor' },
    });

    this.persist('complaints', this.complaints);

    // Notify employee of worker assignment
    this.notifications.unshift({
      id: crypto.randomUUID(),
      user_id: comp.created_by,
      complaint_id: id,
      type: 'assigned',
      title: 'Technician Assigned',
      body: `${assignee?.full_name || 'A specialist'} has been assigned to investigate "${comp.title}".`,
      is_read: false,
      created_at: new Date().toISOString(),
    });
    this.persist('notifications', this.notifications);

    return { message: 'Assigned successfully', assignee };
  }

  // =========================================================================
  // COMMENTS & ATTACHMENTS
  // =========================================================================

  getComments(complaintId: string, currentProfile?: Profile): Comment[] {
    const all = this.comments[complaintId] || [];
    // RLS: hide internal notes from regular employees
    if (currentProfile?.role === 'employee') {
      return all.filter((c) => !c.is_internal);
    }
    return all;
  }

  createComment(complaintId: string, data: CreateCommentInput, currentProfile?: Profile): Comment {
    const author = currentProfile || this.getCurrentProfile();
    const newComment: Comment = {
      id: crypto.randomUUID(),
      complaint_id: complaintId,
      author_id: author?.id || 'unknown',
      body: data.body,
      is_internal: author?.role === 'employee' ? false : Boolean(data.is_internal),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: author?.id || 'unknown',
        full_name: author?.full_name || 'User',
        avatar_url: null,
      },
    };

    if (!this.comments[complaintId]) this.comments[complaintId] = [];
    this.comments[complaintId].push(newComment);
    this.persist('comments', this.comments);

    return newComment;
  }

  deleteComment(commentId: string) {
    for (const key of Object.keys(this.comments)) {
      this.comments[key] = this.comments[key].filter((c) => c.id !== commentId);
    }
    this.persist('comments', this.comments);
  }

  getAttachments(complaintId: string): any[] {
    return this.attachments[complaintId] || [];
  }

  confirmAttachment(complaintId: string, data: any, currentProfile?: Profile) {
    const uploader = currentProfile || this.getCurrentProfile();
    const item = {
      id: crypto.randomUUID(),
      complaint_id: complaintId,
      uploaded_by: uploader?.id || 'unknown',
      file_name: data.file_name,
      file_size: data.file_size,
      mime_type: data.mime_type,
      storage_path: data.storage_path,
      created_at: new Date().toISOString(),
      uploader: { full_name: uploader?.full_name || 'Plant Staff' },
      download_url: '#',
    };
    if (!this.attachments[complaintId]) this.attachments[complaintId] = [];
    this.attachments[complaintId].push(item);
    this.persist('attachments', this.attachments);
    return item;
  }

  getNotifications(userId?: string): Notification[] {
    if (!userId) return this.notifications;
    return this.notifications.filter((n) => n.user_id === userId);
  }

  markNotificationRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) {
      notif.is_read = true;
      this.persist('notifications', this.notifications);
    }
  }

  markAllNotificationsRead(userId?: string) {
    this.notifications.forEach((n) => {
      if (!userId || n.user_id === userId) n.is_read = true;
    });
    this.persist('notifications', this.notifications);
  }

  /**
   * Resets local database back to pristine clean state (0 complaints, 0 comments)
   */
  resetStore() {
    this.complaints = [];
    this.comments = {};
    this.attachments = {};
    this.notifications = [];
    this.auditLogs = [];
    this.users = { ...BASELINE_USERS };
    this.departments = [...INITIAL_DEPARTMENTS];
    this.categories = [...INITIAL_CATEGORIES];

    this.persist('complaints', this.complaints);
    this.persist('comments', this.comments);
    this.persist('attachments', this.attachments);
    this.persist('notifications', this.notifications);
    this.persist('audit_logs', this.auditLogs);
    this.persist('users', this.users);
    this.persist('departments', this.departments);
    this.persist('categories', this.categories);
  }
}

export const mockStore = new MockStore();
