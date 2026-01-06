import React, { useState, useRef, useEffect } from 'react';

interface ComparisonViewProps {
  originalSrc: string;
  processedSrc: string;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ originalSrc, processedSrc }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    
    setSliderPosition(percentage);
  };

  useEffect(() => {
    const stopDragging = () => setIsDragging(false);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchend', stopDragging);
    return () => {
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchend', stopDragging);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden flex items-center justify-center bg-[#020610]"
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
    >
        {/* Images Container to maintain aspect ratio logic */}
        <div className="relative h-full w-full max-w-[90%] max-h-[90%] flex items-center justify-center">
            
             {/* Left Image (Original) - Shows when slider is to the right */}
            <img 
                src={originalSrc} 
                alt="Original" 
                className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full object-contain pointer-events-none"
            />

            {/* Right Image (Processed) - Overlays on top, clipped by slider */}
            <div 
                className="absolute top-0 left-0 w-full h-full pointer-events-none"
                style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
            >
                 <img 
                    src={processedSrc} 
                    alt="Processed" 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 max-w-full max-h-full object-contain"
                />
            </div>

            {/* Slider Line */}
            <div 
                className="absolute top-0 bottom-0 w-1 bg-cyber-primary cursor-ew-resize z-10 hover:bg-white transition-colors"
                style={{ left: `${sliderPosition}%` }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
            >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-cyber-primary rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.8)]">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 18L9 12L15 6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M9 18L3 12L9 6" stroke="transparent" /> 
                    </svg>
                    <div className="absolute flex space-x-4 pointer-events-none">
                         <span className="text-[10px] text-black font-bold mr-1">&lt;</span>
                         <span className="text-[10px] text-black font-bold ml-1">&gt;</span>
                    </div>
                </div>
            </div>
            
            {/* Labels */}
            <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-cyber-secondary text-sm border border-cyber-secondary/30">原图</div>
            <div className="absolute bottom-4 right-4 bg-black/60 px-3 py-1 rounded text-cyber-primary text-sm border border-cyber-primary/30">效果</div>
        </div>
    </div>
  );
};

export default ComparisonView;
