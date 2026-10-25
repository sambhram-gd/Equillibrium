export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  partnerUid?: string;
  partnerEmail?: string;
  partnerName?: string;
  currentBalance: number; // initial liquid balance
  monthlyBudget: number;
  salaryAmount: number;
  salaryDate: string;
  pairCode: string;
  createdAt: string;
}

export type PersonalLogCategory =
  | 'Coffee'
  | 'Breakfast'
  | 'Metro'
  | 'Bus'
  | 'Lunch'
  | 'Dinner'
  | 'Groceries'
  | 'Utilities'
  | 'Misc';

export interface PersonalLog {
  id?: string;
  amount: number;
  category: PersonalLogCategory | string;
  type: 'debit' | 'credit';
  timestamp: string; // ISO string
  note?: string;
}

export interface SharedLedger {
  id?: string;
  members: string[]; // [user1Uid, user2Uid] (alphabetically sorted)
  user1: string;
  user2: string;
  user1Name?: string;
  user2Name?: string;
  netBalance: number; // Cumulative: > 0 means user1 is owed; < 0 means user2 is owed; 0 means settled
  lastUpdated: string;
}

export interface SharedTransaction {
  id?: string;
  paidBy: string; // UID
  paidByName: string;
  totalAmount: number;
  splitAmountOther: number; // what the other member owes for this transaction
  category: string;
  description: string;
  timestamp: string;
  isSettlement?: boolean;
}

export interface PairingCodeDoc {
  uid: string;
  displayName: string;
  email: string;
  pairCode: string;
  createdAt: string;
}

export type TabType = 'personal-space' | 'shared-ledger' | 'partner-view';
