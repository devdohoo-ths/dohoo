import React from 'react';
import { Platform, PLATFORM_CONFIGS } from '@/types/connections';
import { cn } from '@/lib/utils';

interface PlatformSelectorProps {
  selectedPlatform: Platform;
  onPlatformChange: (platform: Platform) => void;
  className?: string;
}

const PlatformSelector: React.FC<PlatformSelectorProps> = ({
  selectedPlatform,
  onPlatformChange,
  className
}) => {
  const platforms: Platform[] = ['whatsapp', 'telegram', 'facebook', 'instagram', 'api'];

  return (
    <div className={cn("flex items-center space-x-1 bg-white rounded-lg p-1 shadow-sm border border-slate-200", className)}>
      {platforms.map((platform) => {
        const config = PLATFORM_CONFIGS[platform];
        const isSelected = selectedPlatform === platform;
        const isAvailable = config.isAvailable;

        return (
          <button
            key={platform}
            onClick={() => isAvailable && onPlatformChange(platform)}
            disabled={!isAvailable}
            className={cn(
              "flex items-center space-x-2 px-4 py-2 rounded-md text-sm transition-all duration-200",
              "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2",
              isSelected
                ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
              !isAvailable && "opacity-50 cursor-not-allowed hover:bg-transparent"
            )}
            style={{
              borderColor: isSelected ? config.color : 'transparent'
            }}
          >
            <span 
              className="text-lg"
              style={{ 
                filter: !isAvailable ? 'grayscale(100%)' : 'none',
                opacity: !isAvailable ? 0.5 : 1
              }}
            >
              {config.icon}
            </span>
            <span className="hidden sm:inline">{config.name}</span>
            
            {!isAvailable && (
              <span className="hidden sm:inline text-xs text-slate-400">
                (Em breve)
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PlatformSelector; 