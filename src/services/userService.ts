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
import { getLedgerId, saveLocalLedger } from './sharedLedgerService';

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
      if (profile.email) {
        storedCodes[profile.email.toLowerCase()] = profile;
      }
      localStorage.setItem(PAIRING_CODES_KEY, JSON.stringify(storedCodes));
    }

    // Broadcast local update to any active tabs/components
    window.dispatchEvent(new CustomEvent('eq_profile_updated', { detail: profile }));
  } catch (e) {
    console.warn('Failed to save profile to localStorage', e);
  }
}

export async function registerUserInLookup(profile: UserProfile): Promise<void> {
  if (!profile.uid) return;
  const cleanEmail = (profile.email || '').toLowerCase().trim();
  const codeDoc: PairingCodeDoc = {
    uid: profile.uid,
    displayName: profile.displayName || 'Roommate',
    email: cleanEmail,
    pairCode: profile.pairCode || 'EQ-USER',
    createdAt: new Date().toISOString(),
  };

  try {
    // 1. Register by 6-character pair code
    if (profile.pairCode) {
      await setDoc(doc(db, 'pairing_codes', profile.pairCode.toUpperCase().trim()), codeDoc, { merge: true });
    }
    // 2. Register by email and EMAIL_ prefix
    if (cleanEmail) {
      await setDoc(doc(db, 'pairing_codes', cleanEmail), codeDoc, { merge: true });
      await setDoc(doc(db, 'pairing_codes', 'EMAIL_' + cleanEmail), codeDoc, { merge: true });
    }
  } catch (err) {
    console.warn('Pairing lookup registration notice:', err);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const local = getLocalProfile(uid);
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
    registerUserInLookup(initialLocal);
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
          registerUserInLookup(remoteProfile);
          callback(remoteProfile);

          // Auto-upgrade partner UID if synthetic
          if (
            remoteProfile.partnerEmail &&
            (!remoteProfile.partnerUid || remoteProfile.partnerUid.startsWith('partner_'))
          ) {
            autoResolvePartnerUid(remoteProfile);
          }
        } else {
          const currentLocal = getLocalProfile(uid);
          if (!currentLocal) {
            callback(null);
          }
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        const currentLocal = getLocalProfile(uid);
        if (currentLocal) {
          callback(currentLocal);
        }
      }
    );
  } catch (err) {
    console.warn('Firestore snapshot setup skipped/failed:', err);
  }

  // Also check local auto-upgrade
  if (initialLocal?.partnerEmail && (!initialLocal.partnerUid || initialLocal.partnerUid.startsWith('partner_'))) {
    autoResolvePartnerUid(initialLocal);
  }

  return () => {
    window.removeEventListener('eq_profile_updated', handleLocalUpdate);
    unsubscribeFirestore();
  };
}

async function autoResolvePartnerUid(profile: UserProfile): Promise<void> {
  if (!profile.partnerEmail) return;
  const cleanEmail = profile.partnerEmail.toLowerCase().trim();
  const keys = [cleanEmail, 'EMAIL_' + cleanEmail];

  for (const k of keys) {
    try {
      const snap = await getDoc(doc(db, 'pairing_codes', k));
      if (snap.exists()) {
        const pCode = snap.data() as PairingCodeDoc;
        if (pCode.uid && pCode.uid !== profile.uid && pCode.uid !== profile.partnerUid) {
          console.log(`Auto-upgrading partner UID for ${cleanEmail} to ${pCode.uid}`);
          await updateUserProfile(profile.uid, {
            partnerUid: pCode.uid,
            partnerName: pCode.displayName || profile.partnerName,
          });
          break;
        }
      }
    } catch {
      // ignore
    }
  }
}

