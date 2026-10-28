import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, SharedLedger, SharedTransaction, PersonalLog } from '../types';
import { pairWithRoommate, unlinkPartner } from '../services/userService';
import {
  isNotificationsEnabled,
  setNotificationsEnabled,
  requestNotificationPermission,
  notifyRoommateActivity,
  playNotificationChime,
} from '../services/notificationService';

interface PartnerViewProps {
  user: UserProfile;
  partnerProfile?: UserProfile | null;
  partnerLogs?: PersonalLog[];
  ledger: SharedLedger | null;
  transactions: SharedTransaction[];
  onRefreshProfile?: () => void;
}

interface RoommateActivityItem {
  id: string;
  amount: number;
  category: string;
  note?: string;
  timestamp: string;
  type: 'personal' | 'shared_fronted' | 'settlement';
  splitAmountOther?: number;
}

export const PartnerView: React.FC<PartnerViewProps> = ({
  user,
  partnerProfile,
  partnerLogs = [],
  ledger,
  transactions,
}) => {
  const [partnerInput, setPartnerInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [showUnlinkModal, setShowUnlinkModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [notifyOn, setNotifyOn] = useState<boolean>(() => isNotificationsEnabled());
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    const handleSync = () => setNotifyOn(isNotificationsEnabled());
    window.addEventListener('eq_notify_pref_changed', handleSync);
    return () => window.removeEventListener('eq_notify_pref_changed', handleSync);
  }, []);

  const handleToggleNotify = async () => {
    if (notifyOn) {
      setNotificationsEnabled(false);
      setNotifyOn(false);
    } else {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        setNotifyOn(true);
        playNotificationChime();
        notifyRoommateActivity({
          id: 'roommate_alert_active_' + Date.now(),
          title: '🔔 Roommate Alerts Active',
          body: `You'll be alerted whenever ${user.partnerName || 'your roommate'} logs a shared expense.`,
          senderName: user.partnerName || 'Roommate',
          timestamp: new Date().toISOString(),
        });
      } else {
        setNotifyOn(false);
      }
    }
  };

  const isLinked = Boolean(user.partnerUid);
  const partnerName = partnerProfile?.displayName || user.partnerName || 'Roommate';
  const partnerEmail = partnerProfile?.email || user.partnerEmail || 'Paired Roommate';

  const handleCopyCode = () => {
    if (user.pairCode) {
      navigator.clipboard.writeText(user.pairCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerInput.trim()) return;

    setIsLinking(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await pairWithRoommate(user, partnerInput.trim());
    setIsLinking(false);

    if (res.success) {
      setSuccessMsg(`Successfully linked with ${res.partnerProfile?.displayName || 'roommate'}!`);
      setPartnerInput('');
    } else {
      setErrorMsg(res.message || 'Failed to link roommate.');
    }
  };

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      await unlinkPartner(user);
      setShowUnlinkModal(false);
      setSuccessMsg('Roommate unlinked.');
    } catch {
      setErrorMsg('Failed to unlink roommate.');
    } finally {
      setIsUnlinking(false);
    }
  };

  // Calculate bilateral balance
  let myNetBalance = 0;
  if (ledger) {
    const isUser1 =
      user.uid === ledger.user1 ||
      (user.email && ledger.user1 && ledger.user1.includes(user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')));
    myNetBalance = isUser1 ? ledger.netBalance : -ledger.netBalance;
  }

  // Calculate mutual totals
  let totalFrontedByMe = 0;
  let totalFrontedByPartner = 0;

  transactions.forEach((tx) => {
    if (tx.isSettlement) return;
    const isMe = tx.paidBy === user.uid || (user.displayName && tx.paidByName === user.displayName);
    if (isMe) {
      totalFrontedByMe += tx.totalAmount;
    } else {
      totalFrontedByPartner += tx.totalAmount;
    }
  });

  const totalMutualSpend = totalFrontedByMe + totalFrontedByPartner;

  // Build Roommate's Unified Transparent Activity Stream
  const combinedRoommateLogs = useMemo<RoommateActivityItem[]>(() => {
    const itemsMap = new Map<string, RoommateActivityItem>();

    // 1. Add Roommate's personal logs
    partnerLogs.forEach((log) => {
      const id = log.id || log.timestamp;
      itemsMap.set(id, {
        id,
        amount: log.amount,
        category: log.category,
        note: log.note,
        timestamp: log.timestamp,
        type: 'personal',
      });
    });

    // 2. Add shared transactions where roommate was the payer
    transactions.forEach((tx) => {
      const isRoommatePayer =
        tx.paidBy === user.partnerUid ||
        (user.displayName && tx.paidByName !== user.displayName && tx.paidBy !== user.uid);

      if (isRoommatePayer) {
        const id = tx.id || tx.timestamp;
        itemsMap.set(id, {
          id,
          amount: tx.totalAmount,
          category: tx.category,
          note: tx.description,
          timestamp: tx.timestamp,
          type: tx.isSettlement ? 'settlement' : 'shared_fronted',
          splitAmountOther: tx.splitAmountOther,
        });
      }
    });

    return Array.from(itemsMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [partnerLogs, transactions, user.partnerUid, user.displayName]);

  // Filter roommate logs by selected period
  const filteredRoommateLogs = useMemo(() => {
    if (filterPeriod === 'all') return combinedRoommateLogs;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return combinedRoommateLogs.filter((log) => {
      const logTime = new Date(log.timestamp).getTime();
      if (filterPeriod === 'today') return logTime >= startOfDay;
      if (filterPeriod === 'week') {
        const startOfWeek = startOfDay - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;
        return logTime >= startOfWeek;
      }
      if (filterPeriod === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        return logTime >= startOfMonth;
      }
      return true;
    });
  }, [combinedRoommateLogs, filterPeriod]);

  // Roommate's monthly spend
  const roommateMonthlySpend = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return combinedRoommateLogs.reduce((total, log) => {
      const logTime = new Date(log.timestamp).getTime();
      if (logTime >= startOfMonth && log.type !== 'settlement') {
        return total + log.amount;
      }
      return total;
    }, 0);
  }, [combinedRoommateLogs]);

  // Roommate budget burndown calculations
  const partnerBudgetCap = partnerProfile?.monthlyBudget || 30000;
  const partnerBudgetPercent = Math.min(100, Math.round((roommateMonthlySpend / partnerBudgetCap) * 100));

  // Roommate liquid balance
  const partnerLiquidBalance =
    partnerProfile?.currentBalance !== undefined
      ? partnerProfile.currentBalance
      : Math.max(0, (partnerProfile?.salaryAmount || 75000) - roommateMonthlySpend);

  const formatINR = (val: number) => {
    return '₹' + Math.abs(Math.round(val)).toLocaleString('en-IN');
  };

  const getCategoryIcon = (category: string) => {
    const c = (category || '').toLowerCase();
    if (c.includes('coffee') || c.includes('cafe')) return 'local_cafe';
    if (c.includes('breakfast') || c.includes('bakery')) return 'bakery_dining';
    if (c.includes('metro') || c.includes('subway') || c.includes('train')) return 'subway';
    if (c.includes('bus')) return 'directions_bus';
    if (c.includes('lunch')) return 'lunch_dining';
    if (c.includes('dinner')) return 'dinner_dining';
    if (c.includes('grocer') || c.includes('mart') || c.includes('nature')) return 'shopping_cart';
    if (c.includes('util') || c.includes('power') || c.includes('electric') || c.includes('gas') || c.includes('bill')) return 'bolt';
    if (c.includes('rent') || c.includes('house') || c.includes('room')) return 'home';
    if (c.includes('wifi') || c.includes('internet')) return 'wifi';
    if (c.includes('clean') || c.includes('maid') || c.includes('suppl')) return 'cleaning_services';
    if (c.includes('taxi') || c.includes('cab') || c.includes('uber') || c.includes('ola')) return 'local_taxi';
    if (c.includes('salary') || c.includes('income')) return 'payments';
    return 'category';
  };

  return (
    <div className="flex flex-col gap-5 pb-8 select-none">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 bg-[#10b981]/20 border border-[#34d399]/40 text-[#34d399] text-xs font-semibold rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 bg-[#fb7185]/20 border border-[#fb7185]/40 text-[#fb7185] text-xs font-semibold rounded-2xl flex items-center gap-2.5 animate-in fade-in duration-150">
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Unlinked View: Pairing Portal */}
      {!isLinked ? (
        <div className="flex flex-col gap-5">
          {/* Your Pair Code Card */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#a0aec0] uppercase tracking-wider font-headline">
                My Roommate Invite Code
              </span>
              <span className="px-2.5 py-1 rounded-full bg-[#10b981]/15 text-[#34d399] text-[10px] font-bold border border-[#10b981]/30">
                Ready to Pair
              </span>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#070c18] rounded-2xl border border-white/10 shadow-inner">
              <div>
                <span className="text-[10px] text-[#a0aec0] block font-medium">Share this code with your roommate:</span>
                <span className="font-mono text-2xl font-extrabold text-[#34d399] tracking-widest mt-0.5 block">
                  {user.pairCode || 'EQ-NONE'}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-4 py-2.5 rounded-xl bg-[#1c263c] hover:bg-[#26334f] text-white border border-white/10 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copiedCode ? 'check' : 'content_copy'}
                </span>
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-xs text-[#a0aec0] leading-relaxed">
              When your roommate enters your code, Equilibrium automatically creates a zero-sum bilateral ledger between both accounts with full dashboard transparency.
            </p>
          </div>

          {/* Connect Roommate Form */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#adc6ff]/15 flex items-center justify-center text-[#adc6ff]">
                <span className="material-symbols-outlined text-[20px]">
                  person_add
                </span>
              </div>
              <h3 className="text-sm font-bold text-white font-headline">
                Enter Roommate's Code or Email
              </h3>
            </div>

            <form onSubmit={handlePair} className="flex flex-col gap-3.5">
              <div>
                <input
                  type="text"
                  placeholder="E.g. EQ-7B3F or roommate@gmail.com"
                  value={partnerInput}
                  onChange={(e) => setPartnerInput(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[#070c18] border border-white/10 rounded-2xl text-sm font-semibold text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none uppercase"
                />
              </div>

              <button
                type="submit"
                disabled={isLinking || !partnerInput.trim()}
                className="w-full py-4 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-xl shadow-[#10b981]/25 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px] font-bold">
                  link
                </span>
                <span>{isLinking ? 'Linking Roommate...' : 'Connect & Establish Ledger'}</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Linked Roommate: Full Dashboard & Transparent Passbook */
        <div className="flex flex-col gap-4">
          {/* Roommate Hero Identity Card */}
          <div className="glass-panel rounded-3xl p-5 sm:p-6 border border-white/10 shadow-xl flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-[#0566d9] to-[#adc6ff] flex items-center justify-center font-headline font-bold text-xl text-[#002e6a] shadow-lg shadow-[#0566d9]/25">
                  {partnerName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white font-headline">
                      {partnerName}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#34d399]/15 text-[#34d399] text-[9px] font-bold border border-[#34d399]/25">
                      Transparent
                    </span>
                  </div>
                  <p className="text-xs text-[#a0aec0]">{partnerEmail}</p>
                </div>
              </div>

              <div className="px-3 py-1 rounded-full bg-[#10b981]/15 text-[#34d399] text-[10px] font-bold flex items-center gap-1.5 border border-[#10b981]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse"></span>
                Connected
              </div>
            </div>

            {/* Current Bilateral State Bar */}
            <div className="p-4 bg-[#070c18] rounded-2xl border border-white/10 flex items-center justify-between shadow-inner">
              <div>
                <span className="text-[10px] text-[#a0aec0] uppercase tracking-wider block font-semibold">
                  Net Ledger State
                </span>
                <span className="text-xs font-semibold text-white mt-0.5 block">
                  {myNetBalance > 0
                    ? `${partnerName} owes you`
                    : myNetBalance < 0
                    ? `You owe ${partnerName}`
                    : 'All Settled'}
                </span>
              </div>
              <span
                className={`text-lg font-extrabold font-headline tabular-nums ${
                  myNetBalance > 0
                    ? 'text-[#34d399]'
                    : myNetBalance < 0
                    ? 'text-[#fb7185]'
                    : 'text-white'
                }`}
              >
                {myNetBalance === 0 ? '₹0.00' : formatINR(myNetBalance)}
              </span>
            </div>
          </div>

          {/* Roommate's Dashboard Metric 1: Liquid Vault Hero Card */}
          <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#121a2d] to-[#0a1120] border border-white/[0.08] shadow-[0_10px_35px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08)] flex flex-col justify-between">
            <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-[#adc6ff]/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider font-headline">
                {partnerName}'s Liquid Balance
              </span>
              <div className="px-3 py-1 rounded-full bg-[#adc6ff]/15 text-[#adc6ff] text-[11px] font-bold flex items-center gap-1.5 border border-[#adc6ff]/25 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#adc6ff] animate-pulse"></span>
                <span>Roommate Vault</span>
              </div>
            </div>

            <div className="text-4xl sm:text-5xl font-black tracking-tight text-white font-headline tabular-nums my-1.5">
              {formatINR(partnerLiquidBalance)}
            </div>

            <div className="flex items-center justify-between pt-3.5 mt-2 border-t border-white/[0.06] text-xs text-[#94a3b8]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#adc6ff]">
                  account_balance_wallet
                </span>
                <span>
                  Present Cash
                  {partnerProfile?.salaryAmount ? ` • ${formatINR(partnerProfile.salaryAmount)}/mo` : ''}
                </span>
              </div>
              <span className="text-[11px] text-[#34d399] font-semibold">
                Live Synced
              </span>
            </div>
          </div>

          {/* Roommate's Dashboard Metric 2: Monthly Budget Burndown Meter */}
          <div className="rounded-3xl p-5 bg-[#121a2d]/90 border border-white/[0.08] flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider font-headline">
                {partnerName}'s Budget Burndown
              </span>
              <span
                className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                  partnerBudgetPercent > 85
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/25'
                }`}
              >
                {partnerBudgetPercent}% Used
              </span>
            </div>

            <div className="text-base font-extrabold text-white font-headline tabular-nums mb-2.5">
              {formatINR(roommateMonthlySpend)}{' '}
              <span className="text-xs text-[#94a3b8] font-normal">
                / {formatINR(partnerBudgetCap)} monthly cap
              </span>
            </div>

            {/* Burndown Bar */}
            <div className="w-full bg-[#1e293b] h-2.5 rounded-full overflow-hidden p-0.5 ring-1 ring-white/[0.05]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  partnerBudgetPercent > 85
                    ? 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                    : 'bg-gradient-to-r from-[#0566d9] to-[#adc6ff] shadow-[0_0_12px_rgba(173,198,255,0.5)]'
                }`}
                style={{ width: `${partnerBudgetPercent}%` }}
              ></div>
            </div>
          </div>

          {/* Shared Statistics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-white/10 shadow-lg">
              <span className="text-[11px] text-[#a0aec0] block font-medium mb-1">
                Total Mutual Spend
              </span>
              <span className="text-base sm:text-xl font-bold font-headline text-white tabular-nums">
                {formatINR(totalMutualSpend)}
              </span>
              <span className="text-[10px] text-[#a0aec0] block mt-1">
                {transactions.filter((t) => !t.isSettlement).length} shared splits
              </span>
            </div>

            <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-white/10 shadow-lg">
              <span className="text-[11px] text-[#a0aec0] block font-medium mb-1">
                Fronted By {partnerName.split(' ')[0]}
              </span>
              <span className="text-base sm:text-xl font-bold font-headline text-[#34d399] tabular-nums">
                {formatINR(totalFrontedByPartner)}
              </span>
              <span className="text-[10px] text-[#a0aec0] block mt-1">
                vs {formatINR(totalFrontedByMe)} by you
              </span>
            </div>
          </div>

          {/* Roommate's Transparent Passbook Feed Section */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white font-headline tracking-tight">
                  {partnerName}'s Passbook
                </span>
                <span className="text-xs text-[#94a3b8] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
                  {filteredRoommateLogs.length}
                </span>
              </div>

              {/* Period Filter Tabs */}
              <div className="bg-[#121a2d] p-1 rounded-xl border border-white/[0.08] flex items-center gap-1">
                {(['all', 'today', 'week', 'month'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setFilterPeriod(period)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-headline capitalize transition-all ${
                      filterPeriod === period
                        ? 'bg-[#34d399] text-[#013421]'
                        : 'text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {period === 'week' ? 'Week' : period === 'month' ? 'Month' : period}
                  </button>
                ))}
              </div>
            </div>

            {/* Roommate Passbook Entries */}
            {filteredRoommateLogs.length === 0 ? (
              <div className="glass-panel rounded-3xl p-7 border border-white/10 text-center flex flex-col items-center justify-center gap-2.5">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center text-[#94a3b8]">
                  <span className="material-symbols-outlined text-[24px]">receipt_long</span>
                </div>
                <p className="text-sm font-bold text-white font-headline">No activity logged yet</p>
                <p className="text-xs text-[#a0aec0] max-w-xs leading-relaxed">
                  When {partnerName} logs personal or shared expenses, they will stream transparently into this feed in real-time.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {filteredRoommateLogs.map((item) => {
                  const logDate = new Date(item.timestamp);
                  const formattedDate = logDate.toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                  });
                  const formattedTime = logDate.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={item.id}
                      className="glass-panel rounded-2xl p-4 border border-white/10 flex items-center justify-between shadow-md hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#1c263c] text-[#adc6ff] flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-[22px]">
                            {getCategoryIcon(item.category)}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white font-headline">
                              {item.category}
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                item.type === 'settlement'
                                  ? 'bg-[#10b981]/20 text-[#34d399]'
                                  : item.type === 'shared_fronted'
                                  ? 'bg-[#adc6ff]/20 text-[#adc6ff]'
                                  : 'bg-white/[0.08] text-[#a0aec0]'
                              }`}
                            >
                              {item.type === 'settlement'
                                ? 'SETTLED'
                                : item.type === 'shared_fronted'
                                ? 'SHARED BILL'
                                : 'PERSONAL'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#a0aec0] mt-0.5">
                            {item.note || 'No note'} • {formattedDate}, {formattedTime}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-sm font-extrabold text-white font-headline tabular-nums">
                          {formatINR(item.amount)}
                        </div>
                        {item.type === 'shared_fronted' && item.splitAmountOther && (
                          <div className="text-[10px] text-[#34d399]">
                            Your share: {formatINR(item.splitAmountOther)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Instant Roommate Alerts Quick Pill */}
          <div className="glass-panel rounded-3xl p-4 border border-white/10 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
                  notifyOn ? 'bg-[#10b981]/20 text-[#34d399]' : 'bg-white/[0.06] text-[#a0aec0]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {notifyOn ? 'notifications_active' : 'notifications_off'}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold text-white font-headline">Instant Roommate Alerts</p>
                <p className="text-[10px] text-[#a0aec0]">
                  {notifyOn ? 'Active: Swiggy-style pop-ups & chimes' : 'Off: Tap to enable live alerts'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleNotify}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-headline transition-all active:scale-95 ${
                notifyOn
                  ? 'bg-white/[0.08] text-white border border-white/10 hover:bg-white/[0.12]'
                  : 'bg-gradient-to-r from-[#10b981] to-[#34d399] text-[#013421] shadow-md shadow-[#10b981]/25'
              }`}
            >
              {notifyOn ? 'Turn Off' : 'Enable'}
            </button>
          </div>

          {/* Roommate Options / Unlink Button */}
          <div className="pt-2 flex justify-between items-center px-1">
            <div className="text-xs text-[#a0aec0]">
              Pair Code: <strong className="text-white font-mono">{user.pairCode}</strong>
            </div>

            <button
              onClick={() => setShowUnlinkModal(true)}
              className="text-xs text-[#fb7185] hover:underline flex items-center gap-1 transition-colors font-medium"
            >
              <span className="material-symbols-outlined text-[16px]">link_off</span>
              <span>Unlink Roommate</span>
            </button>
          </div>
        </div>
      )}

      {/* Unlink Confirmation Modal */}
      {showUnlinkModal && (
        <div className="fixed inset-0 z-50 bg-[#040812]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#121a2d] rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 pb-safe">
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

            <div className="flex items-center gap-2.5 text-[#fb7185]">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-base font-bold font-headline text-white">
                Unlink Roommate?
              </h3>
            </div>
            <p className="text-xs text-[#a0aec0] leading-relaxed">
              Are you sure you want to disconnect from {partnerName}? You can reconnect anytime by sharing your pair code again.
            </p>
            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => setShowUnlinkModal(false)}
                className="flex-1 py-3 bg-[#1c263c] hover:bg-[#26334f] text-white rounded-2xl text-xs font-semibold active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUnlink}
                disabled={isUnlinking}
                className="flex-1 py-3 bg-gradient-to-r from-[#e11d48] to-[#fb7185] text-white rounded-2xl text-xs font-bold active:scale-95 transition-all shadow-lg shadow-[#e11d48]/25"
              >
                {isUnlinking ? 'Unlinking...' : 'Confirm Unlink'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
