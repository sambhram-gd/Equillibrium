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
import { SharedLedger, SharedTransaction } from '../types';

const LEDGER_KEY_PREFIX = 'eq_ledger_';
const TXS_KEY_PREFIX = 'eq_txs_';

export function getLedgerId(
  uid1: string,
  uid2?: string,
  email1?: string | null,
  email2?: string | null
): string {
  if (email1 && email2 && email1.trim() && email2.trim()) {
    const cleanE1 = email1.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    const cleanE2 = email2.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    const sorted = [cleanE1, cleanE2].sort();
    return `ledger_${sorted[0]}___${sorted[1]}`;
  }
  return [uid1, uid2 || 'partner'].sort().join('_');
}

export function getLocalLedger(ledgerId: string): SharedLedger | null {
  try {
    const raw = localStorage.getItem(LEDGER_KEY_PREFIX + ledgerId);
    if (raw) return JSON.parse(raw) as SharedLedger;
  } catch (e) {
    console.warn('Failed to parse local ledger', e);
  }
  return null;
}

export function saveLocalLedger(ledger: SharedLedger): void {
  try {
    if (ledger.id) {
      localStorage.setItem(LEDGER_KEY_PREFIX + ledger.id, JSON.stringify(ledger));
      window.dispatchEvent(new CustomEvent('eq_ledger_updated', { detail: ledger }));
    }
  } catch (e) {
    console.warn('Failed to save local ledger', e);
  }
}

export function getLocalTransactions(ledgerId: string): SharedTransaction[] {
  try {
    const raw = localStorage.getItem(TXS_KEY_PREFIX + ledgerId);
    if (raw) return JSON.parse(raw) as SharedTransaction[];
  } catch (e) {
    console.warn('Failed to parse local transactions', e);
  }
  return [];
}

export function saveLocalTransactions(ledgerId: string, txs: SharedTransaction[]): void {
  try {
    localStorage.setItem(TXS_KEY_PREFIX + ledgerId, JSON.stringify(txs));
    window.dispatchEvent(
      new CustomEvent('eq_txs_updated', {
        detail: { ledgerId, transactions: txs },
      })
    );
  } catch (e) {
    console.warn('Failed to save local transactions', e);
  }
}

export function listenToSharedLedger(
  ledgerId: string,
  callback: (ledger: SharedLedger | null) => void
): () => void {
  // 1. Immediately emit local cached ledger
  const initial = getLocalLedger(ledgerId);
  callback(initial);

  // 2. Listen to local ledger updates
  const handleLedgerUpdate = (e: Event) => {
    const custom = e as CustomEvent<SharedLedger>;
    if (custom.detail && custom.detail.id === ledgerId) {
      callback(custom.detail);
    }
  };
  window.addEventListener('eq_ledger_updated', handleLedgerUpdate);

  // 3. Listen to Firestore in background
  const path = `shared_ledgers/${ledgerId}`;
  let unsubscribeFirestore = () => {};

  try {
    unsubscribeFirestore = onSnapshot(
      doc(db, 'shared_ledgers', ledgerId),
      (snap) => {
        if (snap.exists()) {
          const remoteLedger: SharedLedger = {
            id: snap.id,
            ...(snap.data() as Omit<SharedLedger, 'id'>),
          };
          saveLocalLedger(remoteLedger);
          callback(remoteLedger);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        callback(getLocalLedger(ledgerId));
      }
    );
  } catch (err) {
    console.warn('Firestore ledger listener setup deferred:', err);
  }

  return () => {
    window.removeEventListener('eq_ledger_updated', handleLedgerUpdate);
    unsubscribeFirestore();
  };
}

export function listenToSharedTransactions(
  ledgerId: string,
  callback: (transactions: SharedTransaction[]) => void
): () => void {
  // 1. Emit local cached transactions immediately
  const initial = getLocalTransactions(ledgerId);
  callback(initial);

  // 2. Listen to local transaction updates
  const handleTxsUpdate = (e: Event) => {
    const custom = e as CustomEvent<{ ledgerId: string; transactions: SharedTransaction[] }>;
    if (custom.detail && custom.detail.ledgerId === ledgerId) {
      callback(custom.detail.transactions);
    }
  };
  window.addEventListener('eq_txs_updated', handleTxsUpdate);

  // 3. Listen to Firestore in background
  const path = `shared_ledgers/${ledgerId}/transactions`;
  let unsubscribeFirestore = () => {};

  try {
    const q = query(
      collection(db, 'shared_ledgers', ledgerId, 'transactions'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        const remoteTxs: SharedTransaction[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as Omit<SharedTransaction, 'id'>),
        }));

        if (remoteTxs.length > 0) {
          const currentLocal = getLocalTransactions(ledgerId);
          const localMap = new Map(currentLocal.map((t) => [t.id || t.timestamp, t]));
          remoteTxs.forEach((rt) => {
            localMap.set(rt.id || rt.timestamp, rt);
          });
          const merged = Array.from(localMap.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          saveLocalTransactions(ledgerId, merged);
          callback(merged);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, path);
        callback(getLocalTransactions(ledgerId));
      }
    );
  } catch (err) {
    console.warn('Firestore transactions setup deferred:', err);
  }

  return () => {
    window.removeEventListener('eq_txs_updated', handleTxsUpdate);
    unsubscribeFirestore();
  };
}

