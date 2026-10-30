import React, { useState, useEffect, useRef } from 'react';
import { ListChecks, LayoutGrid, ShoppingCart, AlertTriangle, History } from 'lucide-react';

export type TabType = 'inventory' | 'buysell' | 'alerts' | 'history';

interface BottomNavProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
  discrepancyCount?: number;
  lowStockCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  onChangeTab,
  discrepancyCount = 0,
  lowStockCount = 0,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Time in ms before the bottom nav slides away when the screen stops moving
  const IDLE_TIMEOUT_MS = 2400;

  const showNavTemporarily = (duration = IDLE_TIMEOUT_MS) => {
    setIsVisible(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, duration);
  };

  useEffect(() => {
    // Show nav bar on initial load for a few seconds so user notices it
    showNavTemporarily(3000);

    const handleScreenActivity = () => {
      setIsVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, IDLE_TIMEOUT_MS);
    };

    // Detect screen sliding/scrolling: touch swipe, scroll wheel, window scroll
    window.addEventListener('scroll', handleScreenActivity, { passive: true });
    window.addEventListener('touchmove', handleScreenActivity, { passive: true });
    window.addEventListener('wheel', handleScreenActivity, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScreenActivity);
      window.removeEventListener('touchmove', handleScreenActivity);
      window.removeEventListener('wheel', handleScreenActivity);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  const handleTabClick = (tabId: TabType) => {
    onChangeTab(tabId);
    showNavTemporarily(2400);
  };

  const tabs = [
    {
      id: 'inventory' as TabType,
      label: 'รายการสินค้า',
      icon: LayoutGrid,
    },
    {
      id: 'buysell' as TabType,
      label: 'ซื้อ/ขาย',
      icon: ShoppingCart,
      isSpecial: true,
    },
    {
      id: 'alerts' as TabType,
      label: 'สรุปยอด',
      icon: AlertTriangle,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'history' as TabType,
      label: 'ประวัติ',
      icon: History,
    },
  ];

  return (
    <>
      {/* Subtle indicator bar when hidden: tap or slide to reveal */}
      <div
        onClick={() => showNavTemporarily(3500)}
        role="button"
        tabIndex={0}
        aria-label="แตะเพื่อแสดงแถบเมนูด้านล่าง"
        title="แตะหรือสไลด์หน้าจอเพื่อแสดงเมนู"
        className={`fixed bottom-1 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center justify-center p-2 cursor-pointer transition-all duration-300 ${
          isVisible
            ? 'opacity-0 pointer-events-none translate-y-3'
            : 'opacity-80 hover:opacity-100 translate-y-0'
        }`}
      >
        <div className="w-12 h-1.5 rounded-full bg-[#F6C90E]/60 hover:bg-[#F6C90E] shadow-lg shadow-black/80 transition-all hover:scale-110 active:scale-95 animate-pulse" />
      </div>

      {/* Main Sliding Bottom Navigation */}
      <nav
        onMouseEnter={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          setIsVisible(true);
        }}
        onMouseLeave={() => {
          showNavTemporarily(1800);
        }}
        onTouchStart={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          setIsVisible(true);
        }}
        onTouchEnd={() => {
          showNavTemporarily(2400);
        }}
        className={`fixed bottom-0 left-0 right-0 z-40 bg-[#20262D]/95 backdrop-blur-md border-t border-[#3A4750] px-2 py-2 shadow-2xl transition-all duration-300 ease-out font-['Prompt',sans-serif] ${
          isVisible
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-md mx-auto grid grid-cols-4 gap-0.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-all relative cursor-pointer ${
                  isActive
                    ? 'text-[#F6C90E] font-semibold'
                    : 'text-[#A0ABB5] hover:text-[#EEEEEE] active:scale-95'
                }`}
              >
                <div className="relative">
                  {tab.isSpecial && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#F6C90E] animate-pulse" />
                  )}
                  <Icon
                    className={`w-5 h-5 transition-transform ${
                      isActive ? 'scale-110 text-[#F6C90E]' : tab.isSpecial ? 'text-[#F6C90E]' : ''
                    }`}
                  />
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`absolute -top-1.5 -right-2.5 text-[9px] font-bold px-1 min-w-[14px] h-3.5 rounded-full flex items-center justify-center ${tab.badgeColor}`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 tracking-tight truncate max-w-full ${
                    isActive
                      ? 'text-[#F6C90E] font-bold'
                      : tab.isSpecial
                      ? 'text-[#EEEEEE] font-medium'
                      : ''
                  }`}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div className="w-5 h-0.5 bg-[#F6C90E] rounded-full mt-0.5 shadow-sm shadow-[#F6C90E]/50" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
