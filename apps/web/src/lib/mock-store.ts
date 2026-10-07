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
} from '@complaintease/shared';
import { ALLOWED_TRANSITIONS } from '@complaintease/shared';

export const DEMO_PROFILES: Record<string, { user: any; profile: Profile }> = {
  'employee@demo.com': {
    user: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'employee@demo.com' },
    profile: {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      full_name: 'Alex Employee',
      role: 'employee',
      department_id: null,
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
  'depthead@demo.com': {
    user: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'depthead@demo.com' },
    profile: {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      full_name: 'Sarah IT Head',
      role: 'dept_head',
      department_id: '11111111-1111-1111-1111-111111111111',
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
  'admin@demo.com': {
    user: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', email: 'admin@demo.com' },
    profile: {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      full_name: 'Marcus Administrator',
      role: 'admin',
      department_id: null,
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
};

const INITIAL_DEPARTMENTS: Department[] = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Information Technology', description: 'IT systems, hardware, networks', head_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Human Resources', description: 'People operations, payroll, welfare', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Finance & Accounting', description: 'Billing, corporate expenses, audits', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: '44444444-4444-4444-4444-444444444444', name: 'Facilities & Operations', description: 'Workplace HVAC, security, ergonomics', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
  { id: '55555555-5555-5555-5555-555555555555', name: 'Customer Experience', description: 'Customer escalations, tier-3 support', head_id: null, created_at: '2026-10-01T00:00:00.000Z', updated_at: '2026-10-01T00:00:00.000Z' },
];

const INITIAL_CATEGORIES: Category[] = [
  { id: 'a1111111-1111-1111-1111-111111111111', name: 'VPN & Network Outage', description: 'Corporate VPN or gateway failure', department_id: '11111111-1111-1111-1111-111111111111', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'a2222222-2222-2222-2222-222222222222', name: 'Laptop Hardware Malfunction', description: 'Broken monitor, battery defect', department_id: '11111111-1111-1111-1111-111111111111', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'b1111111-1111-1111-1111-111111111111', name: 'Payroll Discrepancy', description: 'Salary or reimbursement issue', department_id: '22222222-2222-2222-2222-222222222222', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'c1111111-1111-1111-1111-111111111111', name: 'Corporate Card Reconciliation', description: 'Expense receipt review', department_id: '33333333-3333-3333-3333-333333333333', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'd1111111-1111-1111-1111-111111111111', name: 'HVAC Temperature Issue', description: 'Server room cooling failure', department_id: '44444444-4444-4444-4444-444444444444', created_at: '2026-10-01T00:00:00.000Z' },
  { id: 'f1111111-1111-1111-1111-111111111111', name: 'General Grievance', description: 'Workplace suggestions', department_id: null, created_at: '2026-10-01T00:00:00.000Z' },
];

const INITIAL_COMPLAINTS: any[] = [
  {
    id: 'c1111111-0001-0000-0000-000000000001',
    title: 'Intermittent WiFi drops in Conference Room C',
    description: 'During critical client demos, the access point disconnects laptops every 15 minutes. Packet loss exceeds 35%. Impacting deal closures.',
    category_id: 'a1111111-1111-1111-1111-111111111111',
    department_id: '11111111-1111-1111-1111-111111111111',
    created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: 'submitted',
    priority: 'high',
    created_at: '2026-10-07T14:30:00.000Z',
    updated_at: '2026-10-07T14:30:00.000Z',
    resolved_at: null,
    version: 1,
    assigned_to: null,
    status_history: [
      {
        id: 'h1',
        complaint_id: 'c1111111-0001-0000-0000-000000000001',
        from_status: null,
        to_status: 'submitted',
        changed_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        note: 'Submitted by employee via portal',
        created_at: '2026-10-07T14:30:00.000Z',
        changer: { full_name: 'Alex Employee' },
      },
    ],
  },
  {
    id: 'c1111111-0002-0000-0000-000000000002',
    title: 'Workstation thermal throttling during Rust build',
    description: 'Developer machine CPU exceeds 98C under compile load. Fan is making grinding acoustic noise. Thermal paste replacement needed.',
    category_id: 'a2222222-2222-2222-2222-222222222222',
    department_id: '11111111-1111-1111-1111-111111111111',
    created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: 'under_review',
    priority: 'medium',
    created_at: '2026-10-06T10:00:00.000Z',
    updated_at: '2026-10-06T11:20:00.000Z',
    resolved_at: null,
    version: 2,
    assigned_to: null,
    status_history: [
      {
        id: 'h2a',
        complaint_id: 'c1111111-0002-0000-0000-000000000002',
        from_status: null,
        to_status: 'submitted',
        changed_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        note: 'Initial report',
        created_at: '2026-10-06T10:00:00.000Z',
        changer: { full_name: 'Alex Employee' },
      },
      {
        id: 'h2b',
        complaint_id: 'c1111111-0002-0000-0000-000000000002',
        from_status: 'submitted',
        to_status: 'under_review',
        changed_by: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        note: 'Reviewing hardware maintenance schedule',
        created_at: '2026-10-06T11:20:00.000Z',
        changer: { full_name: 'Sarah IT Head' },
      },
    ],
  },
  {
    id: 'c1111111-0003-0000-0000-000000000003',
    title: 'Server Room 2 HVAC unit leaking condensation',
    description: 'Noticeable water pooling near Rack D in the secondary server room. Immediate HVAC service required before equipment is damaged.',
    category_id: 'd1111111-1111-1111-1111-111111111111',
    department_id: '44444444-4444-4444-4444-444444444444',
    created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: 'resolved',
    priority: 'critical',
    created_at: '2026-10-05T09:00:00.000Z',
    updated_at: '2026-10-05T16:00:00.000Z',
    resolved_at: '2026-10-05T16:00:00.000Z',
    version: 4,
    assigned_to: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', full_name: 'Sarah IT Head' },
    status_history: [
      {
        id: 'h3a',
        complaint_id: 'c1111111-0003-0000-0000-000000000003',
        from_status: null,
        to_status: 'submitted',
        changed_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        note: 'Emergency facility ticket',
        created_at: '2026-10-05T09:00:00.000Z',
        changer: { full_name: 'Alex Employee' },
      },
      {
        id: 'h3b',
        complaint_id: 'c1111111-0003-0000-0000-000000000003',
        from_status: 'submitted',
        to_status: 'under_review',
        changed_by: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        note: 'High severity triage',
        created_at: '2026-10-05T09:15:00.000Z',
        changer: { full_name: 'Sarah IT Head' },
      },
      {
        id: 'h3c',
        complaint_id: 'c1111111-0003-0000-0000-000000000003',
        from_status: 'under_review',
        to_status: 'in_progress',
        changed_by: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        note: 'Facilities contractor on-site fixing drainage pan',
        created_at: '2026-10-05T11:00:00.000Z',
        changer: { full_name: 'Sarah IT Head' },
      },
      {
        id: 'h3d',
        complaint_id: 'c1111111-0003-0000-0000-000000000003',
        from_status: 'in_progress',
        to_status: 'resolved',
        changed_by: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        note: 'HVAC pipe cleared and condensation pump replaced. Tested at 18C stable.',
        created_at: '2026-10-05T16:00:00.000Z',
        changer: { full_name: 'Sarah IT Head' },
      },
    ],
  },
];

const INITIAL_COMMENTS: Record<string, Comment[]> = {
  'c1111111-0001-0000-0000-000000000001': [
    {
      id: 'comm1',
      complaint_id: 'c1111111-0001-0000-0000-000000000001',
      author_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      body: 'Can someone inspect the access point? It disrupted our Q3 client presentation today.',
      is_internal: false,
      created_at: '2026-10-07T14:35:00.000Z',
      updated_at: '2026-10-07T14:35:00.000Z',
      author: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', full_name: 'Alex Employee', avatar_url: null },
    },
    {
      id: 'comm2',
      complaint_id: 'c1111111-0001-0000-0000-000000000001',
      author_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      body: 'INTERNAL NOTE: Network switch port 14 has duplex mismatch errors. Dispatching technician to recable.',
      is_internal: true,
      created_at: '2026-10-07T15:00:00.000Z',
      updated_at: '2026-10-07T15:00:00.000Z',
      author: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', full_name: 'Sarah IT Head', avatar_url: null },
    },
  ],
};

const INITIAL_ATTACHMENTS: Record<string, any[]> = {
  'c1111111-0001-0000-0000-000000000001': [
    {
      id: 'att1',
      complaint_id: 'c1111111-0001-0000-0000-000000000001',
      uploaded_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      file_name: 'ping_packet_loss_log.txt',
      file_size: 4096,
      mime_type: 'text/plain',
      storage_path: 'mock/ping_packet_loss_log.txt',
      created_at: '2026-10-07T14:32:00.000Z',
      uploader: { full_name: 'Alex Employee' },
      download_url: '#',
    },
  ],
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    complaint_id: 'c1111111-0003-0000-0000-000000000003',
    type: 'status_changed',
    title: 'Complaint Resolved',
    body: 'Your complaint "Server Room 2 HVAC unit leaking" has been marked resolved.',
    is_read: false,
    created_at: '2026-10-05T16:00:00.000Z',
  },
  {
    id: 'n2',
    user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    complaint_id: 'c1111111-0001-0000-0000-000000000001',
    type: 'status_changed',
    title: 'New Complaint Filed',
    body: 'New high priority complaint submitted for IT: WiFi drops in Conf Room C',
    is_read: false,
    created_at: '2026-10-07T14:30:00.000Z',
  },
];

const INITIAL_AUDIT_LOGS = [
  {
    id: 'aud-1',
    actor: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    action: 'UPDATE',
    table_name: 'complaints',
    row_id: 'c1111111-0003-0000-0000-000000000003',
    old_data: { status: 'in_progress', version: 3 },
    new_data: { status: 'resolved', version: 4 },
    created_at: '2026-10-05T16:00:00.000Z',
    actor_profile: { full_name: 'Sarah IT Head', role: 'dept_head' },
  },
  {
    id: 'aud-2',
    actor: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    action: 'INSERT',
    table_name: 'complaints',
    row_id: 'c1111111-0001-0000-0000-000000000001',
    old_data: null,
    new_data: { status: 'submitted', title: 'WiFi drops in Conference Room C', version: 1 },
    created_at: '2026-10-07T14:30:00.000Z',
    actor_profile: { full_name: 'Alex Employee', role: 'employee' },
  },
];

class MockStore {
  private complaints = [...INITIAL_COMPLAINTS];
  private departments = [...INITIAL_DEPARTMENTS];
  private categories = [...INITIAL_CATEGORIES];
  private comments = { ...INITIAL_COMMENTS };
  private attachments = { ...INITIAL_ATTACHMENTS };
  private notifications = [...INITIAL_NOTIFICATIONS];
  private auditLogs = [...INITIAL_AUDIT_LOGS];

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
    return dept;
  }

  deleteDepartment(id: string) {
    this.departments = this.departments.filter((d) => d.id !== id);
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
    return cat;
  }

  deleteCategory(id: string) {
    this.categories = this.categories.filter((c) => c.id !== id);
  }

  getUsers(): Profile[] {
    return Object.values(DEMO_PROFILES).map((p) => p.profile);
  }

  updateUserRole(id: string, data: any): Profile {
    const target = Object.values(DEMO_PROFILES).find((p) => p.profile.id === id);
    if (target) {
      target.profile.role = data.role;
      if (data.department_id !== undefined) target.profile.department_id = data.department_id;
      return target.profile;
    }
    throw new Error('User not found');
  }

  getAuditLogs(): any[] {
    return this.auditLogs;
  }

  listComplaints(params: Record<string, any>, currentProfile?: Profile): ComplaintListResponse {
    let list = [...this.complaints];

    // RLS emulation
    if (currentProfile?.role === 'employee') {
      list = list.filter((c) => c.created_by === currentProfile.id);
    } else if (currentProfile?.role === 'dept_head') {
      if (currentProfile.department_id) {
        list = list.filter((c) => c.department_id === currentProfile.department_id);
      }
    }

    if (params.status) list = list.filter((c) => c.status === params.status);
    if (params.priority) list = list.filter((c) => c.priority === params.priority);
    if (params.department_id) list = list.filter((c) => c.department_id === params.department_id);
    if (params.search) {
      const q = params.search.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }

    const formatted = list.map((c) => ({
      ...c,
      category: this.categories.find((cat) => cat.id === c.category_id) || { id: c.category_id, name: 'General' },
      department: this.departments.find((d) => d.id === c.department_id) || { id: c.department_id, name: 'General' },
      creator: Object.values(DEMO_PROFILES).find((p) => p.profile.id === c.created_by)?.profile || {
        id: c.created_by,
        full_name: 'Alex Employee',
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
    if (!c) throw new Error('Complaint not found');

    return {
      ...c,
      category: this.categories.find((cat) => cat.id === c.category_id) || { id: c.category_id, name: 'General' },
      department: this.departments.find((d) => d.id === c.department_id) || { id: c.department_id, name: 'General' },
      creator: Object.values(DEMO_PROFILES).find((p) => p.profile.id === c.created_by)?.profile || {
        id: c.created_by,
        full_name: 'Staff',
        avatar_url: null,
      },
      status_history: c.status_history || [],
    };
  }

  createComplaint(data: CreateComplaintInput, currentProfile?: Profile): any {
    const creatorId = currentProfile?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const newComp = {
      id: crypto.randomUUID(),
      title: data.title,
      description: data.description,
      category_id: data.category_id,
      department_id: data.department_id,
      priority: data.priority,
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
          note: 'Submitted by employee',
          created_at: new Date().toISOString(),
          changer: { full_name: currentProfile?.full_name || 'Employee' },
        },
      ],
    };
    newComp.status_history[0].complaint_id = newComp.id;
    this.complaints.unshift(newComp);

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
      actor_profile: { full_name: currentProfile?.full_name || 'Employee', role: currentProfile?.role || 'employee' },
    });

    return newComp;
  }

  transitionComplaint(id: string, data: TransitionInput, currentProfile?: Profile) {
    const comp = this.complaints.find((c) => c.id === id);
    if (!comp) throw new Error('Complaint not found');

    // Optimistic lock check
    if (comp.version !== data.expected_version) {
      throw new Error(`Conflict: expected version ${data.expected_version}, but current version is ${comp.version}. Please refresh.`);
    }

    // Allowed transition check
    const allowed = ALLOWED_TRANSITIONS[comp.status as ComplaintStatus] || [];
    if (!allowed.includes(data.new_status)) {
      throw new Error(`Invalid status transition from ${comp.status} to ${data.new_status}`);
    }

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
      changed_by: currentProfile?.id || 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      note: data.note || null,
      created_at: new Date().toISOString(),
      changer: { full_name: currentProfile?.full_name || 'Staff' },
    });

    // Notify author if status changed
    this.notifications.unshift({
      id: crypto.randomUUID(),
      user_id: comp.created_by,
      complaint_id: id,
      type: 'status_changed',
      title: 'Status Updated',
      body: `Complaint "${comp.title}" is now ${data.new_status.replace('_', ' ')}`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    return { message: 'Transition succeeded', result: comp };
  }

  assignComplaint(id: string, data: AssignInput, currentProfile?: Profile) {
    const comp = this.complaints.find((c) => c.id === id);
    if (!comp) throw new Error('Complaint not found');

    const assignee = Object.values(DEMO_PROFILES).find((p) => p.profile.id === data.assigned_to)?.profile;
    comp.assigned_to = assignee ? { id: assignee.id, full_name: assignee.full_name } : null;

    if (comp.status === 'submitted' || comp.status === 'under_review') {
      comp.status = 'assigned';
      comp.version += 1;
    }

    return { message: 'Assigned successfully', assignee };
  }

  getComments(complaintId: string, currentProfile?: Profile): Comment[] {
    const all = this.comments[complaintId] || [];
    // RLS: hide internal comments from employee
    if (currentProfile?.role === 'employee') {
      return all.filter((c) => !c.is_internal);
    }
    return all;
  }

  createComment(complaintId: string, data: CreateCommentInput, currentProfile?: Profile): Comment {
    const newComment: Comment = {
      id: crypto.randomUUID(),
      complaint_id: complaintId,
      author_id: currentProfile?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      body: data.body,
      is_internal: currentProfile?.role === 'employee' ? false : Boolean(data.is_internal),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      author: {
        id: currentProfile?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        full_name: currentProfile?.full_name || 'Employee',
        avatar_url: null,
      },
    };

    if (!this.comments[complaintId]) this.comments[complaintId] = [];
    this.comments[complaintId].push(newComment);
    return newComment;
  }

  deleteComment(commentId: string) {
    for (const key of Object.keys(this.comments)) {
      this.comments[key] = this.comments[key].filter((c) => c.id !== commentId);
    }
  }

  getAttachments(complaintId: string): any[] {
    return this.attachments[complaintId] || [];
  }

  confirmAttachment(complaintId: string, data: any, currentProfile?: Profile) {
    const item = {
      id: crypto.randomUUID(),
      complaint_id: complaintId,
      uploaded_by: currentProfile?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      file_name: data.file_name,
      file_size: data.file_size,
      mime_type: data.mime_type,
      storage_path: data.storage_path,
      created_at: new Date().toISOString(),
      uploader: { full_name: currentProfile?.full_name || 'Staff' },
      download_url: '#',
    };
    if (!this.attachments[complaintId]) this.attachments[complaintId] = [];
    this.attachments[complaintId].push(item);
    return item;
  }

  getNotifications(userId?: string): Notification[] {
    if (!userId) return this.notifications;
    return this.notifications.filter((n) => n.user_id === userId);
  }

  markNotificationRead(id: string) {
    const notif = this.notifications.find((n) => n.id === id);
    if (notif) notif.is_read = true;
  }

  markAllNotificationsRead(userId?: string) {
    this.notifications.forEach((n) => {
      if (!userId || n.user_id === userId) n.is_read = true;
    });
  }
}

export const mockStore = new MockStore();
