export type UserRole = 'HEAD' | 'MANAGER' | 'CLIENT' | 'WORKER';

export interface Project {
  id: string;
  projectName: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  clientNotes?: string;
  location: string;
  estimatedCost: number;
  budget: number;
  currentSpend: number;
  managerIds: string[];
  workerIds: string[]; // References to global workers
  timeline: TimelinePhase[];
  isComplete: boolean;
  createdAt: any; // Timestamp
  completionPercentage: number;
  rooms: Room[]; // New: Rooms associated with the project
}

export interface Room {
  id: string;
  name: string;
  type: string; // e.g., 'Living Room', 'Kitchen', 'Bedroom'
  assignedWorkerIds: string[]; // IDs of workers assigned to this room
  // Potentially add categories later if needed here, or keep them at update level
}

export interface TimelinePhase {
  id: string;
  name: string;
  startDate?: string;
  targetDate: string; // ISO Date string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface ProjectUpdate {
  id: string;
  timestamp: any; // Firestore Timestamp
  postedBy: string; // Name
  role: UserRole;
  type: 'message' | 'photo' | 'video';
  category?: string; // 'Painting', 'Electrical', etc.
  content: string; // Text or URL
  isClientViewable: boolean;
  progressPercentage?: number;
  comments: Comment[];
  associatedWorkerIds?: string[];
  roomId?: string; // New: Optional Room ID for updates
}

export interface DesignDocument {
  id: string;
  projectId: string;
  title: string;
  type: '2D Plan' | '3D Render';
  url: string;
  postedBy: string;
  timestamp: any;
  approvalStatus: {
    required: boolean;
    approved: boolean;
    approvedBy?: string;
    timestamp?: any;
    rejected?: boolean;
    feedback?: string;
  };
}

export interface Settlement {
  id: string;
  projectId: string;
  paidToType: 'Worker' | 'Shop' | 'Vendor';
  paidToName: string; // Name of worker/shop
  amount: number;
  mode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
  date: string; // ISO date
  description: string;
  screenshotUrl?: string;
  createdBy: string; // Head ID
  createdAt: any;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: any;
}

export interface Manager {
  id: string; // MGR...
  name: string;
  passwordHash: string;
  assignedProjects: string[]; // Project IDs
}

export interface Worker {
  id: string;
  name: string;
  role: string; // Carpenter, Painter, etc.
  phone: string;
  type: 'Daily' | 'Contract';
  notes?: string;
  assignedProjects?: string[]; // Project IDs
}

declare global {
  interface Window {
    __app_id?: string;
    __firebase_config?: any;
    __initial_auth_token?: string;
  }
}