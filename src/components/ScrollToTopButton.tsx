import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopButtonProps {
  threshold?: number;
  className?: string;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({
  threshold = 250,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setIsVisible(window.scrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="กลับขึ้นไปด้านบนสุด"
      title="กลับขึ้นไปด้านบนสุด"
      className={`fixed bottom-20 right-4 sm:right-[max(1rem,calc(50%-220px+1rem))] z-20 flex items-center gap-1.5 px-3 py-2 rounded-full bg-[#20262D]/95 hover:bg-[#2A333C] text-[#F6C90E] border border-[#F6C90E]/60 shadow-xl shadow-black/60 backdrop-blur-md transition-all duration-300 active:scale-90 group cursor-pointer ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
          : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
      } ${className}`}
    >
      <div className="w-6 h-6 rounded-full bg-[#F6C90E] text-[#20262D] flex items-center justify-center font-bold shadow-sm group-hover:-translate-y-0.5 transition-transform duration-200">
        <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
      </div>
      <span className="text-[11px] font-bold tracking-tight text-[#EEEEEE] group-hover:text-[#F6C90E] transition-colors pr-0.5">
        ขึ้นบนสุด
      </span>
    </button>
  );
};
