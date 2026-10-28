import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PersonalLog } from '../types';
import { getLocalProfile, updateUserProfile } from './userService';

const LOGS_STORAGE_KEY_PREFIX = 'eq_personal_logs_';

export function getLocalPersonalLogs(userId: string): PersonalLog[] {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY_PREFIX + userId);
    if (raw) {
      return JSON.parse(raw) as PersonalLog[];
    }
  } catch (e) {
    console.warn('Failed to parse local personal logs', e);
  }
  return [];
}

export function saveLocalPersonalLogs(userId: string, logs: PersonalLog[]): void {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY_PREFIX + userId, JSON.stringify(logs));
    window.dispatchEvent(
      new CustomEvent('eq_logs_updated', {
        detail: { userId, logs },
      })
    );
  } catch (e) {
    console.warn('Failed to save personal logs to localStorage', e);
  }
}

export function listenToPersonalLogs(
  userId: string,
  callback: (logs: PersonalLog[]) => void
): () => void {
  // 1. Immediately emit logs from localStorage
  const localLogs = getLocalPersonalLogs(userId);
  callback(localLogs);

  // 2. Listen for local log update events
  const handleLogsUpdate = (e: Event) => {
    const custom = e as CustomEvent<{ userId: string; logs: PersonalLog[] }>;
    if (custom.detail && custom.detail.userId === userId) {
      callback(custom.detail.logs);
    }
  };
  window.addEventListener('eq_logs_updated', handleLogsUpdate);

  // 3. Listen to Firestore in background
  const path = `users/${userId}/personal_logs`;
  let unsubscribeFirestore = () => {};

  try {
    const q = query(
      collection(db, 'users', userId, 'personal_logs'),
      orderBy('timestamp', 'desc'),
      limit(100)
    );

    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const remoteLogs: PersonalLog[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<PersonalLog, 'id'>),
        }));

        if (remoteLogs.length > 0) {
          // Merge remote with local to avoid losing any offline items
          const currentLocal = getLocalPersonalLogs(userId);
          const localMap = new Map(currentLocal.map((l) => [l.id || l.timestamp, l]));
          remoteLogs.forEach((rl) => {
            localMap.set(rl.id || rl.timestamp, rl);
          });
          const merged = Array.from(localMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          saveLocalPersonalLogs(userId, merged);
          callback(merged);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        // On error, fall back cleanly to local logs
        callback(getLocalPersonalLogs(userId));
      }
    );
  } catch (err) {
    console.warn('Firestore personal logs setup skipped/failed:', err);
  }

  return () => {
    window.removeEventListener('eq_logs_updated', handleLogsUpdate);
    unsubscribeFirestore();
  };
}

export async function addPersonalLog(
  userId: string,
  log: Omit<PersonalLog, 'id'>
): Promise<string> {
  const newLogId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const fullLog: PersonalLog = {
    id: newLogId,
    ...log,
  };

  // 1. Get current local state and calculate new balance
  const currentLogs = getLocalPersonalLogs(userId);
  const updatedLogs = [fullLog, ...currentLogs];
  saveLocalPersonalLogs(userId, updatedLogs);

  const currentProfile = getLocalProfile(userId);
  const currentBalance = currentProfile?.currentBalance ?? 0;
  const balanceDelta = log.type === 'debit' ? -log.amount : log.amount;
  const updatedBalance = currentBalance + balanceDelta;

  // Update profile balance locally & broadcast
  await updateUserProfile(userId, {
    currentBalance: updatedBalance,
  });

  // 2. Sync to Firestore in background with setDoc (resilient against offline or missing docs)
  try {
    const userRef = doc(db, 'users', userId);
    const logRef = doc(db, 'users', userId, 'personal_logs', newLogId);

    // Save log
    await setDoc(logRef, fullLog, { merge: true });
    // Update balance on user doc
    await setDoc(userRef, { currentBalance: updatedBalance }, { merge: true });
  } catch (err) {
    console.warn('Firestore personal log background sync deferred:', err);
  }

  return newLogId;
}

export async function deletePersonalLog(
  userId: string,
  logId: string,
  log: PersonalLog
): Promise<void> {
  // 1. Remove from local storage
  const currentLogs = getLocalPersonalLogs(userId);
  const updatedLogs = currentLogs.filter((l) => l.id !== logId);
  saveLocalPersonalLogs(userId, updatedLogs);

  // 2. Revert balance
  const currentProfile = getLocalProfile(userId);
  const currentBalance = currentProfile?.currentBalance ?? 0;
  const revertDelta = log.type === 'debit' ? log.amount : -log.amount;
  const updatedBalance = currentBalance + revertDelta;

  await updateUserProfile(userId, {
    currentBalance: updatedBalance,
  });

  // 3. Delete from Firestore in background
  try {
    const logRef = doc(db, 'users', userId, 'personal_logs', logId);
    await deleteDoc(logRef);
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { currentBalance: updatedBalance }, { merge: true });
  } catch (err) {
    console.warn('Firestore personal log delete deferred:', err);
  }
}

export function filterLogsByPeriod(
  logs: PersonalLog[],
  period: 'today' | 'week' | 'month' | 'all'
): PersonalLog[] {
  if (period === 'all') return logs;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return logs.filter((log) => {
    const logTime = new Date(log.timestamp).getTime();
    if (period === 'today') {
      return logTime >= startOfDay;
    }
    if (period === 'week') {
      const startOfWeek = startOfDay - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;
      return logTime >= startOfWeek;
    }
    if (period === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return logTime >= startOfMonth;
    }
    return true;
  });
}

export function calculateMonthlySpend(logs: PersonalLog[]): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  return logs.reduce((total, log) => {
    const logTime = new Date(log.timestamp).getTime();
    if (logTime >= startOfMonth && log.type === 'debit') {
      return total + log.amount;
    }
    return total;
  }, 0);
}
