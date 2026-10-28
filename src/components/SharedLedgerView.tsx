import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { UserProfile, SharedLedger, SharedTransaction } from '../types';
import { addSharedTransaction, settleUpLedger, getLedgerId } from '../services/sharedLedgerService';

interface SharedLedgerViewProps {
  user: UserProfile;
  ledger: SharedLedger | null;
  transactions: SharedTransaction[];
  onNavigateToPartner: () => void;
}

const SHARED_CATEGORIES = [
  { name: 'Groceries', icon: 'shopping_cart' },
  { name: 'Rent', icon: 'home' },
  { name: 'Utilities', icon: 'bolt' },
  { name: 'Dining', icon: 'restaurant' },
  { name: 'Wifi/Bills', icon: 'wifi' },
  { name: 'House Supplies', icon: 'cleaning_services' },
  { name: 'Travel/Cab', icon: 'local_taxi' },
  { name: 'Other', icon: 'category' },
];

export const SharedLedgerView: React.FC<SharedLedgerViewProps> = ({
  user,
  ledger,
  transactions,
  onNavigateToPartner,
}) => {
  const [showLogModal, setShowLogModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Form State for Shared Expense
  const [payer, setPayer] = useState<'me' | 'partner'>('me');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(getTodayStr());
  const [splitRatio, setSplitRatio] = useState<number>(50); // percentage other person pays
  const [customSplit, setCustomSplit] = useState<string>('');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [category, setCategory] = useState<string>('Groceries');
  const [description, setDescription] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const partnerName = user.partnerName || 'Roommate';

  // Calculate net balance from current user's perspective
  // user1 is lower UID, user2 is higher UID
  // netBalance > 0: user1 is owed; netBalance < 0: user2 is owed
  let userNetBalance = 0;
  if (ledger) {
    const isUser1 =
      user.uid === ledger.user1 ||
      (user.email && ledger.user1 && ledger.user1.includes(user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')));
    userNetBalance = isUser1 ? ledger.netBalance : -ledger.netBalance;
  }

  const formatINR = (val: number) => {
    return '₹' + Math.abs(Math.round(val)).toLocaleString('en-IN');
  };

  // Compute other person's owe amount
  const parsedTotal = parseFloat(totalAmount) || 0;
  let otherOweAmount = 0;
  if (isCustomMode) {
    otherOweAmount = parseFloat(customSplit) || 0;
  } else {
    otherOweAmount = Math.round((parsedTotal * splitRatio) / 100);
  }
  const myShareAmount = Math.max(0, parsedTotal - otherOweAmount);

  const handleOpenAddModal = () => {
    setPayer('me');
    setTotalAmount('');
    setExpenseDate(getTodayStr());
    setSplitRatio(50);
    setIsCustomMode(false);
    setCustomSplit('');
    setCategory('Groceries');
    setDescription('');
    setShowLogModal(true);
  };

  const handleSubmitSharedExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    const targetLedgerId =
      ledger?.id ||
      getLedgerId(user.uid, user.partnerUid, user.email, user.partnerEmail);

    if (!user.partnerUid && !user.partnerEmail) {
      showToast('Please connect with your roommate first in the Partner tab.');
      return;
    }

    if (parsedTotal <= 0) {
      showToast('Please enter an amount greater than ₹0');
      return;
    }

    const effectiveOwe = otherOweAmount > 0 ? otherOweAmount : Math.round(parsedTotal / 2);

    if (effectiveOwe > parsedTotal) {
      showToast("Roommate's share cannot exceed the total amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const paidByUid = payer === 'me' ? user.uid : (user.partnerUid || 'partner_rm');
      const paidByName = payer === 'me' ? user.displayName : partnerName;

      // Construct timestamp with selected date
      const [year, month, day] = expenseDate.split('-').map(Number);
      const now = new Date();
      const splitDate = new Date(
        year,
        month - 1,
        day,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      );

      const members: [string, string] = [user.uid, user.partnerUid || 'partner_rm'];

      await addSharedTransaction(
        targetLedgerId,
        {
          paidBy: paidByUid,
          paidByName,
          totalAmount: parsedTotal,
          splitAmountOther: effectiveOwe,
          category,
          description: description.trim() || `${category} Split`,
          timestamp: splitDate.toISOString(),
        },
        members
      );

      setShowLogModal(false);
      showToast(`Shared expense of ${formatINR(parsedTotal)} logged!`);
      setTotalAmount('');
      setDescription('');
      setCustomSplit('');
    } catch (err) {
      console.error('Error logging shared expense', err);
      showToast('Failed to record shared expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSettleUp = async () => {
    if (!ledger || !ledger.id || userNetBalance === 0) return;

    setIsSubmitting(true);
    try {
      // Determine who is paying whom
      // If userNetBalance < 0: current user owes partner -> payer is current user
      // If userNetBalance > 0: partner owes current user -> partner is marked as paying current user
      const amountToClear = Math.abs(userNetBalance);
      const payerUid = userNetBalance < 0 ? user.uid : (user.partnerUid || '');
      const payerName = userNetBalance < 0 ? user.displayName : partnerName;

      await settleUpLedger(ledger.id, payerUid, payerName, amountToClear);

      // Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#4edea3', '#10b981', '#adc6ff', '#ffffff'],
        });
      } catch {
        // ignore confetti failures
      }

      setShowSettleModal(false);
      showToast('Ledger completely settled up (₹0.00)!');
    } catch (err) {
      console.error('Error settling ledger', err);
      showToast('Could not clear settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If no partner linked
  if (!user.partnerUid) {
    return (
      <div className="flex flex-col gap-6 py-8 items-center text-center px-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#171f33] to-[#222a3d] border border-[#2d3449] flex items-center justify-center shadow-lg">
          <span className="material-symbols-outlined text-[36px] text-[#4edea3]">
            group_add
          </span>
        </div>

        <div className="flex flex-col gap-2 max-w-sm">
          <h2 className="text-xl font-bold font-headline text-[#dae2fd]">
            Connect Your Roommate
          </h2>
          <p className="text-xs text-[#bbcabf] leading-relaxed">
            Equilibrium runs a bilateral zero-sum netting engine. Once paired, any shared groceries, rent, or utilities automatically offset against each other into a single live balance.
          </p>
        </div>

        <div className="p-4 bg-[#171f33] rounded-2xl border border-[#2d3449] w-full max-w-sm flex flex-col gap-3">
          <div className="text-[11px] text-[#bbcabf] uppercase font-semibold tracking-wider">
            Your Pair Code
          </div>
          <div className="font-mono text-xl font-bold text-[#4edea3] tracking-wider bg-[#0b1326] py-2.5 rounded-xl border border-[#2d3449]">
            {user.pairCode || 'EQ-NONE'}
          </div>
          <p className="text-[11px] text-[#bbcabf]">
            Share this code with your roommate or enter theirs in the Partner tab.
          </p>
          <button
            onClick={onNavigateToPartner}
            className="w-full py-3 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] rounded-xl font-headline font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#4edea3]/20"
          >
            <span>Open Roommate Pairing</span>
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#171f33] border border-[#4edea3] text-[#4edea3] text-xs font-semibold rounded-full shadow-lg flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Screen 3 Header: Cumulative Settlement Headline */}
      <div className="relative overflow-hidden rounded-2xl p-5 border shadow-sm flex flex-col gap-4 bg-gradient-to-br from-[#171f33] to-[#131b2e] border-[#2d3449]">
        {/* Ambient Glow */}
        <div
          className={`absolute -right-8 -bottom-8 w-40 h-40 rounded-full blur-3xl pointer-events-none ${
            userNetBalance > 0
              ? 'bg-[#4edea3]/15'
              : userNetBalance < 0
              ? 'bg-[#ffb4ab]/15'
              : 'bg-[#adc6ff]/10'
          }`}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[#bbcabf] uppercase tracking-wider">
            Bilateral Zero-Sum Netting
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-[#0b1326] text-[#bbcabf] text-[11px] border border-[#2d3449]">
            Partner: <strong className="text-[#dae2fd]">{partnerName}</strong>
          </span>
        </div>

        {/* Dynamic Balance Headline Banner */}
        <div className="py-2">
          {userNetBalance > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4edea3]">
                <span className="material-symbols-outlined text-[18px]">
                  arrow_upward_alt
                </span>
                <span>You are owed</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#4edea3] font-headline tabular-nums tracking-tight">
                {partnerName} owes you {formatINR(userNetBalance)}
              </div>
            </div>
          )}

          {userNetBalance < 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#ffb4ab]">
                <span className="material-symbols-outlined text-[18px]">
                  arrow_downward_alt
                </span>
                <span>Outstanding Debt</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#ffb4ab] font-headline tabular-nums tracking-tight">
                You owe {partnerName} {formatINR(userNetBalance)}
              </div>
            </div>
          )}

          {userNetBalance === 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#4edea3]">
                <span className="material-symbols-outlined text-[18px]">
                  check_circle
                </span>
                <span>Perfect Equilibrium</span>
              </div>
              <div className="text-3xl sm:text-4xl font-extrabold text-[#dae2fd] font-headline tabular-nums tracking-tight">
                All Settled Up (₹0.00)
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons Row: Log Split & Settle Up */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#2d3449]/50">
          <button
            onClick={handleOpenAddModal}
            className="flex-1 py-3 bg-[#4edea3] hover:bg-[#6ffbbe] text-[#003824] rounded-xl font-headline font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px] font-bold">
              call_split
            </span>
            <span>Split Expense</span>
          </button>

          {userNetBalance !== 0 && (
            <button
              onClick={() => setShowSettleModal(true)}
              className="px-4 py-3 bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] border border-[#3c4a42] rounded-xl font-headline font-semibold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[18px] text-[#ffb95f]">
                handshake
              </span>
              <span>Settle Up</span>
            </button>
          )}
        </div>
      </div>

      {/* Shared Ledger Feed */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#dae2fd] font-headline">
              Shared Activity Stream
            </span>
            <span className="text-xs text-[#bbcabf] font-mono">
              ({transactions.length})
            </span>
          </div>
          <span className="text-[11px] text-[#bbcabf]">Real-time Netting</span>
        </div>

        {transactions.length === 0 ? (
          <div className="bg-[#171f33] rounded-2xl p-8 border border-[#2d3449]/70 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[#222a3d] flex items-center justify-center text-[#bbcabf]">
              <span className="material-symbols-outlined text-[24px]">
                receipt
              </span>
            </div>
            <p className="text-sm font-medium text-[#dae2fd]">No shared splits yet</p>
            <p className="text-xs text-[#bbcabf] max-w-xs">
              Tap "Split Expense" above whenever you or {partnerName} front money for groceries, food delivery, or bills.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {transactions.map((tx) => {
              const isSettlement = tx.isSettlement;
              const isMePayer = tx.paidBy === user.uid;
              const txDate = new Date(tx.timestamp);
              const formattedDate = txDate.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
              });
              const formattedTime = txDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={tx.id}
                  className={`rounded-xl p-3.5 border transition-colors shadow-sm flex items-center justify-between ${
                    isSettlement
                      ? 'bg-[#10b981]/10 border-[#10b981]/40'
                      : 'bg-[#171f33] hover:bg-[#1b253d] border-[#2d3449]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isSettlement
                          ? 'bg-[#10b981]/25 text-[#4edea3]'
                          : 'bg-[#222a3d] text-[#adc6ff]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {isSettlement ? 'check_circle' : 'receipt_long'}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-[#dae2fd] flex items-center gap-1.5">
                        <span>{tx.description || tx.category}</span>
                        {isSettlement && (
                          <span className="px-1.5 py-0.5 rounded bg-[#4edea3]/20 text-[#4edea3] text-[9px] font-bold">
                            SETTLED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#bbcabf] mt-0.5">
                        <strong className="text-[#dae2fd]">
                          {isMePayer ? 'You' : tx.paidByName}
                        </strong>{' '}
                        paid {formatINR(tx.totalAmount)} • {formattedDate}, {formattedTime}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {isSettlement ? (
                      <div>
                        <div className="text-xs font-bold text-[#4edea3] font-headline">
                          Cleared
                        </div>
                        <div className="text-[10px] text-[#bbcabf]">
                          {formatINR(tx.totalAmount)}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div
                          className={`text-xs font-bold font-headline tabular-nums ${
                            isMePayer ? 'text-[#4edea3]' : 'text-[#ffb4ab]'
                          }`}
                        >
                          {isMePayer ? `+${formatINR(tx.splitAmountOther)}` : `-${formatINR(tx.splitAmountOther)}`}
                        </div>
                        <div className="text-[10px] text-[#bbcabf]">
                          {isMePayer ? `${partnerName} owes` : 'You owe'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Shared Expense Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-[#171f33] rounded-t-3xl sm:rounded-2xl border border-[#2d3449] p-5 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#2d3449]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#4edea3]/15 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                    call_split
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#dae2fd] font-headline">
                  Split Shared Expense
                </h3>
              </div>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-[#bbcabf] hover:text-[#dae2fd] p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitSharedExpense} className="flex flex-col gap-4">
              {/* Who Paid Toggle */}
              <div>
                <label className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider block mb-1.5">
                  Who Fronted the Bill?
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#0b1326] p-1 rounded-xl border border-[#2d3449]">
                  <button
                    type="button"
                    onClick={() => setPayer('me')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      payer === 'me'
                        ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                        : 'text-[#bbcabf] hover:text-[#dae2fd]'
                    }`}
                  >
                    I Paid (Me)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayer('partner')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all ${
                      payer === 'partner'
                        ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                        : 'text-[#bbcabf] hover:text-[#dae2fd]'
                    }`}
                  >
                    {partnerName} Paid
                  </button>
                </div>
              </div>

              {/* Date of Expense */}
              <div>
                <label className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider block mb-1.5">
                  Date of Split
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    max={getTodayStr()}
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-xs font-semibold text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                  />
                </div>
              </div>

              {/* Total Amount Input */}
              <div>
                <label className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider block mb-1.5">
                  Total Amount Paid (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-[#4edea3]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    placeholder="E.g. 1200"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-[#0b1326] border border-[#2d3449] rounded-xl text-base font-bold text-[#dae2fd] placeholder-[#bbcabf]/40 focus:border-[#4edea3] focus:outline-none"
                  />
                </div>
              </div>

              {/* Split Division Mode */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider">
                    How much should the other person pay?
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomMode(!isCustomMode)}
                    className="text-[11px] text-[#4edea3] hover:underline"
                  >
                    {isCustomMode ? 'Use Percentage' : 'Enter Custom ₹'}
                  </button>
                </div>

                {!isCustomMode ? (
                  <div className="bg-[#0b1326] p-3 rounded-xl border border-[#2d3449] flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setSplitRatio(50)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          splitRatio === 50
                            ? 'bg-[#4edea3] text-[#003824]'
                            : 'bg-[#222a3d] text-[#bbcabf]'
                        }`}
                      >
                        50 / 50 Equal Split
                      </button>
                      <span className="font-bold text-[#4edea3] font-mono">
                        {splitRatio}% ({formatINR(otherOweAmount)})
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={splitRatio}
                      onChange={(e) => setSplitRatio(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-[#222a3d] rounded-lg appearance-none cursor-pointer accent-[#4edea3]"
                    />

                    <div className="flex justify-between text-[11px] text-[#bbcabf] font-mono">
                      <span>You: {formatINR(myShareAmount)}</span>
                      <span>{partnerName}: {formatINR(otherOweAmount)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#4edea3]">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="1"
                      placeholder={`Amount ${partnerName} owes`}
                      value={customSplit}
                      onChange={(e) => setCustomSplit(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-sm font-semibold text-[#dae2fd] placeholder-[#bbcabf]/40 focus:border-[#4edea3] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Category Picker */}
              <div>
                <label className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider block mb-1.5">
                  Category
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SHARED_CATEGORIES.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`p-2 rounded-xl text-[11px] flex flex-col items-center gap-1 transition-all border ${
                        category === cat.name
                          ? 'bg-[#4edea3]/20 border-[#4edea3] text-[#4edea3] font-bold'
                          : 'bg-[#0b1326] border-[#2d3449] text-[#bbcabf] hover:text-[#dae2fd]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {cat.icon}
                      </span>
                      <span className="truncate w-full text-center">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-semibold text-[#bbcabf] uppercase tracking-wider block mb-1.5">
                  Description / Note
                </label>
                <input
                  type="text"
                  placeholder="E.g. Sunday grocery haul at Nature's Basket"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-xs text-[#dae2fd] placeholder-[#bbcabf]/40 focus:border-[#4edea3] focus:outline-none"
                />
              </div>

              {/* Submit Split Button */}
              <button
                type="submit"
                disabled={isSubmitting || parsedTotal <= 0}
                className="w-full py-3.5 bg-gradient-to-r from-[#10b981] to-[#4edea3] text-[#003824] rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-[#10b981]/25 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">
                  check
                </span>
                <span>{isSubmitting ? 'Recording...' : 'Add Split to Ledger'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Action Sheet Modal */}
      {showSettleModal && (
        <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-md bg-[#171f33] rounded-t-3xl sm:rounded-2xl border border-[#2d3449] p-5 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#2d3449]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#ffb95f]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#ffb95f] text-[18px]">
                    handshake
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#dae2fd] font-headline">
                  Settle Up Bilateral Ledger
                </h3>
              </div>
              <button
                onClick={() => setShowSettleModal(false)}
                className="text-[#bbcabf] hover:text-[#dae2fd] p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="bg-[#0b1326] p-4 rounded-2xl border border-[#2d3449] text-center flex flex-col items-center gap-1">
              <span className="text-[11px] text-[#bbcabf] uppercase tracking-wider font-semibold">
                Settlement Amount
              </span>
              <div className="text-3xl font-extrabold font-headline text-[#4edea3] tabular-nums">
                {formatINR(userNetBalance)}
              </div>
              <p className="text-xs text-[#bbcabf] mt-1">
                {userNetBalance < 0
                  ? `You are transferring ${formatINR(userNetBalance)} to ${partnerName}`
                  : `${partnerName} is transferring ${formatINR(userNetBalance)} to you`}
              </p>
            </div>

            <div className="text-xs text-[#bbcabf] bg-[#222a3d]/50 p-3 rounded-xl border border-[#2d3449]/50 flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] text-[#adc6ff] shrink-0">
                info
              </span>
              <span>
                Confirming settlement will log a settlement receipt and reset the cumulative bilateral balance between you and {partnerName} to exactly ₹0.00.
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleConfirmSettleUp}
                disabled={isSubmitting}
                className="w-full py-3.5 bg-gradient-to-r from-[#10b981] to-[#4edea3] text-[#003824] rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-[#10b981]/25 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">
                  done_all
                </span>
                <span>{isSubmitting ? 'Clearing...' : 'Confirm Full Settlement'}</span>
              </button>

              <button
                onClick={() => setShowSettleModal(false)}
                className="w-full py-2.5 text-xs text-[#bbcabf] hover:text-[#dae2fd]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
