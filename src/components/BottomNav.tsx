import React from 'react';
import { TabType } from '../types';

interface BottomNavProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  sharedLedgerBalance?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onChangeTab,
  sharedLedgerBalance,
}) => {
  const tabs = [
    {
      id: 'personal-space' as TabType,
      label: 'My Space',
      icon: 'account_balance_wallet',
    },
    {
      id: 'shared-ledger' as TabType,
      label: 'Shared Ledger',
      icon: 'receipt_long',
      hasBadge: sharedLedgerBalance !== undefined && sharedLedgerBalance !== 0,
      badgeColor: sharedLedgerBalance && sharedLedgerBalance > 0 ? 'bg-[#34d399]' : 'bg-[#fb7185]',
    },
    {
      id: 'partner-view' as TabType,
      label: 'Roommate',
      icon: 'group',
    },
  ];

  return (
    <nav className="fixed bottom-safe inset-x-0 z-40 px-3 pointer-events-none">
      <div className="max-w-sm mx-auto pointer-events-auto rounded-full bg-[#0e1629]/90 backdrop-blur-2xl border border-white/[0.12] shadow-[0_12px_40px_rgba(0,0,0,0.7)] p-1.5 flex items-center justify-between">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className={`relative flex-1 py-2 rounded-full flex flex-col items-center justify-center gap-0.5 transition-all duration-200 active:scale-95 select-none ${
                isActive
                  ? 'bg-white/[0.09] text-[#34d399] font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] border border-white/[0.06]'
                  : 'text-[#94a3b8] hover:text-[#dae2fd]'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <span
                  className={`material-symbols-outlined text-[22px] transition-transform duration-200 ${
                    isActive ? 'scale-110 text-[#34d399]' : ''
                  }`}
                  style={{
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {tab.icon}
                </span>

                {/* Live Bilateral Debt/Credit Notification Badge */}
                {tab.hasBadge && (
                  <span
                    className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full ${tab.badgeColor} ring-2 ring-[#0e1629] animate-pulse`}
                  />
                )}
              </div>

              <span className="text-[10px] tracking-tight font-headline">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