export async function addSharedTransaction(
  ledgerId: string,
  transactionData: Omit<SharedTransaction, 'id'>,
  memberUids?: [string, string]
): Promise<string> {
  const newTxId = 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const fullTx: SharedTransaction = {
    id: newTxId,
    ...transactionData,
  };

  // 1. Update local transactions
  const currentTxs = getLocalTransactions(ledgerId);
  const updatedTxs = [fullTx, ...currentTxs];
  saveLocalTransactions(ledgerId, updatedTxs);

  // 2. Update local ledger balance
  let currentLedger = getLocalLedger(ledgerId);
  let members: string[] = [];
  if (currentLedger?.members && currentLedger.members.length === 2) {
    members = currentLedger.members;
  } else if (memberUids && memberUids.length === 2) {
    members = [...memberUids].sort();
  } else {
    members = [fullTx.paidBy, 'partner'];
  }

  const user1 = currentLedger?.user1 || members[0] || '';
  const user2 = currentLedger?.user2 || members[1] || '';

  if (!currentLedger) {
    currentLedger = {
      id: ledgerId,
      members,
      user1,
      user2,
      user1Name: user1 === fullTx.paidBy ? fullTx.paidByName : 'Roommate',
      user2Name: user2 === fullTx.paidBy ? fullTx.paidByName : 'Roommate',
      netBalance: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  const isUser1Payer =
    fullTx.paidBy === currentLedger.user1 ||
    (currentLedger.user1Name && fullTx.paidByName === currentLedger.user1Name);

  const balanceDelta = isUser1Payer
    ? fullTx.splitAmountOther
    : -fullTx.splitAmountOther;
  const newNetBalance = (currentLedger.netBalance || 0) + balanceDelta;

  const updatedLedger: SharedLedger = {
    ...currentLedger,
    members,
    netBalance: newNetBalance,
    lastUpdated: new Date().toISOString(),
  };
  saveLocalLedger(updatedLedger);

  // 3. Sync to Firestore in background: Save ledger FIRST so document exists
  try {
    const ledgerRef = doc(db, 'shared_ledgers', ledgerId);
    const txRef = doc(db, 'shared_ledgers', ledgerId, 'transactions', newTxId);

    await setDoc(ledgerRef, updatedLedger, { merge: true });
    await setDoc(txRef, fullTx, { merge: true });
  } catch (err) {
    console.warn('Firestore shared transaction sync deferred:', err);
  }

  return newTxId;
}

export async function settleUpLedger(
  ledgerId: string,
  payerUid: string,
  payerName: string,
  amountToClear: number
): Promise<void> {
  const currentLedger = getLocalLedger(ledgerId);
  const now = new Date().toISOString();

  const settleTx: SharedTransaction = {
    id: 'settle_' + Date.now(),
    paidBy: payerUid,
    paidByName: payerName,
    totalAmount: amountToClear,
    splitAmountOther: 0,
    category: 'Settlement',
    description: `Zero-sum settlement cleared balance to ₹0`,
    timestamp: now,
    isSettlement: true,
  };

  const currentTxs = getLocalTransactions(ledgerId);
  saveLocalTransactions(ledgerId, [settleTx, ...currentTxs]);

  if (currentLedger) {
    const settledLedger: SharedLedger = {
      ...currentLedger,
      netBalance: 0,
      lastUpdated: now,
    };
    saveLocalLedger(settledLedger);

    try {
      const ledgerRef = doc(db, 'shared_ledgers', ledgerId);
      const txRef = doc(db, 'shared_ledgers', ledgerId, 'transactions', settleTx.id!);
      await setDoc(ledgerRef, { netBalance: 0, lastUpdated: now }, { merge: true });
      await setDoc(txRef, settleTx, { merge: true });
    } catch (err) {
      console.warn('Firestore settle sync deferred:', err);
    }
  }
}

export const settleSharedLedger = settleUpLedger;