export async function createUserProfile(profile: UserProfile): Promise<void> {
  saveLocalProfile(profile);
  registerUserInLookup(profile);

  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  data: Partial<UserProfile>
): Promise<void> {
  const current = getLocalProfile(uid);
  if (current) {
    const updated = { ...current, ...data };
    saveLocalProfile(updated);
    registerUserInLookup(updated);
  }

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

  // Make sure current user is registered so roommate can find back
  await registerUserInLookup(currentUser);

  let partnerUid: string | null = null;
  let partnerData: UserProfile | null = null;

  const candidateKeys = [
    cleanInput.toUpperCase(),
    cleanInput.toLowerCase(),
    'EMAIL_' + cleanInput.toLowerCase(),
  ];

  // 1. Try checking candidate keys in pairing_codes collection
  for (const key of candidateKeys) {
    try {
      const codeSnap = await getDoc(doc(db, 'pairing_codes', key));
      if (codeSnap.exists()) {
        const pCode = codeSnap.data() as PairingCodeDoc;
        if (pCode.uid && pCode.uid !== currentUser.uid) {
          partnerUid = pCode.uid;
          partnerData = {
            uid: pCode.uid,
            displayName: pCode.displayName,
            email: pCode.email,
            currentBalance: 0,
            monthlyBudget: 30000,
            salaryAmount: 0,
            salaryDate: '1st of Month',
            pairCode: pCode.pairCode,
            createdAt: pCode.createdAt,
          };
          break;
        }
      }
    } catch (err) {
      console.warn('Pair code lookup check:', key, err);
    }
  }

  // 2. Check local pair code cache
  if (!partnerUid) {
    try {
      const localCodes = JSON.parse(localStorage.getItem(PAIRING_CODES_KEY) || '{}');
      for (const k of candidateKeys) {
        const cached = localCodes[k];
        if (cached && cached.uid !== currentUser.uid) {
          partnerUid = cached.uid;
          partnerData = cached;
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback: If pairing offline or by direct name/custom identifier
  if (!partnerUid) {
    const isEmail = cleanInput.includes('@');
    const syntheticUid = 'partner_' + cleanInput.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (syntheticUid === currentUser.uid) {
      return { success: false, message: 'You cannot pair with yourself.' };
    }
    partnerUid = syntheticUid;
    partnerData = {
      uid: syntheticUid,
      displayName: isEmail ? cleanInput.split('@')[0] : cleanInput,
      email: isEmail ? cleanInput.toLowerCase() : `${cleanInput.toLowerCase().replace(/\s+/g, '')}@equilibrium.app`,
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

  const resolvedPartner: UserProfile = partnerData || {
    uid: partnerUid,
    displayName: cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput,
    email: cleanInput.includes('@') ? cleanInput.toLowerCase() : `${cleanInput.toLowerCase()}@equilibrium.app`,
    currentBalance: 0,
    monthlyBudget: 30000,
    salaryAmount: 0,
    salaryDate: '1st of Month',
    pairCode: 'EQ-RM',
    createdAt: new Date().toISOString(),
  };

  // Link both users
  try {
    const ledgerId = getLedgerId(
      currentUser.uid,
      partnerUid,
      currentUser.email,
      resolvedPartner.email
    );

    const members = [currentUser.uid, partnerUid].sort();
    const user1 = members[0];
    const user2 = members[1];
    const user1Name = user1 === currentUser.uid ? currentUser.displayName : resolvedPartner.displayName;
    const user2Name = user2 === currentUser.uid ? currentUser.displayName : resolvedPartner.displayName;

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
    saveLocalLedger(initialLedger);

    // Sync ledger to Firestore FIRST so document exists with members
    try {
      const ledgerRef = doc(db, 'shared_ledgers', ledgerId);
      await setDoc(ledgerRef, initialLedger, { merge: true });
    } catch (e) {
      console.warn('Firestore ledger create deferred:', e);
    }

    // Update current user profile
    await updateUserProfile(currentUser.uid, {
      partnerUid,
      partnerEmail: resolvedPartner.email,
      partnerName: resolvedPartner.displayName,
    });

    // Update partner profile in background
    if (partnerUid && !partnerUid.startsWith('partner_')) {
      try {
        await setDoc(
          doc(db, 'users', partnerUid),
          {
            partnerUid: currentUser.uid,
            partnerEmail: currentUser.email,
            partnerName: currentUser.displayName,
          },
          { merge: true }
        );
      } catch (e) {
        console.warn('Partner profile cross-update notice:', e);
      }
    }

    return { success: true, partnerProfile: resolvedPartner };
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

  if (partnerUid && !partnerUid.startsWith('partner_')) {
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
