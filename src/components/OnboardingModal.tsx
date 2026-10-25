import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';
import { createUserProfile, generatePairCode, pairWithRoommate } from '../services/userService';

interface OnboardingModalProps {
  authUser: User;
  onComplete: (profile: UserProfile) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  authUser,
  onComplete,
}) => {
  const [currentBalance, setCurrentBalance] = useState<string>('24450');
  const [monthlyBudget, setMonthlyBudget] = useState<string>('30000');
  const [salaryAmount, setSalaryAmount] = useState<string>('75000');
  const [salaryDate, setSalaryDate] = useState<string>('Oct 1');
  const [roommateCodeOrEmail, setRoommateCodeOrEmail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const balanceNum = parseFloat(currentBalance) || 0;
    const budgetNum = parseFloat(monthlyBudget) || 0;
    const salaryNum = parseFloat(salaryAmount) || 0;

    if (balanceNum < 0) {
      setErrorMsg('Liquid balance cannot be negative');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const generatedCode = generatePairCode();
      const newProfile: UserProfile = {
        uid: authUser.uid,
        displayName: authUser.displayName || 'Roommate',
        email: authUser.email || '',
        photoURL: authUser.photoURL || undefined,
        currentBalance: balanceNum,
        monthlyBudget: budgetNum,
        salaryAmount: salaryNum,
        salaryDate: salaryDate.trim() || 'Recently',
        pairCode: generatedCode,
        createdAt: new Date().toISOString(),
      };

      // Create profile in Firestore
      await createUserProfile(newProfile);

      // If roommate code or email was provided, try linking immediately
      if (roommateCodeOrEmail.trim()) {
        try {
          const pairRes = await pairWithRoommate(newProfile, roommateCodeOrEmail.trim());
          if (pairRes.success && pairRes.partnerProfile) {
            newProfile.partnerUid = pairRes.partnerProfile.uid;
            newProfile.partnerEmail = pairRes.partnerProfile.email;
            newProfile.partnerName = pairRes.partnerProfile.displayName;
          }
        } catch (pairErr) {
          console.warn('Roommate pairing during onboarding deferred', pairErr);
        }
      }

      onComplete(newProfile);
    } catch (err) {
      console.error('Failed to complete onboarding', err);
      setErrorMsg('Could not set up profile. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#171f33] rounded-3xl border border-[#2d3449] p-6 shadow-2xl flex flex-col gap-5 max-h-[95vh] overflow-y-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex flex-col gap-1 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#10b981] to-[#4edea3] flex items-center justify-center shadow-lg shadow-[#10b981]/25 mx-auto mb-1">
            <span className="material-symbols-outlined text-[#003824] text-[28px] font-bold">
              balance
            </span>
          </div>
          <h2 className="text-xl font-bold font-headline text-[#dae2fd]">
            Welcome to Equilibrium
          </h2>
          <p className="text-xs text-[#bbcabf]">
            Let's configure your personal vault and bilateral ledger preferences.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-[#93000a]/20 border border-[#ffb4ab] text-[#ffb4ab] text-xs rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
          {/* Question 1: Liquid Bank Balance */}
          <div>
            <label className="font-semibold text-[#bbcabf] block mb-1">
              1. What is your present liquid bank balance? (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#4edea3] text-sm">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={currentBalance}
                onChange={(e) => setCurrentBalance(e.target.value)}
                placeholder="24450"
                className="w-full pl-8 pr-3 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-sm font-bold text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
              />
            </div>
          </div>

          {/* Question 2: Monthly Budget Cap */}
          <div>
            <label className="font-semibold text-[#bbcabf] block mb-1">
              2. What is your monthly budget cap? (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-[#4edea3] text-sm">
                ₹
              </span>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={monthlyBudget}
                onChange={(e) => setMonthlyBudget(e.target.value)}
                placeholder="30000"
                className="w-full pl-8 pr-3 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-sm font-bold text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
              />
            </div>
          </div>

          {/* Question 3: Salary Credited Date & Amount */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="font-semibold text-[#bbcabf] block mb-1">
                Last Salary (₹)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#4edea3] text-xs">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  placeholder="75000"
                  className="w-full pl-7 pr-2.5 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-xs font-bold text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-[#bbcabf] block mb-1">
                Credited Date
              </label>
              <input
                type="text"
                value={salaryDate}
                onChange={(e) => setSalaryDate(e.target.value)}
                placeholder="Oct 1"
                className="w-full px-3 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-xs font-bold text-[#dae2fd] focus:border-[#4edea3] focus:outline-none"
              />
            </div>
          </div>

          {/* Question 4: Roommate Pair Code / Email (Optional) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-[#bbcabf]">
                4. Roommate's Pair Code or Email
              </label>
              <span className="text-[10px] text-[#bbcabf]/70">(Optional)</span>
            </div>
            <input
              type="text"
              value={roommateCodeOrEmail}
              onChange={(e) => setRoommateCodeOrEmail(e.target.value)}
              placeholder="E.g. EQ-49K2 or roommate@gmail.com"
              className="w-full px-3.5 py-2.5 bg-[#0b1326] border border-[#2d3449] rounded-xl text-xs font-semibold text-[#dae2fd] focus:border-[#4edea3] focus:outline-none uppercase"
            />
            <p className="text-[10px] text-[#bbcabf] mt-1">
              You can also pair anytime later from the Partner tab.
            </p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 bg-gradient-to-r from-[#10b981] to-[#4edea3] text-[#003824] rounded-xl font-headline font-bold text-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-md shadow-[#10b981]/25 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px] font-bold">
              check
            </span>
            <span>{isSubmitting ? 'Setting up Vault...' : 'Launch Equilibrium'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
