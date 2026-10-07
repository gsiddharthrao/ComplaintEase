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
      full_name: 'Alex Rivera (Plant Shift Operator)',
      role: 'employee',
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
      full_name: 'Marcus Vance (Plant Operations Director)',
      role: 'admin',
      department_id: null,
      avatar_url: null,
      created_at: '2026-10-01T08:00:00.000Z',
      updated_at: '2026-10-01T08:00:00.000Z',
    },
  },
  'priya.it@demo.com': {
    user: { id: 'wwwwwwww-1111-1111-1111-111111111111', email: 'priya.it@demo.com' },
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

const INITIAL_COMPLAINTS: any[] = [
  {
    id: 'c1111111-0001-0000-0000-000000000001',
    title: '500-Ton Hydraulic Press Primary Cylinder Pressure Loss',
    description: 'Hydraulic stamping press #4 in Bay 3 suffering severe 180-bar pressure drops during compression stroke. Hydraulic fluid pooling on baseplate near manifold flange. Risk of line blowout and production line stall.',
    category_id: 'a1111111-1111-1111-1111-111111111111',
    department_id: '11111111-1111-1111-1111-111111111111',
    created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: 'submitted',
    priority: 'critical',
    location_lat: 28.535516,
    location_lng: 77.391026,
    location_address: 'Plant Sector B - Heavy Machinery Bay 4 (Press Station #4)',
    image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
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
        note: 'Reported by shift operator with machine photo and GPS fix',
        created_at: '2026-10-07T14:30:00.000Z',
        changer: { full_name: 'Alex Rivera (Plant Shift Operator)' },
      },
    ],
  },
  {
    id: 'c1111111-0002-0000-0000-000000000002',
    title: '415V MCC Switchgear Feeder Breaker Tripping on Overcurrent',
    description: 'Main 415V feeder breaker for Cooling Water Pump #2 tripped twice under 160A load. Thermal scan indicates 84C hot spot on terminal L2 busbar connector. Potential arc flash hazard if re-energized without inspection.',
    category_id: 'b1111111-1111-1111-1111-111111111111',
    department_id: '22222222-2222-2222-2222-222222222222',
    created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: 'under_review',
    priority: 'high',
    location_lat: 28.536120,
    location_lng: 77.392410,
    location_address: 'Substation Switchgear Room 2 - Feeder Panel MCC-B',
    image_url: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=800&q=80',
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
        note: 'Initial report filed after secondary breaker trip',
        created_at: '2026-10-06T10:00:00.000Z',
        changer: { full_name: 'Alex Rivera (Plant Shift Operator)' },
      },
      {
        id: 'h2b',
        complaint_id: 'c1111111-0002-0000-0000-000000000002',
        from_status: 'submitted',
        to_status: 'under_review',
        changed_by: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        note: 'Reviewing busbar thermal imaging scan and load curves',
        created_at: '2026-10-06T11:20:00.000Z',
        changer: { full_name: 'Marcus Vance (Plant Operations Director)' },
      },
    ],
  },
  {
    id: 'c1111111-0003-0000-0000-000000000003',
    title: '12-Bar Steam Header Flange Gasket Failure in Boiler House',
    description: 'Superheated 12-bar steam escaping from 8-inch main header flange connection adjacent to deaerator tank. Hissing sound with visible high-velocity steam envelope. Sector isolated under LOTO lock.',
    category_id: 'd1111111-1111-1111-1111-111111111111',
    department_id: '44444444-4444-4444-4444-444444444444',
    created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: 'resolved',
    priority: 'critical',
    location_lat: 28.534890,
    location_lng: 77.389950,
    location_address: 'Boiler House Unit 1 - Mezzanine Level Header Joint #7',
    image_url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=800&q=80',
    created_at: '2026-10-05T09:00:00.000Z',
    updated_at: '2026-10-05T16:00:00.000Z',
    resolved_at: '2026-10-05T16:00:00.000Z',
    version: 4,
    assigned_to: { id: 'wwwwwwww-2222-2222-2222-222222222222', full_name: 'Ravi Kumar (Boiler & Utilities Specialist)' },
    status_history: [
      {
        id: 'h3a',
        complaint_id: 'c1111111-0003-0000-0000-000000000003',
        from_status: null,
        to_status: 'submitted',
        changed_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        note: 'Emergency steam leak logged with plant geotag',
        created_at: '2026-10-05T09:00:00.000Z',
        changer: { full_name: 'Alex Rivera (Plant Shift Operator)' },
      },
      {
        id: 'h3b',
        complaint_id: 'c1111111-0003-0000-0000-000000000003',
        from_status: 'submitted',
        to_status: 'under_review',
        changed_by: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        note: 'Emergency triage: LOTO tag out initiated',
        created_at: '2026-10-05T09:15:00.000Z',
        changer: { full_name: 'Marcus Vance (Plant Operations Director)' },
      },
      {
        id: 'h3c',
        complaint_id: 'c1111111-0003-0000-0000-000000000003',
        from_status: 'under_review',
        to_status: 'in_progress',
        changed_by: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        note: 'Utilities crew on-site with replacement spiral wound gasket',
        created_at: '2026-10-05T11:00:00.000Z',
        changer: { full_name: 'Marcus Vance (Plant Operations Director)' },
      },
      {
        id: 'h3d',
        complaint_id: 'c1111111-0003-0000-0000-000000000003',
        from_status: 'in_progress',
        to_status: 'resolved',
        changed_by: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        note: 'Flange repacked with high-temp graphite gasket, torqued to 350 Nm, and hydro-tested at 16 bar. Zero leakage.',
        created_at: '2026-10-05T16:00:00.000Z',
        changer: { full_name: 'Marcus Vance (Plant Operations Director)' },
      },
    ],
  },
  {
    id: 'c1111111-0004-0000-0000-000000000004',
    title: 'Raw Material Conveyor Belt #3 Drive Bearing Acoustic Vibration Exceeded',
    description: 'Acoustic vibration monitor triggered continuous 7.8 mm/s RMS alarm on drive-end spherical roller bearing. Grease temperature reached 76C. Requires immediate lubrication repacking or bearing changeover before catastrophic seizure.',
    category_id: 'a2222222-2222-2222-2222-222222222222',
    department_id: '11111111-1111-1111-1111-111111111111',
    created_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    status: 'in_progress',
    priority: 'high',
    location_lat: 28.537250,
    location_lng: 77.393180,
    location_address: 'Sector C - Bulk Handling Conveyor Gallery #3 (Head Pulley Drive)',
    image_url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80',
    created_at: '2026-10-07T08:00:00.000Z',
    updated_at: '2026-10-07T11:00:00.000Z',
    resolved_at: null,
    version: 3,
    assigned_to: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', full_name: 'Marcus Vance (Plant Operations Director)' },
    status_history: [
      {
        id: 'h4a',
        complaint_id: 'c1111111-0004-0000-0000-000000000004',
        from_status: null,
        to_status: 'submitted',
        changed_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        note: 'Vibration alert logged from telemetry feed',
        created_at: '2026-10-07T08:00:00.000Z',
        changer: { full_name: 'Alex Rivera (Plant Shift Operator)' },
      },
      {
        id: 'h4b',
        complaint_id: 'c1111111-0004-0000-0000-000000000004',
        from_status: 'submitted',
        to_status: 'in_progress',
        changed_by: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        note: 'Mechanical fitters dispatched to measure bearing clearances and replenish synthetic grease',
        created_at: '2026-10-07T11:00:00.000Z',
        changer: { full_name: 'Marcus Vance (Plant Operations Director)' },
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
      body: 'Pressure gauge dropped to 60 bar twice during stamping cycle. We have halted Press #4 to prevent cylinder scoring.',
      is_internal: false,
      created_at: '2026-10-07T14:35:00.000Z',
      updated_at: '2026-10-07T14:35:00.000Z',
      author: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', full_name: 'Alex Rivera (Plant Shift Operator)', avatar_url: null },
    },
    {
      id: 'comm2',
      complaint_id: 'c1111111-0001-0000-0000-000000000001',
      author_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      body: 'INTERNAL NOTE: Mechanical hydraulics team notified. Issued LOTO lockout permit for Sector B Bay 4.',
      is_internal: true,
      created_at: '2026-10-07T15:00:00.000Z',
      updated_at: '2026-10-07T15:00:00.000Z',
      author: { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', full_name: 'Marcus Vance (Plant Operations Director)', avatar_url: null },
    },
  ],
};

const INITIAL_ATTACHMENTS: Record<string, any[]> = {
  'c1111111-0001-0000-0000-000000000001': [
    {
      id: 'att1',
      complaint_id: 'c1111111-0001-0000-0000-000000000001',
      uploaded_by: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      file_name: 'hydraulic_cylinder_pressure_drop_log.csv',
      file_size: 14200,
      mime_type: 'text/csv',
      storage_path: 'mock/hydraulic_cylinder_pressure_drop_log.csv',
      created_at: '2026-10-07T14:32:00.000Z',
      uploader: { full_name: 'Alex Rivera (Plant Shift Operator)' },
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
    title: 'Plant Incident Resolved',
    body: 'Incident "12-Bar Steam Header Flange Gasket Failure in Boiler House" has been marked resolved.',
    is_read: false,
    created_at: '2026-10-05T16:00:00.000Z',
  },
  {
    id: 'n2',
    user_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    complaint_id: 'c1111111-0001-0000-0000-000000000001',
    type: 'status_changed',
    title: 'New Plant Incident Filed',
    body: 'CRITICAL Plant Incident: 500-Ton Hydraulic Press Primary Cylinder Pressure Loss in Bay 4.',
    is_read: false,
    created_at: '2026-10-07T14:30:00.000Z',
  },
];

const INITIAL_AUDIT_LOGS = [
  {
    id: 'aud-1',
    actor: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    action: 'UPDATE',
    table_name: 'complaints',
    row_id: 'c1111111-0003-0000-0000-000000000003',
    old_data: { status: 'in_progress', version: 3 },
    new_data: { status: 'resolved', version: 4 },
    created_at: '2026-10-05T16:00:00.000Z',
    actor_profile: { full_name: 'Marcus Vance (Plant Operations Director)', role: 'admin' },
  },
  {
    id: 'aud-2',
    actor: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    action: 'INSERT',
    table_name: 'complaints',
    row_id: 'c1111111-0001-0000-0000-000000000001',
    old_data: null,
    new_data: { status: 'submitted', title: '500-Ton Hydraulic Press Primary Cylinder Pressure Loss', version: 1 },
    created_at: '2026-10-07T14:30:00.000Z',
    actor_profile: { full_name: 'Alex Rivera (Plant Shift Operator)', role: 'employee' },
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

    // RLS emulation: employees see only their own complaints; admins see all
    if (currentProfile?.role === 'employee') {
      list = list.filter((c) => c.created_by === currentProfile.id);
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
        full_name: 'Alex Rivera (Plant Shift Operator)',
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
      changed_by: currentProfile?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc',
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
    comp.updated_at = new Date().toISOString();

    const oldStatus = comp.status;
    if (comp.status === 'submitted' || comp.status === 'under_review') {
      comp.status = 'assigned';
      comp.version += 1;
    }

    comp.status_history = comp.status_history || [];
    comp.status_history.push({
      id: crypto.randomUUID(),
      complaint_id: id,
      from_status: oldStatus,
      to_status: comp.status,
      changed_by: currentProfile?.id || 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      note: data.note || `Assigned to ${assignee?.full_name || 'worker'}`,
      created_at: new Date().toISOString(),
      changer: { full_name: currentProfile?.full_name || 'Admin' },
    });

    // Notify employee of worker assignment
    this.notifications.unshift({
      id: crypto.randomUUID(),
      user_id: comp.created_by,
      complaint_id: id,
      type: 'assigned',
      title: 'Worker Assigned',
      body: `${assignee?.full_name || 'A technician'} has been assigned to work on "${comp.title}".`,
      is_read: false,
      created_at: new Date().toISOString(),
    });

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

