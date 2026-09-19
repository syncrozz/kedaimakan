import React, { useState } from 'react';
import { NIAGAPOS_ASSETS } from '../../constants/branding';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'logo' | 'icon';
  className?: string;
  imgClassName?: string;
  showText?: boolean;
  textTitle?: string;
  textSubtitle?: string;
}

const sizeMap = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8 sm:w-9 sm:h-9',
  md: 'w-10 h-10 sm:w-11 sm:h-11',
  lg: 'w-12 h-12 sm:w-14 sm:h-14',
  xl: 'w-16 h-16 sm:w-20 sm:h-20',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'sm',
  variant = 'icon',
  className = '',
  imgClassName = '',
  showText = false,
  textTitle = 'NiagaPOS',
  textSubtitle,
}) => {
  const [hasError, setHasError] = useState(false);
  const primarySrc = variant === 'logo' ? NIAGAPOS_ASSETS.logoSvg : NIAGAPOS_ASSETS.icon192;
  const fallbackSrc = NIAGAPOS_ASSETS.local.logoSvg;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeMap[size]} rounded-xl overflow-hidden bg-white border border-stone-200/90 shadow-2xs p-0.5 flex items-center justify-center shrink-0 transition-transform`}
      >
        <img
          src={hasError ? fallbackSrc : primarySrc}
          alt={textTitle}
          onError={() => setHasError(true)}
          className={`w-full h-full object-contain ${imgClassName}`}
          loading="eager"
        />
      </div>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-stone-900 tracking-tight text-sm sm:text-base">
            {textTitle.includes('POS') ? (
              <>
                {textTitle.split('POS').map((part, index, array) => (
                  <React.Fragment key={index}>
                    {part}
                    {index < array.length - 1 && <span className="text-red-600">POS</span>}
                  </React.Fragment>
                ))}
              </>
            ) : (
              textTitle
            )}
          </span>
          {textSubtitle && (
            <span className="text-[11px] text-stone-500 font-medium">
              {textSubtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
