import React, { useState, useEffect } from 'react';
import { InAppNotificationPayload } from '../services/notificationService';

export const NotificationBanner: React.FC = () => {
  const [activeAlert, setActiveAlert] = useState<InAppNotificationPayload | null>(null);

  useEffect(() => {
    const handleNotification = (e: Event) => {
      const custom = e as CustomEvent<InAppNotificationPayload>;
      if (custom.detail) {
        setActiveAlert(custom.detail);
      }
    };

    window.addEventListener('eq_inapp_notification', handleNotification);
    return () => {
      window.removeEventListener('eq_inapp_notification', handleNotification);
    };
  }, []);

  // Auto-dismiss after 6.5 seconds
  useEffect(() => {
    if (!activeAlert) return;
    const timer = setTimeout(() => {
      setActiveAlert(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [activeAlert]);

  if (!activeAlert) return null;

  return (
    <div className="fixed top-3 inset-x-0 z-50 px-3 flex justify-center pointer-events-none animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="pointer-events-auto w-full max-w-sm rounded-3xl bg-[#0e1629]/95 backdrop-blur-2xl border border-[#34d399]/40 shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-4 flex items-center justify-between gap-3 select-none">
        {/* Left Icon Badge */}
        <div className="relative shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#059669] via-[#10b981] to-[#34d399] flex items-center justify-center text-[#013421] shadow-lg shadow-[#10b981]/30">
            <span className="material-symbols-outlined text-[24px] font-bold">
              {activeAlert.isSettlement ? 'handshake' : 'receipt_long'}
            </span>
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#34d399]"></span>
          </span>
        </div>

        {/* Middle Notification Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white font-headline truncate">
              {activeAlert.title}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#34d399]/15 text-[#34d399] font-bold shrink-0">
              LIVE
            </span>
          </div>
          <p className="text-[11px] text-[#dae2fd] mt-0.5 leading-snug line-clamp-2">
            {activeAlert.body}
          </p>
        </div>

        {/* Right Dismiss Button */}
        <button
          onClick={() => setActiveAlert(null)}
          className="w-7 h-7 rounded-full bg-white/[0.08] hover:bg-white/[0.15] text-[#94a3b8] hover:text-white flex items-center justify-center shrink-0 active:scale-90 transition-all"
          aria-label="Dismiss alert"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
    </div>
  );
};
