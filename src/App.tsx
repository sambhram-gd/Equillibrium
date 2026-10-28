/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import {
  UserProfile,
  PersonalLog,
  SharedLedger,
  SharedTransaction,
  TabType,
} from './types';
import { listenToUserProfile, getLocalProfile } from './services/userService';
import { listenToPersonalLogs, getLocalPersonalLogs } from './services/personalLogService';
import {
  getLedgerId,
  listenToSharedLedger,
  listenToSharedTransactions,
  getLocalLedger,
  getLocalTransactions,
} from './services/sharedLedgerService';

import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PersonalSpace } from './components/PersonalSpace';
import { SharedLedgerView } from './components/SharedLedgerView';
import { PartnerView } from './components/PartnerView';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingModal } from './components/OnboardingModal';
import { QuickIncomeModal } from './components/QuickIncomeModal';

export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
}

function getInitialUser(): AppUser | null {
  try {
    const raw = localStorage.getItem('eq_guest_user');
    if (raw) return JSON.parse(raw);
    const lastProfile = localStorage.getItem('eq_last_profile');
    if (lastProfile) {
      const p = JSON.parse(lastProfile);
      return {
        uid: p.uid,
        displayName: p.displayName,
        email: p.email,
        photoURL: p.photoURL,
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export default function App() {
  const [authUser, setAuthUser] = useState<AppUser | null>(() => getInitialUser());
  const [authLoading, setAuthLoading] = useState<boolean>(() => !getInitialUser());
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => getLocalProfile());
  const [profileLoading, setProfileLoading] = useState<boolean>(() => !getLocalProfile());

  // App Navigation
  const [currentTab, setCurrentTab] = useState<TabType>('personal-space');

  // Personal Logs State
  const [personalLogs, setPersonalLogs] = useState<PersonalLog[]>(() => {
    const initial = getInitialUser();
    return initial ? getLocalPersonalLogs(initial.uid) : [];
  });

  // Shared Ledger State
  const [sharedLedger, setSharedLedger] = useState<SharedLedger | null>(() => {
    const initialProf = getLocalProfile();
    if (initialProf?.uid && initialProf?.partnerUid) {
      const lid = getLedgerId(
        initialProf.uid,
        initialProf.partnerUid,
        initialProf.email,
        initialProf.partnerEmail
      );
      return getLocalLedger(lid);
    }
    return null;
  });

  const [sharedTransactions, setSharedTransactions] = useState<SharedTransaction[]>(() => {
    const initialProf = getLocalProfile();
    if (initialProf?.uid && initialProf?.partnerUid) {
      const lid = getLedgerId(
        initialProf.uid,
        initialProf.partnerUid,
        initialProf.email,
        initialProf.partnerEmail
      );
      return getLocalTransactions(lid);
    }
    return [];
  });

  // Quick Income Modal State
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState<boolean>(false);

  // Sync guest login
  const refreshAuthFromStorage = useCallback(() => {
    const guest = getInitialUser();
    if (guest) {
      setAuthUser(guest);
      setAuthLoading(false);
      const prof = getLocalProfile(guest.uid);
      if (prof) {
        setUserProfile(prof);
        setProfileLoading(false);
      }
    }
  }, []);

  // 1. Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const mappedUser: AppUser = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        };
        setAuthUser(mappedUser);
      } else {
        const fallback = getInitialUser();
        setAuthUser(fallback);
      }
      setAuthLoading(false);
    });

    window.addEventListener('eq_auth_changed', refreshAuthFromStorage);

    return () => {
      unsubscribe();
      window.removeEventListener('eq_auth_changed', refreshAuthFromStorage);
    };
  }, [refreshAuthFromStorage]);

  // 2. Listen to User Profile changes
  useEffect(() => {
    if (!authUser) {
      const local = getLocalProfile();
      if (!local) {
        setProfileLoading(false);
      }
      return;
    }

    const unsubscribeProfile = listenToUserProfile(authUser.uid, (profile) => {
      setUserProfile(profile);
      setProfileLoading(false);
    });

    return () => unsubscribeProfile();
  }, [authUser]);

  // 3. Listen to Personal Logs
  useEffect(() => {
    if (!authUser || !userProfile) return;

    const unsubscribeLogs = listenToPersonalLogs(authUser.uid, (logs) => {
      setPersonalLogs(logs);
    });

    return () => unsubscribeLogs();
  }, [authUser, userProfile?.uid]);

  // 4. Listen to Shared Ledger & Transactions if partner is linked
  useEffect(() => {
    if (!authUser || !userProfile?.partnerUid) {
      setSharedLedger(null);
      setSharedTransactions([]);
      return;
    }

    const ledgerId = getLedgerId(
      authUser.uid,
      userProfile.partnerUid,
      authUser.email,
      userProfile.partnerEmail
    );

    const unsubscribeLedger = listenToSharedLedger(ledgerId, (ledger) => {
      setSharedLedger(ledger);
    });

    const unsubscribeTxs = listenToSharedTransactions(ledgerId, (txs) => {
      setSharedTransactions(txs);
    });

    return () => {
      unsubscribeLedger();
      unsubscribeTxs();
    };
  }, [authUser, userProfile?.partnerUid, userProfile?.partnerEmail]);

  // Loading Screen (only if we truly have no auth data yet)
  if (authLoading && !authUser && !userProfile) {
    return (
      <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-[#4edea3] border-t-transparent rounded-full animate-spin"></div>
        <div className="text-xs text-[#bbcabf] font-mono tracking-wider">
          Initializing Equilibrium...
        </div>
      </div>
    );
  }

  // Unauthenticated Screen
  if (!authUser && !userProfile) {
    return <AuthScreen onGuestLogin={refreshAuthFromStorage} />;
  }

  // Safe user fallback for rendering
  const activeUser = authUser || {
    uid: userProfile?.uid || 'guest_user',
    displayName: userProfile?.displayName || 'User',
    email: userProfile?.email || 'user@equilibrium.local',
  };

  // First-time user Onboarding questionnaire (only if profile truly does not exist yet)
  if (!userProfile) {
    return (
      <OnboardingModal
        authUser={activeUser}
        onComplete={(newProfile) => {
          setUserProfile(newProfile);
          setProfileLoading(false);
        }}
      />
    );
  }

  // Calculate net balance for bottom nav badge
  let userNetBalance = 0;
  if (sharedLedger) {
    const isUser1 =
      userProfile.uid === sharedLedger.user1 ||
      (userProfile.email && sharedLedger.user1 && sharedLedger.user1.includes(userProfile.email.toLowerCase().replace(/[^a-z0-9]/g, '_')));
    userNetBalance = isUser1
      ? sharedLedger.netBalance
      : -sharedLedger.netBalance;
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col selection:bg-[#4edea3]/30">
      {/* Top Header Bar */}
      <Header
        user={userProfile}
        onOpenIncomeModal={() => setIsIncomeModalOpen(true)}
      />

      {/* Main Tab View Container */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-20 pb-24">
        {currentTab === 'personal-space' && (
          <PersonalSpace
            user={userProfile}
            logs={personalLogs}
            onOpenIncomeModal={() => setIsIncomeModalOpen(true)}
          />
        )}

        {currentTab === 'shared-ledger' && (
          <SharedLedgerView
            user={userProfile}
            ledger={sharedLedger}
            transactions={sharedTransactions}
            onNavigateToPartner={() => setCurrentTab('partner-view')}
          />
        )}

        {currentTab === 'partner-view' && (
          <PartnerView
            user={userProfile}
            ledger={sharedLedger}
            transactions={sharedTransactions}
          />
        )}
      </main>

      {/* Quick Income Modal */}
      <QuickIncomeModal
        user={userProfile}
        isOpen={isIncomeModalOpen}
        onClose={() => setIsIncomeModalOpen(false)}
        onSuccess={() => {}}
      />

      {/* Persistent Bottom Tab Navigation */}
      <BottomNav
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        sharedLedgerBalance={userProfile.partnerUid ? userNetBalance : undefined}
      />
    </div>
  );
}
