import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SharedLedger, SharedTransaction } from '../types';

export function getLedgerId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export function listenToSharedLedger(
  ledgerId: string,
  callback: (ledger: SharedLedger | null) => void
): () => void {
  const path = `shared_ledgers/${ledgerId}`;
  return onSnapshot(
    doc(db, 'shared_ledgers', ledgerId),
    (snap) => {
      if (snap.exists()) {
        callback({
          id: snap.id,
          ...(snap.data() as Omit<SharedLedger, 'id'>),
        });
      } else {
        callback(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function listenToSharedTransactions(
  ledgerId: string,
  callback: (transactions: SharedTransaction[]) => void
): () => void {
  const path = `shared_ledgers/${ledgerId}/transactions`;
  const q = query(
    collection(db, 'shared_ledgers', ledgerId, 'transactions'),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const txs: SharedTransaction[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<SharedTransaction, 'id'>),
      }));
      callback(txs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function addSharedTransaction(
  ledgerId: string,
  transactionData: Omit<SharedTransaction, 'id'>
): Promise<string> {
  const ledgerRef = doc(db, 'shared_ledgers', ledgerId);
  const txColRef = collection(db, 'shared_ledgers', ledgerId, 'transactions');
  const path = `shared_ledgers/${ledgerId}/transactions`;

  try {
    let newTxId = '';
    await runTransaction(db, async (tx) => {
      const ledgerSnap = await tx.get(ledgerRef);
      if (!ledgerSnap.exists()) {
        throw new Error('Shared ledger does not exist');
      }

      const ledger = ledgerSnap.data() as SharedLedger;
      const currentNetBalance = ledger.netBalance ?? 0;

      // Net balance calculation:
      // user1 is lower UID, user2 is higher UID.
      // netBalance > 0: user1 is owed by user2
      // netBalance < 0: user2 is owed by user1
      // If user1 paid, user2 owes splitAmountOther -> netBalance += splitAmountOther
      // If user2 paid, user1 owes splitAmountOther -> netBalance -= splitAmountOther
      let balanceDelta = 0;
      if (transactionData.paidBy === ledger.user1) {
        balanceDelta = transactionData.splitAmountOther;
      } else {
        balanceDelta = -transactionData.splitAmountOther;
      }

      const newNetBalance = currentNetBalance + balanceDelta;

      const newTxRef = doc(txColRef);
      newTxId = newTxRef.id;
      tx.set(newTxRef, transactionData);

      tx.update(ledgerRef, {
        netBalance: newNetBalance,
        lastUpdated: new Date().toISOString(),
      });
    });

    return newTxId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function settleUpLedger(
  ledgerId: string,
  payerUid: string,
  payerName: string,
  settlementAmount: number
): Promise<string> {
  const ledgerRef = doc(db, 'shared_ledgers', ledgerId);
  const txColRef = collection(db, 'shared_ledgers', ledgerId, 'transactions');
  const path = `shared_ledgers/${ledgerId}/transactions`;

  try {
    let newTxId = '';
    await runTransaction(db, async (tx) => {
      const ledgerSnap = await tx.get(ledgerRef);
      if (!ledgerSnap.exists()) {
        throw new Error('Shared ledger does not exist');
      }

      const settlementTx: Omit<SharedTransaction, 'id'> = {
        paidBy: payerUid,
        paidByName: payerName,
        totalAmount: settlementAmount,
        splitAmountOther: settlementAmount,
        category: 'Settlement',
        description: 'Bilateral Balance Cleared (All Settled)',
        timestamp: new Date().toISOString(),
        isSettlement: true,
      };

      const newTxRef = doc(txColRef);
      newTxId = newTxRef.id;
      tx.set(newTxRef, settlementTx);

      // Reset net balance to exactly zero
      tx.update(ledgerRef, {
        netBalance: 0,
        lastUpdated: new Date().toISOString(),
      });
    });

    return newTxId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
