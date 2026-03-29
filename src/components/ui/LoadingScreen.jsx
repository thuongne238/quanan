import { useState, useEffect } from 'react';

const LoadingScreen = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Fake progress animation
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 98) return p;
        return p + Math.random() * 8;
      });
    }, 150);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end pb-32 bg-[var(--md-surface)]">
      {/* Background Image */}
      <div className="absolute inset-0 z-0 bg-black">
        <img 
          src="/loading-bg.jpg" 
          alt="Loading App..." 
          className="w-full h-full object-cover opacity-80"
          onError={(e) => {
            // Fallback pattern if image isn't found
            e.target.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Loading Content */}
      <div className="relative z-10 flex flex-col items-center w-full px-12 max-w-sm">
        <h1 className="text-3xl font-extrabold text-white mb-8 tracking-wide drop-shadow-lg text-center">
          Pos Công Thương
        </h1>
        
        {/* Progress Bar Container */}
        <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden backdrop-blur-md shadow-inner">
          <div 
            className="h-full bg-[var(--md-primary)] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        
        {/* Loading Text */}
        <p className="mt-4 text-xs text-white/90 font-medium tracking-wider uppercase animate-pulse drop-shadow-md">
          Đang tải dữ liệu...
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
