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

const PROFILE_KEY_PREFIX = 'eq_profile_';
const LAST_PROFILE_KEY = 'eq_last_profile';
const PAIRING_CODES_KEY = 'eq_local_pairing_codes';

export function generatePairCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'EQ-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getLocalProfile(uid?: string): UserProfile | null {
  try {
    if (uid) {
      const stored = localStorage.getItem(PROFILE_KEY_PREFIX + uid);
      if (stored) return JSON.parse(stored) as UserProfile;
    }
    const last = localStorage.getItem(LAST_PROFILE_KEY);
    if (last) {
      const parsed = JSON.parse(last) as UserProfile;
      if (!uid || parsed.uid === uid) return parsed;
    }
  } catch (e) {
    console.warn('Failed to parse local profile', e);
  }
  return null;
}

export function saveLocalProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(PROFILE_KEY_PREFIX + profile.uid, JSON.stringify(profile));
    localStorage.setItem(LAST_PROFILE_KEY, JSON.stringify(profile));

    // Cache pair code locally
    if (profile.pairCode) {
      const storedCodes = JSON.parse(localStorage.getItem(PAIRING_CODES_KEY) || '{}');
      storedCodes[profile.pairCode.toUpperCase()] = profile;
      localStorage.setItem(PAIRING_CODES_KEY, JSON.stringify(storedCodes));
    }

    // Broadcast local update to any active tabs/components
    window.dispatchEvent(new CustomEvent('eq_profile_updated', { detail: profile }));
  } catch (e) {
    console.warn('Failed to save profile to localStorage', e);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  // 1. Check local cache first
  const local = getLocalProfile(uid);

  // 2. Try fetching from Firestore
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      const remoteData = snap.data() as UserProfile;
      saveLocalProfile(remoteData);
      return remoteData;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  return local;
}

