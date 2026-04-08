import { Timestamp } from 'firebase/firestore';

// User roles
export type UserRole = 'admin' | 'editor' | 'viewer' | 'pending';

// Multi-tenant user
export interface AppUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: UserRole;
  orgId: string | null;  // null = unassigned
  pinHash: string | null;
  pinSet: boolean;
  createdAt: Timestamp | Date;
  lastLogin: Timestamp | Date;
}

// Organization/Tenant
export interface Organization {
  id: string;
  name: string;
  adminEmail?: string | null;
  status: 'active' | 'suspended';
  inviteCode?: string;
  createdAt: Timestamp | Date;
  createdBy?: string;
  createdByEmail?: string;
}

// Bank account / entity
export interface BankAccount {
  id: string;
  orgId: string;
  accountName: string;
  bankName: string;
  accountNumber?: string;
  currency: string;
  openingBalance: number;
  createdAt: Timestamp | Date;
}

// Transaction
export interface Transaction {
  id: string;
  orgId: string;
  accountId: string;
  date: string; // YYYY-MM-DD
  description: string;
  category?: string;
  credit: number | null;
  debit: number | null;
  balance?: number | null;
  sourcePdf?: string;
  createdAt?: Timestamp | Date;
}

// Org settings (backend URL, etc.)
export interface OrgSettings {
  orgId: string;
  backendUrl?: string;
}

// EMI / Loan tracker
export interface EMILoan {
  id?: string;
  orgId: string;
  truckNo: string;        // Loan ID / Truck No / Asset ID
  make: string;
  model: string;
  year: number;
  owner: string;
  financier: string;
  loanAmount: number;
  loanTenure: number;     // months
  emiStartDate: string;   // YYYY-MM-DD
  emiDayOfMonth: number;
  emiAmount: number;
  emisPaid: number;
  remainingEmis: number;
  emiEndDate: string;     // YYYY-MM-DD
  debitedAccount: string; // accountId (ref to bankAccounts)
  loanCategory?: string;
}

// User activity log
export interface UserLog {
  id: string;
  orgId: string;
  userId: string;
  userEmail: string;
  action: string;
  details?: string;
  timestamp: Timestamp | Date;
}
