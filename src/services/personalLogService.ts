import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PersonalLog } from '../types';

export function listenToPersonalLogs(
  userId: string,
  callback: (logs: PersonalLog[]) => void
): () => void {
  const path = `users/${userId}/personal_logs`;
  const q = query(
    collection(db, 'users', userId, 'personal_logs'),
    orderBy('timestamp', 'desc'),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: PersonalLog[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<PersonalLog, 'id'>),
      }));
      callback(logs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function addPersonalLog(
  userId: string,
  log: Omit<PersonalLog, 'id'>
): Promise<string> {
  const userRef = doc(db, 'users', userId);
  const logsColRef = collection(db, 'users', userId, 'personal_logs');
  const path = `users/${userId}/personal_logs`;

  try {
    let newLogId = '';
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User profile does not exist');
      }

      const userData = userSnap.data();
      const currentBalance = userData.currentBalance ?? 0;

      // Calculate new balance
      const balanceDelta = log.type === 'debit' ? -log.amount : log.amount;
      const updatedBalance = currentBalance + balanceDelta;

      // Add log
      const newLogRef = doc(logsColRef);
      newLogId = newLogRef.id;
      transaction.set(newLogRef, log);

      // Update user liquid balance
      transaction.update(userRef, {
        currentBalance: updatedBalance,
      });
    });

    return newLogId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePersonalLog(
  userId: string,
  logId: string,
  log: PersonalLog
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  const logRef = doc(db, 'users', userId, 'personal_logs', logId);
  const path = `users/${userId}/personal_logs/${logId}`;

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) {
        throw new Error('User does not exist');
      }
      const userData = userSnap.data();
      const currentBalance = userData.currentBalance ?? 0;

      // Revert balance change
      const revertDelta = log.type === 'debit' ? log.amount : -log.amount;
      transaction.delete(logRef);
      transaction.update(userRef, {
        currentBalance: currentBalance + revertDelta,
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
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
