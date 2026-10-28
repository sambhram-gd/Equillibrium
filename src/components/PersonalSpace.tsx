import React, { useState } from 'react';
import { UserProfile, PersonalLog, PersonalLogCategory } from '../types';
import {
  addPersonalLog,
  deletePersonalLog,
  filterLogsByPeriod,
  calculateMonthlySpend,
} from '../services/personalLogService';
import { DailyExpenseChart } from './DailyExpenseChart';

interface PersonalSpaceProps {
  user: UserProfile;
  logs: PersonalLog[];
  onOpenIncomeModal: () => void;
}

const CATEGORIES: { name: PersonalLogCategory; icon: string }[] = [
  { name: 'Coffee', icon: 'local_cafe' },
  { name: 'Breakfast', icon: 'bakery_dining' },
  { name: 'Metro', icon: 'subway' },
  { name: 'Bus', icon: 'directions_bus' },
  { name: 'Lunch', icon: 'lunch_dining' },
  { name: 'Dinner', icon: 'dinner_dining' },
  { name: 'Groceries', icon: 'shopping_cart' },
  { name: 'Utilities', icon: 'bolt' },
  { name: 'Misc', icon: 'category' },
];

export const PersonalSpace: React.FC<PersonalSpaceProps> = ({
  user,
  logs,
  onOpenIncomeModal,
}) => {
  const [logMode, setLogMode] = useState<'slider' | 'numpad'>('slider');
  const [amount, setAmount] = useState<number>(40);
  const sliderMax = 200;
  const [selectedCategory, setSelectedCategory] = useState<PersonalLogCategory>('Coffee');
  const [note, setNote] = useState<string>('');
  const [showNoteField, setShowNoteField] = useState<boolean>(false);
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Date selection state
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayStr();
  const yesterdayStr = getYesterdayStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Calculate Monthly Spent
  const monthlySpent = calculateMonthlySpend(logs);
  const budgetCap = user.monthlyBudget || 30000;
  const budgetPercent = Math.min(100, Math.round((monthlySpent / budgetCap) * 100));

  // Calculate liquid balance
  const currentLiquidBalance = user.currentBalance ?? 0;

  // Format currency helper
  const formatINR = (val: number) => {
    return '₹' + Math.round(val).toLocaleString('en-IN');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Adjust amount via ±1 buttons (clamped between 0 and 200)
  const adjustOddFineTune = (delta: number) => {
    setAmount((prev) => {
      return Math.max(0, Math.min(sliderMax, prev + delta));
    });
  };

  // Slider change (range 0 to 200, step = 2)
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10) || 0;
    setAmount(Math.max(0, Math.min(sliderMax, val)));
  };

  // Numpad inputs
  const handleNumpadDigit = (digit: string) => {
    if (digit === '00') {
      if (amount === 0) return;
      const str = amount.toString() + '00';
      if (str.length > 7) return;
      const val = parseInt(str, 10);
      setAmount(val);
      return;
    }

    if (amount === 0) {
      setAmount(parseInt(digit, 10));
    } else {
      const str = amount.toString() + digit;
      if (str.length > 7) return;
      const val = parseInt(str, 10);
      setAmount(val);
    }
  };

  const handleNumpadBackspace = () => {
    const str = amount.toString();
    if (str.length <= 1) {
      setAmount(0);
    } else {
      setAmount(parseInt(str.slice(0, -1), 10));
    }
  };

  const handleNumpadClear = () => {
    setAmount(0);
  };

  // Format selected date for display
  const formatDisplayDate = (dStr: string) => {
    if (dStr === todayStr) return 'Today';
    if (dStr === yesterdayStr) return 'Yesterday';
    const [year, month, day] = dStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Submit expense log
  const handleLogExpense = async () => {
    if (amount <= 0) {
      showToast('Please enter an amount greater than ₹0');
      return;
    }

    setIsSubmitting(true);
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const now = new Date();
      const logDate = new Date(
        year,
        month - 1,
        day,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds()
      );

      await addPersonalLog(user.uid, {
        amount,
        category: selectedCategory,
        type: 'debit',
        timestamp: logDate.toISOString(),
        note: note.trim() || undefined,
      });

      showToast(`Logged ${formatINR(amount)} for ${selectedCategory} (${formatDisplayDate(selectedDate)})`);
      setAmount(0);
      setNote('');
      setShowNoteField(false);
    } catch (err) {
      console.error('Failed to log expense', err);
      showToast('Error recording expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteLog = async (log: PersonalLog) => {
    if (!log.id) return;
    try {
      await deletePersonalLog(user.uid, log.id, log);
      showToast(`Reverted ${formatINR(log.amount)}`);
    } catch (err) {
      console.error('Failed to delete log', err);
    }
  };

  const filteredLogs = filterLogsByPeriod(logs, filterPeriod);

  // Category Icon Resolver
  const getCategoryIcon = (category: string) => {
    const found = CATEGORIES.find(
      (c) => c.name.toLowerCase() === category.toLowerCase()
    );
    if (found) return found.icon;
    if (category.toLowerCase().includes('salary')) return 'payments';
    return 'receipt';
  };

  return (
    <div className="flex flex-col gap-5 pb-12 select-none">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#0e1629]/95 border border-[#34d399]/40 text-[#34d399] text-xs font-bold rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span className="font-headline tracking-tight">{toastMessage}</span>
        </div>
      )}

      {/* Summary Metrics Section */}
      <div className="flex flex-col gap-3.5">
        {/* Current Balance Hero Card */}
        <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-[#121a2d] to-[#0a1120] border border-white/[0.08] shadow-[0_10px_35px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.08)] flex flex-col justify-between">
          {/* Subtle Ambient Radial Lighting */}
          <div className="absolute -right-8 -bottom-8 w-48 h-48 bg-[#34d399]/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider font-headline">
              Current Liquid Balance
            </span>
            <div className="px-3 py-1 rounded-full bg-[#34d399]/15 text-[#34d399] text-[11px] font-bold flex items-center gap-1.5 border border-[#34d399]/25 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse"></span>
              <span>Live Vault</span>
            </div>
          </div>

          <div className="text-4xl sm:text-5xl font-black tracking-tight text-white font-headline tabular-nums my-1.5">
            {formatINR(currentLiquidBalance)}
          </div>

          <div className="flex items-center justify-between pt-3.5 mt-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
              <span className="material-symbols-outlined text-[16px] text-[#34d399]">
                savings
              </span>
              <span>
                Available Cash
                {user.salaryAmount ? ` • ${formatINR(user.salaryAmount)}/mo` : ''}
              </span>
            </div>
            <button
              onClick={onOpenIncomeModal}
              className="text-xs font-bold text-[#34d399] flex items-center gap-1 hover:text-[#6ffbbe] active:scale-95 transition-all font-headline"
            >
              <span>+ Add Funds</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Secondary Metrics: Monthly Budget Meter */}
        <div className="rounded-3xl p-5 bg-[#121a2d]/90 border border-white/[0.08] flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-[#94a3b8] uppercase tracking-wider font-headline">
              Monthly Budget Burndown
            </span>
            <span
              className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                budgetPercent > 85
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/25'
              }`}
            >
              {budgetPercent}% Used
            </span>
          </div>

          <div className="text-base font-extrabold text-white font-headline tabular-nums mb-2.5">
            {formatINR(monthlySpent)}{' '}
            <span className="text-xs text-[#94a3b8] font-normal">
              / {formatINR(budgetCap)} monthly cap
            </span>
          </div>

          {/* Precision Progress Bar */}
          <div className="w-full bg-[#1e293b] h-2.5 rounded-full overflow-hidden p-0.5 ring-1 ring-white/[0.05]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                budgetPercent > 85
                  ? 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-[0_0_12px_rgba(244,63,94,0.5)]'
                  : 'bg-gradient-to-r from-[#059669] to-[#34d399] shadow-[0_0_12px_rgba(52,211,153,0.5)]'
              }`}
              style={{ width: `${budgetPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Interactive Expense Chart */}
        <DailyExpenseChart logs={logs} salaryDate={user.salaryDate} />
      </div>

      {/* Rapid Log Console Card */}
      <div className="rounded-3xl p-5 bg-[#121a2d]/95 border border-white/[0.09] shadow-[0_12px_36px_rgba(0,0,0,0.45),inset_0_1px_1px_rgba(255,255,255,0.08)] backdrop-blur-2xl flex flex-col gap-4">
        {/* Header with Segmented Switcher */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#34d399]/15 flex items-center justify-center text-[#34d399] ring-1 ring-[#34d399]/30 shadow-sm">
              <span className="material-symbols-outlined text-[18px]">bolt</span>
            </div>
            <span className="text-sm font-extrabold text-white font-headline tracking-tight">
              Rapid Log Console
            </span>
          </div>

          {/* Segmented Mode Controller */}
          <div className="bg-[#070c18] p-1 rounded-2xl flex items-center gap-1 border border-white/[0.08]">
            <button
              onClick={() => setLogMode('slider')}
              className={`px-3 py-1 rounded-xl text-xs font-bold font-headline transition-all duration-150 ${
                logMode === 'slider'
                  ? 'bg-gradient-to-r from-[#059669] to-[#10b981] text-[#013421] shadow-md shadow-[#10b981]/25'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Slider
            </button>
            <button
              onClick={() => setLogMode('numpad')}
              className={`px-3 py-1 rounded-xl text-xs font-bold font-headline transition-all duration-150 ${
                logMode === 'numpad'
                  ? 'bg-gradient-to-r from-[#059669] to-[#10b981] text-[#013421] shadow-md shadow-[#10b981]/25'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Numpad
            </button>
          </div>
        </div>

        {/* Live Amount Hero Ticker */}
        <div className="text-center py-3 bg-[#070c18]/80 rounded-2xl border border-white/[0.06] shadow-inner">
          <span className="text-[10px] text-[#94a3b8] uppercase font-bold tracking-wider font-headline">
            Selected Amount
          </span>
          <div className="text-4xl sm:text-5xl font-black text-[#34d399] font-headline tabular-nums mt-0.5 tracking-tight flex items-center justify-center gap-1">
            <span className="text-2xl text-[#34d399]/60 font-semibold font-sans">₹</span>
            <span>{Math.round(amount).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Date Selector Navigation Bar */}
        <div className="bg-[#070c18]/70 p-3 rounded-2xl border border-white/[0.06] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#94a3b8]">
              <span className="material-symbols-outlined text-[#34d399] text-[16px]">
                calendar_today
              </span>
              <span className="font-semibold">Date:</span>
              <strong className="text-white font-headline">{formatDisplayDate(selectedDate)}</strong>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(todayStr);
                  setShowDatePicker(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-headline transition-all ${
                  selectedDate === todayStr && !showDatePicker
                    ? 'bg-[#34d399] text-[#013421]'
                    : 'bg-white/[0.06] text-[#94a3b8] hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(yesterdayStr);
                  setShowDatePicker(false);
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-headline transition-all ${
                  selectedDate === yesterdayStr && !showDatePicker
                    ? 'bg-[#34d399] text-[#013421]'
                    : 'bg-white/[0.06] text-[#94a3b8] hover:text-white'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-headline flex items-center gap-1 transition-all ${
                  showDatePicker || (selectedDate !== todayStr && selectedDate !== yesterdayStr)
                    ? 'bg-[#34d399] text-[#013421]'
                    : 'bg-white/[0.06] text-[#94a3b8] hover:text-white'
                }`}
              >
                <span>Pick</span>
                <span className="material-symbols-outlined text-[13px]">
                  {showDatePicker ? 'expand_less' : 'event'}
                </span>
              </button>
            </div>
          </div>

          {showDatePicker && (
            <div className="pt-2.5 border-t border-white/[0.06] flex items-center gap-2 animate-in fade-in duration-100">
              <span className="text-[11px] text-[#94a3b8] whitespace-nowrap">
                Calendar date:
              </span>
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                  }
                }}
                className="flex-1 bg-[#121a2d] border border-white/[0.12] rounded-xl px-3 py-1.5 text-xs text-white focus:border-[#34d399] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* Category Horizontal Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold font-headline whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-95 shadow-sm ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#059669] to-[#34d399] text-[#013421] shadow-md shadow-[#10b981]/25 ring-1 ring-white/20'
                    : 'bg-white/[0.06] text-[#94a3b8] hover:bg-white/[0.1] hover:text-white border border-white/[0.05]'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {cat.icon}
                </span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Mode A: Tactile Slider View */}
        {logMode === 'slider' && (
          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center gap-3">
              {/* Stepper -1 Button */}
              <button
                onClick={() => adjustOddFineTune(-1)}
                className="w-13 h-13 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] active:scale-90 text-white border border-white/[0.1] flex items-center justify-center font-black font-headline text-base transition-all select-none shadow-sm"
                title="Subtract 1 for odd amounts"
              >
                -1
              </button>

              {/* Slider Track */}
              <div className="flex-1 flex flex-col gap-1.5">
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="2"
                  value={Math.min(200, amount)}
                  onChange={handleSliderChange}
                  className="w-full h-3 bg-[#1e293b] rounded-lg appearance-none cursor-pointer accent-[#34d399]"
                />
                <div className="flex justify-between text-[10px] text-[#94a3b8] font-mono px-1">
                  <span>₹0</span>
                  <span className="text-[#94a3b8]/60">₹50</span>
                  <span className="text-[#94a3b8]/60">₹100</span>
                  <span className="text-[#94a3b8]/60">₹150</span>
                  <span className="text-[#34d399] font-bold">₹200</span>
                </div>
              </div>

              {/* Stepper +1 Button */}
              <button
                onClick={() => adjustOddFineTune(1)}
                className="w-13 h-13 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] active:scale-90 text-white border border-white/[0.1] flex items-center justify-center font-black font-headline text-base transition-all select-none shadow-sm"
                title="Add 1 for odd amounts"
              >
                +1
              </button>
            </div>
          </div>
        )}

        {/* Mode B: Tactile Numeric Keypad */}
        {logMode === 'numpad' && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleNumpadDigit(digit)}
                  className="h-12 bg-white/[0.06] hover:bg-white/[0.1] active:bg-[#34d399]/25 active:scale-95 text-white rounded-2xl font-headline font-black text-lg border border-white/[0.07] transition-all flex items-center justify-center select-none shadow-sm"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => handleNumpadDigit('00')}
                className="h-12 bg-white/[0.06] hover:bg-white/[0.1] active:scale-95 text-white rounded-2xl font-headline font-black text-base border border-white/[0.07] transition-all flex items-center justify-center select-none shadow-sm"
              >
                00
              </button>
              <button
                onClick={() => handleNumpadDigit('0')}
                className="h-12 bg-white/[0.06] hover:bg-white/[0.1] active:scale-95 text-white rounded-2xl font-headline font-black text-lg border border-white/[0.07] transition-all flex items-center justify-center select-none shadow-sm"
              >
                0
              </button>
              <button
                onClick={handleNumpadBackspace}
                className="h-12 bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-300 rounded-2xl border border-rose-500/25 transition-all flex items-center justify-center select-none shadow-sm"
                title="Backspace"
              >
                <span className="material-symbols-outlined text-[20px]">backspace</span>
              </button>
            </div>
            <div className="flex justify-end pt-1">
              <button
                onClick={handleNumpadClear}
                className="text-[11px] font-bold text-[#94a3b8] hover:text-white underline px-2 py-0.5"
              >
                Clear Amount
              </button>
            </div>
          </div>
        )}

        {/* Optional Note Field */}
        <div className="flex flex-col gap-2">
          {!showNoteField ? (
            <button
              onClick={() => setShowNoteField(true)}
              className="text-xs font-semibold text-[#94a3b8] hover:text-[#34d399] flex items-center gap-1.5 self-start transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">edit_note</span>
              <span>Add description or note</span>
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="E.g. Blue Bottle latte, Swiggy order, cab"
                value={note}
                maxLength={100}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 bg-[#070c18] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-[#94a3b8]/50 focus:border-[#34d399] focus:outline-none"
              />
              <button
                onClick={() => setShowNoteField(false)}
                className="text-xs font-bold text-[#94a3b8] hover:text-rose-300 px-2"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Primary Luxury CTA: Log Expense */}
        <button
          onClick={handleLogExpense}
          disabled={isSubmitting || amount <= 0}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#059669] via-[#10b981] to-[#34d399] text-[#013421] font-headline font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-[0_4px_24px_rgba(16,185,129,0.35)] ring-1 ring-white/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px] font-black">
            check
          </span>
          <span>
            {isSubmitting ? 'Recording...' : `Log Expense for ${formatDisplayDate(selectedDate)}`}
          </span>
        </button>
      </div>

      {/* Personal Passbook Feed Section */}
      <div className="flex flex-col gap-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-white font-headline tracking-tight">
              Personal Passbook
            </span>
            <span className="text-xs text-[#94a3b8] font-mono px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08]">
              {filteredLogs.length}
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

        {/* Log Entries List */}
        {filteredLogs.length === 0 ? (
          <div className="rounded-3xl p-8 bg-[#121a2d]/80 border border-white/[0.08] text-center flex flex-col items-center justify-center gap-2 backdrop-blur-xl">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.06] flex items-center justify-center text-[#94a3b8]">
              <span className="material-symbols-outlined text-[24px]">receipt_long</span>
            </div>
            <p className="text-sm font-bold text-white font-headline">No expenses logged yet</p>
            <p className="text-xs text-[#94a3b8] max-w-xs">
              Use the Rapid Log Console above to log daily spend with instant balance updating.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredLogs.map((log) => {
              const isDebit = log.type === 'debit';
              const logDate = new Date(log.timestamp);
              const formattedDate = logDate.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: logDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
              });
              const formattedTime = logDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={log.id}
                  className="rounded-2xl p-4 bg-[#121a2d]/80 hover:bg-[#18233c] border border-white/[0.07] flex items-center justify-between transition-all duration-150 shadow-sm backdrop-blur-xl"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-sm ${
                        isDebit
                          ? 'bg-white/[0.06] text-[#34d399] border border-white/[0.08]'
                          : 'bg-[#34d399]/20 text-[#34d399] border border-[#34d399]/30'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {getCategoryIcon(log.category)}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5 font-headline">
                        <span>{log.note || log.category}</span>
                        {log.note && (
                          <span className="text-[10px] text-[#94a3b8] font-normal">
                            ({log.category})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5">
                        {formattedDate}, {formattedTime}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`text-xs font-black font-headline tabular-nums ${
                          isDebit ? 'text-rose-300' : 'text-[#34d399]'
                        }`}
                      >
                        {isDebit ? '-' : '+'}
                        {formatINR(log.amount)}
                      </div>
                      <div className="text-[10px] text-[#94a3b8]">
                        {isDebit ? 'Personal Debit' : 'Credit'}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteLog(log)}
                      className="p-1.5 rounded-lg text-[#94a3b8] hover:text-rose-300 hover:bg-rose-500/15 transition-all active:scale-90"
                      title="Delete log"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
