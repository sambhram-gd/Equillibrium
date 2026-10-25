/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import {
  UserProfile,
  PersonalLog,
  SharedLedger,
  SharedTransaction,
  TabType,
} from './types';
import { listenToUserProfile } from './services/userService';
import { listenToPersonalLogs } from './services/personalLogService';
import {
  getLedgerId,
  listenToSharedLedger,
  listenToSharedTransactions,
} from './services/sharedLedgerService';

import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { PersonalSpace } from './components/PersonalSpace';
import { SharedLedgerView } from './components/SharedLedgerView';
import { PartnerView } from './components/PartnerView';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingModal } from './components/OnboardingModal';
import { QuickIncomeModal } from './components/QuickIncomeModal';

export default function App() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState<boolean>(true);

  // App Navigation
  const [currentTab, setCurrentTab] = useState<TabType>('personal-space');

  // Personal Logs State
  const [personalLogs, setPersonalLogs] = useState<PersonalLog[]>([]);

  // Shared Ledger State
  const [sharedLedger, setSharedLedger] = useState<SharedLedger | null>(null);
  const [sharedTransactions, setSharedTransactions] = useState<SharedTransaction[]>([]);

  // Quick Income Modal State
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState<boolean>(false);

  // 1. Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
      if (!user) {
        setUserProfile(null);
        setProfileLoading(false);
        setPersonalLogs([]);
        setSharedLedger(null);
        setSharedTransactions([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Listen to User Profile changes
  useEffect(() => {
    if (!authUser) return;

    setProfileLoading(true);
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

    const ledgerId = getLedgerId(authUser.uid, userProfile.partnerUid);

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
  }, [authUser, userProfile?.partnerUid]);

  // Loading Screen
  if (authLoading || (authUser && profileLoading)) {
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
  if (!authUser) {
    return <AuthScreen />;
  }

  // First-time user Onboarding questionnaire
  if (!userProfile) {
    return (
      <OnboardingModal
        authUser={authUser}
        onComplete={(newProfile) => {
          setUserProfile(newProfile);
        }}
      />
    );
  }

  // Calculate net balance for bottom nav badge
  let userNetBalance = 0;
  if (sharedLedger) {
    userNetBalance =
      userProfile.uid === sharedLedger.user1
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
