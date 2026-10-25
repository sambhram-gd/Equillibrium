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
      // Build ISO timestamp preserving selected date
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
    <div className="flex flex-col gap-5 pb-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#171f33] border border-[#4edea3] text-[#4edea3] text-xs font-semibold rounded-full shadow-lg flex items-center gap-2 animate-in fade-in duration-200">
          <span className="material-symbols-outlined text-[16px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Summary Metrics Section */}
      <div className="flex flex-col gap-3">
        {/* Current Balance Hero Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#171f33] to-[#131b2e] rounded-2xl p-5 border border-[#2d3449]/70 shadow-sm flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-[#4edea3]/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[#bbcabf] uppercase tracking-wider">
              Current Liquid Balance
            </span>
            <div className="px-2.5 py-1 rounded-full bg-[#4edea3]/15 text-[#4edea3] text-[11px] font-semibold flex items-center gap-1 border border-[#4edea3]/20">
              <span className="material-symbols-outlined text-[13px]">account_balance</span>
              Live Vault
            </div>
          </div>

          <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#dae2fd] font-headline tabular-nums my-1">
            {formatINR(currentLiquidBalance)}
          </div>

          <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#2d3449]/50">
            <div className="flex items-center gap-1.5 text-xs text-[#bbcabf]">
              <span className="material-symbols-outlined text-[15px] text-[#4edea3]">
                savings
              </span>
              <span>
                Available Cash
                {user.salaryAmount ? ` • Salary ${formatINR(user.salaryAmount)}` : ''}
              </span>
            </div>
            <button
              onClick={onOpenIncomeModal}
              className="text-xs text-[#4edea3] font-semibold flex items-center gap-1 hover:text-[#6ffbbe] active:scale-95 transition-all"
            >
              Deposit / Salary
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Secondary Metrics: Monthly Budget Meter */}
        <div className="bg-[#171f33] rounded-2xl p-4 border border-[#2d3449]/70 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#bbcabf] uppercase tracking-wider">
              Monthly Budget Burndown
            </span>
            <span
              className={`text-xs font-bold ${
                budgetPercent > 85 ? 'text-[#ffb4ab]' : 'text-[#4edea3]'
              }`}
            >
              {budgetPercent}% Used
            </span>
          </div>

          <div className="text-base font-bold text-[#dae2fd] font-headline tabular-nums mb-2">
            {formatINR(monthlySpent)}{' '}
            <span className="text-xs text-[#bbcabf] font-normal">
              / {formatINR(budgetCap)} cap
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#2d3449] h-2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                budgetPercent > 85 ? 'bg-[#ffb4ab]' : 'bg-[#4edea3]'
              }`}
              style={{ width: `${budgetPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Daily Expense Line Graph (Replaces Last Salary Card) */}
        <DailyExpenseChart
          logs={logs}
          salaryDate={user.salaryDate}
        />
      </div>

      {/* Rapid Log Engine */}
      <div className="bg-[#171f33] rounded-2xl p-4 sm:p-5 border border-[#2d3449] shadow-sm flex flex-col gap-4">
        {/* Rapid Log Header with Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#4edea3]/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#4edea3] text-[18px]">
                bolt
              </span>
            </div>
            <span className="text-sm font-bold text-[#dae2fd] font-headline">
              Rapid Log Engine
            </span>
          </div>

          {/* Mode Toggle Slider / Numpad */}
          <div className="bg-[#0b1326] p-1 rounded-xl flex items-center gap-1 border border-[#2d3449]">
            <button
              onClick={() => setLogMode('slider')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                logMode === 'slider'
                  ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                  : 'text-[#bbcabf] hover:text-[#dae2fd]'
              }`}
            >
              Slider
            </button>
            <button
              onClick={() => setLogMode('numpad')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                logMode === 'numpad'
                  ? 'bg-[#4edea3] text-[#003824] shadow-sm'
                  : 'text-[#bbcabf] hover:text-[#dae2fd]'
              }`}
            >
              Numpad
            </button>
          </div>
        </div>

        {/* Live Amount Display */}
        <div className="text-center py-2 bg-[#0b1326]/50 rounded-xl border border-[#2d3449]/40">
          <span className="text-[10px] text-[#bbcabf] uppercase tracking-wider font-semibold">
            Expense Amount
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-[#4edea3] font-headline tabular-nums mt-0.5 tracking-tight">
            {formatINR(amount)}
          </div>
        </div>

        {/* Date Selector Bar (Allows logging past dates since last salary) */}
        <div className="bg-[#0b1326] p-2.5 rounded-xl border border-[#2d3449] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-[#bbcabf]">
              <span className="material-symbols-outlined text-[#4edea3] text-[16px]">
                calendar_today
              </span>
              <span className="font-medium">Log Date:</span>
              <strong className="text-[#dae2fd]">{formatDisplayDate(selectedDate)}</strong>
            </div>

            {/* Quick date pills */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(todayStr);
                  setShowDatePicker(false);
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  selectedDate === todayStr && !showDatePicker
                    ? 'bg-[#4edea3] text-[#003824]'
                    : 'bg-[#171f33] text-[#bbcabf] hover:text-[#dae2fd]'
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
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  selectedDate === yesterdayStr && !showDatePicker
                    ? 'bg-[#4edea3] text-[#003824]'
                    : 'bg-[#171f33] text-[#bbcabf] hover:text-[#dae2fd]'
                }`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-0.5 transition-all ${
                  showDatePicker || (selectedDate !== todayStr && selectedDate !== yesterdayStr)
                    ? 'bg-[#4edea3] text-[#003824]'
                    : 'bg-[#171f33] text-[#bbcabf] hover:text-[#dae2fd]'
                }`}
                title="Pick exact past date"
              >
                <span>Pick Date</span>
                <span className="material-symbols-outlined text-[13px]">
                  {showDatePicker ? 'expand_less' : 'event'}
                </span>
              </button>
            </div>
          </div>

          {/* Interactive Date Picker Input */}
          {showDatePicker && (
            <div className="pt-2 border-t border-[#2d3449]/60 flex items-center gap-2 animate-in fade-in duration-100">
              <span className="text-[11px] text-[#bbcabf] whitespace-nowrap">
                Select past date:
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
                className="flex-1 bg-[#171f33] border border-[#2d3449] rounded-lg px-2.5 py-1 text-xs text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* One-Tap Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-95 ${
                  isSelected
                    ? 'bg-[#4edea3] text-[#003824] font-semibold shadow-sm shadow-[#4edea3]/20'
                    : 'bg-[#222a3d] text-[#bbcabf] hover:bg-[#2d3449] hover:text-[#dae2fd]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {cat.icon}
                </span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Mode A: Granular Slider View */}
        {logMode === 'slider' && (
          <div className="flex flex-col gap-3.5 pt-1">
            <div className="flex items-center gap-3">
              {/* Dedicated -1 Button */}
              <button
                onClick={() => adjustOddFineTune(-1)}
                className="w-12 h-12 rounded-xl bg-[#222a3d] hover:bg-[#2d3449] active:scale-90 text-[#dae2fd] border border-[#3c4a42] flex items-center justify-center font-bold text-base transition-all select-none shadow-sm"
                title="Subtract 1 for odd amounts"
              >
                -1
              </button>

              {/* Slider (Strict Range: 0 to 200, Step: 2) */}
              <div className="flex-1 flex flex-col gap-1.5">
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="2"
                  value={Math.min(200, amount)}
                  onChange={handleSliderChange}
                  className="w-full h-2.5 bg-[#222a3d] rounded-lg appearance-none cursor-pointer accent-[#4edea3]"
                />
                <div className="flex justify-between text-[10px] text-[#bbcabf] font-mono px-1">
                  <span>₹0</span>
                  <span className="text-[#bbcabf]/60">₹50</span>
                  <span className="text-[#bbcabf]/60">₹100</span>
                  <span className="text-[#bbcabf]/60">₹150</span>
                  <span className="text-[#4edea3] font-semibold">₹200</span>
                </div>
              </div>

              {/* Dedicated +1 Button */}
              <button
                onClick={() => adjustOddFineTune(1)}
                className="w-12 h-12 rounded-xl bg-[#222a3d] hover:bg-[#2d3449] active:scale-90 text-[#dae2fd] border border-[#3c4a42] flex items-center justify-center font-bold text-base transition-all select-none shadow-sm"
                title="Add 1 for odd amounts"
              >
                +1
              </button>
            </div>
          </div>
        )}

        {/* Mode B: Custom Numeric Keypad View */}
        {logMode === 'numpad' && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleNumpadDigit(digit)}
                  className="h-12 bg-[#222a3d]/80 hover:bg-[#2d3449] active:bg-[#4edea3]/20 active:scale-95 text-[#dae2fd] rounded-xl font-headline font-bold text-lg border border-[#2d3449] transition-all flex items-center justify-center select-none"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={() => handleNumpadDigit('00')}
                className="h-12 bg-[#222a3d]/80 hover:bg-[#2d3449] active:scale-95 text-[#dae2fd] rounded-xl font-headline font-bold text-base border border-[#2d3449] transition-all flex items-center justify-center select-none"
              >
                00
              </button>
              <button
                onClick={() => handleNumpadDigit('0')}
                className="h-12 bg-[#222a3d]/80 hover:bg-[#2d3449] active:scale-95 text-[#dae2fd] rounded-xl font-headline font-bold text-lg border border-[#2d3449] transition-all flex items-center justify-center select-none"
              >
                0
              </button>
              <button
                onClick={handleNumpadBackspace}
                className="h-12 bg-[#222a3d]/80 hover:bg-[#2d3449] active:scale-95 text-[#ffb4ab] rounded-xl border border-[#2d3449] transition-all flex items-center justify-center select-none"
                title="Backspace"
              >
                <span className="material-symbols-outlined text-[20px]">backspace</span>
              </button>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleNumpadClear}
                className="text-[11px] text-[#bbcabf] hover:text-[#dae2fd] underline px-2 py-0.5"
              >
                Clear (C)
              </button>
            </div>
          </div>
        )}

        {/* Optional Note & Details Toggle */}
        <div className="flex flex-col gap-2">
          {!showNoteField ? (
            <button
              onClick={() => setShowNoteField(true)}
              className="text-xs text-[#bbcabf] hover:text-[#4edea3] flex items-center gap-1 self-start transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">edit_note</span>
              <span>Add description or note</span>
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="E.g. Blue Bottle latte, Uber ride to office"
                value={note}
                maxLength={100}
                onChange={(e) => setNote(e.target.value)}
                className="flex-1 bg-[#0b1326] border border-[#2d3449] rounded-xl px-3 py-2 text-xs text-[#dae2fd] placeholder-[#bbcabf]/50 focus:border-[#4edea3] focus:outline-none"
              />
              <button
                onClick={() => setShowNoteField(false)}
                className="text-xs text-[#bbcabf] hover:text-[#ffb4ab]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleLogExpense}
          disabled={isSubmitting || amount <= 0}
          className="w-full py-3.5 bg-gradient-to-r from-[#10b981] to-[#4edea3] text-[#003824] rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-md shadow-[#10b981]/25 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[20px] font-bold">
            check
          </span>
          <span>{isSubmitting ? 'Logging...' : `Log Expense for ${formatDisplayDate(selectedDate)}`}</span>
        </button>
      </div>

      {/* Personal Passbook Feed */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#dae2fd] font-headline">
              Personal Passbook
            </span>
            <span className="text-xs text-[#bbcabf] font-mono">
              ({filteredLogs.length})
            </span>
          </div>

          {/* Period Filter Tabs */}
          <div className="bg-[#171f33] p-1 rounded-lg border border-[#2d3449] flex items-center gap-1">
            {(['all', 'today', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setFilterPeriod(period)}
                className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-all ${
                  filterPeriod === period
                    ? 'bg-[#4edea3] text-[#003824] font-semibold'
                    : 'text-[#bbcabf] hover:text-[#dae2fd]'
                }`}
              >
                {period === 'week' ? 'Week' : period === 'month' ? 'Month' : period}
              </button>
            ))}
          </div>
        </div>

        {/* Log Entries List */}
        {filteredLogs.length === 0 ? (
          <div className="bg-[#171f33] rounded-2xl p-8 border border-[#2d3449]/70 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[#222a3d] flex items-center justify-center text-[#bbcabf]">
              <span className="material-symbols-outlined text-[24px]">
                receipt_long
              </span>
            </div>
            <p className="text-sm font-medium text-[#dae2fd]">No expenses logged yet</p>
            <p className="text-xs text-[#bbcabf] max-w-xs">
              Use the Rapid Log Engine above to track your daily coffee, transport, or groceries for any date.
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
                  className="bg-[#171f33] hover:bg-[#1b253d] rounded-xl p-3.5 border border-[#2d3449]/60 flex items-center justify-between transition-colors shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        isDebit
                          ? 'bg-[#222a3d] text-[#4edea3]'
                          : 'bg-[#10b981]/20 text-[#4edea3]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {getCategoryIcon(log.category)}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-[#dae2fd] flex items-center gap-1.5">
                        <span>{log.note || log.category}</span>
                        {log.note && (
                          <span className="text-[10px] text-[#bbcabf] font-normal">
                            ({log.category})
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#bbcabf] mt-0.5">
                        {formattedDate}, {formattedTime}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`text-xs font-bold font-headline tabular-nums ${
                          isDebit ? 'text-[#ffb4ab]' : 'text-[#4edea3]'
                        }`}
                      >
                        {isDebit ? '-' : '+'}
                        {formatINR(log.amount)}
                      </div>
                      <div className="text-[10px] text-[#bbcabf]">
                        {isDebit ? 'Personal Debit' : 'Credit'}
                      </div>
                    </div>

                    {/* Delete log action */}
                    <button
                      onClick={() => handleDeleteLog(log)}
                      className="p-1 rounded text-[#bbcabf] hover:text-[#ffb4ab] hover:bg-[#93000a]/20 transition-colors"
                      title="Delete log"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        delete
                      </span>
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
