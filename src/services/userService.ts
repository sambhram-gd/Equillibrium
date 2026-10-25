import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, PairingCodeDoc, SharedLedger } from '../types';

export function generatePairCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'EQ-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function listenToUserProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void
): () => void {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data() as UserProfile);
      } else {
        callback(null);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), profile);

    // Also register pairCode lookup document
    if (profile.pairCode) {
      const codePath = `pairing_codes/${profile.pairCode}`;
      const codeDoc: PairingCodeDoc = {
        uid: profile.uid,
        displayName: profile.displayName,
        email: profile.email,
        pairCode: profile.pairCode,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'pairing_codes', profile.pairCode), codeDoc);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function pairWithRoommate(
  currentUser: UserProfile,
  targetCodeOrEmail: string
): Promise<{ success: boolean; partnerProfile?: UserProfile; message?: string }> {
  const cleanInput = targetCodeOrEmail.trim();
  if (!cleanInput) {
    return { success: false, message: 'Please enter a valid pair code or email.' };
  }

  let partnerUid: string | null = null;
  let partnerData: UserProfile | null = null;

  // 1. Try checking pair code collection first
  try {
    const codeSnap = await getDoc(doc(db, 'pairing_codes', cleanInput.toUpperCase()));
    if (codeSnap.exists()) {
      const pCode = codeSnap.data() as PairingCodeDoc;
      partnerUid = pCode.uid;
    }
  } catch (err) {
    console.warn('Pair code lookup failed, trying email query', err);
  }

  // 2. If not found by code, try by email query
  if (!partnerUid) {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanInput.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        partnerUid = snap.docs[0].id;
        partnerData = snap.docs[0].data() as UserProfile;
      }
    } catch (err) {
      console.warn('Email query failed', err);
    }
  }

  if (!partnerUid) {
    return {
      success: false,
      message: `No user found with "${cleanInput}". Make sure your roommate has created an Equilibrium account and shared their code.`,
    };
  }

  if (partnerUid === currentUser.uid) {
    return { success: false, message: 'You cannot pair with yourself.' };
  }

  // Fetch partner profile if not yet fetched
  if (!partnerData) {
    partnerData = await getUserProfile(partnerUid);
  }

  if (!partnerData) {
    return { success: false, message: 'Partner profile could not be loaded.' };
  }

  // Link both users
  try {
    // Deterministic ledger ID based on sorted UIDs
    const members = [currentUser.uid, partnerUid].sort();
    const ledgerId = members.join('_');
    const user1 = members[0];
    const user2 = members[1];
    const user1Name = user1 === currentUser.uid ? currentUser.displayName : partnerData.displayName;
    const user2Name = user2 === currentUser.uid ? currentUser.displayName : partnerData.displayName;

    // Create or ensure shared ledger exists
    const ledgerRef = doc(db, 'shared_ledgers', ledgerId);
    const existingLedger = await getDoc(ledgerRef);
    if (!existingLedger.exists()) {
      const initialLedger: SharedLedger = {
        id: ledgerId,
        members,
        user1,
        user2,
        user1Name,
        user2Name,
        netBalance: 0,
        lastUpdated: new Date().toISOString(),
      };
      await setDoc(ledgerRef, initialLedger);
    }

    // Update current user profile
    await updateUserProfile(currentUser.uid, {
      partnerUid,
      partnerEmail: partnerData.email,
      partnerName: partnerData.displayName,
    });

    // Update partner profile
    await updateUserProfile(partnerUid, {
      partnerUid: currentUser.uid,
      partnerEmail: currentUser.email,
      partnerName: currentUser.displayName,
    });

    return { success: true, partnerProfile: partnerData };
  } catch (error) {
    console.error('Failed to pair profiles', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Could not complete pairing.',
    };
  }
}

export async function unlinkPartner(currentUser: UserProfile): Promise<void> {
  const partnerUid = currentUser.partnerUid;
  await updateUserProfile(currentUser.uid, {
    partnerUid: '',
    partnerEmail: '',
    partnerName: '',
  });

  if (partnerUid) {
    try {
      await updateUserProfile(partnerUid, {
        partnerUid: '',
        partnerEmail: '',
        partnerName: '',
      });
    } catch (e) {
      console.warn('Could not reset partner link on partner side', e);
    }
  }
}
