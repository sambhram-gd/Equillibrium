import React, { useState, useEffect } from 'react';
import { UserProfile, PersonalLog, PersonalLogCategory } from '../types';
import { updatePersonalLog } from '../services/personalLogService';

interface EditLogModalProps {
  user: UserProfile;
  log: PersonalLog | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: PersonalLog) => void;
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

export const EditLogModal: React.FC<EditLogModalProps> = ({
  user,
  log,
  isOpen,
  onClose,
  onSuccess,
}) => {
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

  const [amount, setAmount] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Misc');
  const [isSalary, setIsSalary] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (log) {
      setAmount(log.amount.toString());
      setNote(log.note || '');
      setSelectedCategory(log.category);

      const isSal = log.category.toLowerCase().includes('salary');
      setIsSalary(isSal);

      if (log.timestamp) {
        const d = new Date(log.timestamp);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setSelectedDate(`${y}-${m}-${day}`);
      } else {
        setSelectedDate(todayStr);
      }
      setShowDatePicker(false);
    }
  }, [log]);

  if (!isOpen || !log) return null;

  const isCredit = log.type === 'credit';

  const formatDisplayDate = (dStr: string) => {
    if (dStr === todayStr) return 'Today';
    if (dStr === yesterdayStr) return 'Yesterday';
    const [year, month, day] = dStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount) || 0;
    if (val <= 0 || !log.id) return;

    setIsSubmitting(true);
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const originalDate = new Date(log.timestamp);
      const updatedDate = new Date(
        year,
        month - 1,
        day,
        originalDate.getHours() || 12,
        originalDate.getMinutes() || 0,
        originalDate.getSeconds() || 0
      );

      let categoryToSave = selectedCategory;
      if (isCredit) {
        categoryToSave = isSalary ? 'Salary' : 'Deposit';
      }

      const updatedLog: PersonalLog = {
        ...log,
        amount: val,
        category: categoryToSave,
        timestamp: updatedDate.toISOString(),
        note: note.trim() || undefined,
      };

      await updatePersonalLog(user.uid, log.id, updatedLog, log);
      onSuccess(updatedLog);
      onClose();
    } catch (err) {
      console.error('Failed to update log', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#040812]/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="w-full max-w-sm bg-[#121a2d] rounded-t-3xl sm:rounded-3xl border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 pb-safe max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto sm:hidden mb-1" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isCredit
                  ? 'bg-[#10b981]/20 text-[#34d399]'
                  : 'bg-white/10 text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">
                {isCredit ? 'payments' : 'edit'}
              </span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-headline">
                {isCredit ? 'Edit Credit / Salary' : 'Edit Expense Log'}
              </h3>
              <p className="text-[10px] text-[#94a3b8]">
                {isCredit ? 'Income entry' : 'Personal debit'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1c263c] text-[#a0aec0] hover:text-white flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* If Credit: Salary vs Other Deposit */}
          {isCredit && (
            <div className="grid grid-cols-2 gap-2 bg-[#070c18] p-1.5 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsSalary(true);
                  if (!note || note === 'Bank Transfer / Deposit') {
                    setNote('Monthly Salary');
                  }
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  isSalary
                    ? 'bg-gradient-to-r from-[#10b981] to-[#34d399] text-[#013421] shadow-md'
                    : 'text-[#a0aec0] hover:text-white'
                }`}
              >
                Salary Paycheck
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSalary(false);
                  if (!note || note === 'Monthly Salary') {
                    setNote('Bank Transfer / Deposit');
                  }
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  !isSalary
                    ? 'bg-gradient-to-r from-[#10b981] to-[#34d399] text-[#013421] shadow-md'
                    : 'text-[#a0aec0] hover:text-white'
                }`}
              >
                Other Deposit
              </button>
            </div>
          )}

          {/* If Debit: Category Picker */}
          {!isCredit && (
            <div>
              <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
                Category
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-[#34d399] text-[#013421] shadow-md shadow-[#10b981]/25'
                          : 'bg-white/5 text-[#94a3b8] hover:text-white border border-white/5'
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
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
              Amount (₹)
            </label>
            <div className="relative">
              <span
                className={`absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold ${
                  isCredit ? 'text-[#34d399]' : 'text-rose-400'
                }`}
              >
                ₹
              </span>
              <input
                type="number"
                min="1"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-base font-bold text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none"
              />
            </div>
          </div>

          {/* Date Picker */}
          <div className="bg-[#070c18] p-3 rounded-2xl border border-white/10 flex flex-col gap-2">
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
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    selectedDate === todayStr && !showDatePicker
                      ? 'bg-[#34d399] text-[#013421]'
                      : 'bg-white/10 text-[#94a3b8] hover:text-white'
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
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                    selectedDate === yesterdayStr && !showDatePicker
                      ? 'bg-[#34d399] text-[#013421]'
                      : 'bg-white/10 text-[#94a3b8] hover:text-white'
                  }`}
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-0.5 transition-all ${
                    showDatePicker || (selectedDate !== todayStr && selectedDate !== yesterdayStr)
                      ? 'bg-[#34d399] text-[#013421]'
                      : 'bg-white/10 text-[#94a3b8] hover:text-white'
                  }`}
                >
                  <span>Pick</span>
                  <span className="material-symbols-outlined text-[11px]">
                    {showDatePicker ? 'expand_less' : 'event'}
                  </span>
                </button>
              </div>
            </div>

            {showDatePicker && (
              <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                <span className="text-[11px] text-[#94a3b8] whitespace-nowrap">
                  Exact Date:
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
                  className="flex-1 bg-[#121a2d] border border-white/10 rounded-xl px-2.5 py-1 text-xs text-white focus:border-[#34d399] focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Note / Description */}
          <div>
            <label className="text-[11px] font-semibold text-[#a0aec0] uppercase tracking-wider block mb-1.5">
              Description / Note
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Blue Bottle coffee, Swiggy, Salary credit"
              className="w-full px-4 py-3 bg-[#070c18] border border-white/10 rounded-2xl text-xs text-white placeholder-white/20 focus:border-[#34d399] focus:outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-[#94a3b8] hover:text-white rounded-2xl font-bold text-xs transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !amount}
              className="flex-1 py-3 bg-gradient-to-r from-[#10b981] to-[#34d399] hover:brightness-110 text-[#013421] rounded-2xl font-headline font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#10b981]/25 disabled:opacity-50 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">check</span>
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