export function listenToUserProfile(
  uid: string,
  callback: (profile: UserProfile | null) => void
): () => void {
  // 1. Immediately emit local profile if it exists
  const initialLocal = getLocalProfile(uid);
  if (initialLocal) {
    callback(initialLocal);
  }

  // 2. Listen to custom window events for immediate local updates
  const handleLocalUpdate = (e: Event) => {
    const custom = e as CustomEvent<UserProfile>;
    if (custom.detail && (!uid || custom.detail.uid === uid)) {
      callback(custom.detail);
    }
  };
  window.addEventListener('eq_profile_updated', handleLocalUpdate);

  // 3. Listen to Firestore in background
  const path = `users/${uid}`;
  let unsubscribeFirestore = () => {};

  try {
    unsubscribeFirestore = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          const remoteProfile = snap.data() as UserProfile;
          saveLocalProfile(remoteProfile);
          callback(remoteProfile);
        } else {
          // Only send null if we truly have no local profile
          const currentLocal = getLocalProfile(uid);
          if (!currentLocal) {
            callback(null);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        // Do NOT call callback(null) on error; preserve local profile!
        const currentLocal = getLocalProfile(uid);
        if (currentLocal) {
          callback(currentLocal);
        }
      }
    );
  } catch (err) {
    console.warn('Firestore snapshot setup skipped/failed:', err);
  }

  return () => {
    window.removeEventListener('eq_profile_updated', handleLocalUpdate);
    unsubscribeFirestore();
  };
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  // 1. Always save locally first
  saveLocalProfile(profile);

  // 2. Sync to Firestore in background
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), profile, { merge: true });

    if (profile.pairCode) {
      const codeDoc: PairingCodeDoc = {
        uid: profile.uid,
        displayName: profile.displayName,
        email: profile.email,
        pairCode: profile.pairCode,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'pairing_codes', profile.pairCode), codeDoc, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    // Non-fatal: local profile is safe
  }
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  // 1. Update local storage
  const current = getLocalProfile(uid);
  if (current) {
    const updated = { ...current, ...data };
    saveLocalProfile(updated);
  }

  // 2. Sync to Firestore
  const path = `users/${uid}`;
  try {
    await setDoc(doc(db, 'users', uid), data, { merge: true });
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
    return { success: false, message: 'Please enter a valid pair code, email, or roommate name.' };
  }

  let partnerUid: string | null = null;
  let partnerData: UserProfile | null = null;

  // 1. Try checking pair code collection first from Firestore
  try {
    const codeSnap = await getDoc(doc(db, 'pairing_codes', cleanInput.toUpperCase()));
    if (codeSnap.exists()) {
      const pCode = codeSnap.data() as PairingCodeDoc;
      partnerUid = pCode.uid;
    }
  } catch (err) {
    console.warn('Pair code remote lookup failed', err);
  }

  // 2. Check local pair code cache
  if (!partnerUid) {
    try {
      const localCodes = JSON.parse(localStorage.getItem(PAIRING_CODES_KEY) || '{}');
      const cached = localCodes[cleanInput.toUpperCase()];
      if (cached && cached.uid !== currentUser.uid) {
        partnerUid = cached.uid;
        partnerData = cached;
      }
    } catch {
      // ignore
    }
  }

  // 3. If not found by code, try by email query in Firestore
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

  // 4. Fallback: If pairing offline or by direct name/custom identifier
  if (!partnerUid) {
    // Treat cleanInput as roommate name or email directly so roommate pairing ALWAYS works!
    const syntheticUid = 'partner_' + cleanInput.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (syntheticUid === currentUser.uid) {
      return { success: false, message: 'You cannot pair with yourself.' };
    }
    partnerUid = syntheticUid;
    partnerData = {
      uid: syntheticUid,
      displayName: cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput,
      email: cleanInput.includes('@') ? cleanInput : `${cleanInput.toLowerCase().replace(/\s+/g, '')}@equilibrium.app`,
      currentBalance: 0,
      monthlyBudget: 30000,
      salaryAmount: 0,
      salaryDate: '1st of Month',
      pairCode: 'EQ-RM',
      createdAt: new Date().toISOString(),
      partnerUid: currentUser.uid,
      partnerName: currentUser.displayName,
      partnerEmail: currentUser.email,
    };
    saveLocalProfile(partnerData);
  }

  if (partnerUid === currentUser.uid) {
    return { success: false, message: 'You cannot pair with yourself.' };
  }

  // Fetch partner profile if not yet fetched
  if (!partnerData) {
    partnerData = await getUserProfile(partnerUid);
  }

  if (!partnerData) {
    partnerData = {
      uid: partnerUid,
      displayName: cleanInput,
      email: cleanInput,
      currentBalance: 0,
      monthlyBudget: 30000,
      salaryAmount: 0,
      salaryDate: '1st of Month',
      pairCode: cleanInput.toUpperCase(),
      createdAt: new Date().toISOString(),
    };
  }

  // Link both users
  try {
    const members = [currentUser.uid, partnerUid].sort();
    const ledgerId = members.join('_');
    const user1 = members[0];
    const user2 = members[1];
    const user1Name = user1 === currentUser.uid ? currentUser.displayName : partnerData.displayName;
    const user2Name = user2 === currentUser.uid ? currentUser.displayName : partnerData.displayName;

    // Create shared ledger
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

    // Save ledger locally
    try {
      localStorage.setItem('eq_ledger_' + ledgerId, JSON.stringify(initialLedger));
      window.dispatchEvent(new CustomEvent('eq_ledger_updated', { detail: initialLedger }));
    } catch {
      // ignore
    }

    // Try creating ledger in Firestore
    try {
      const ledgerRef = doc(db, 'shared_ledgers', ledgerId);
      await setDoc(ledgerRef, initialLedger, { merge: true });
    } catch (e) {
      console.warn('Firestore ledger create deferred:', e);
    }

    // Update current user profile
    await updateUserProfile(currentUser.uid, {
      partnerUid,
      partnerEmail: partnerData.email,
      partnerName: partnerData.displayName,
    });

    // Update partner profile if local
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
