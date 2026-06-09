import { Image, View } from '@tarojs/components';

import './index.scss';

export type BadgeIconName =
  | 'visitor'
  | 'bean-starter'
  | 'bean-collector'
  | 'roaster-radar'
  | 'history-explorer'
  | 'history-regular'
  | 'origin-scout'
  | 'origin-atlas'
  | 'process-nerd'
  | 'variety-hunter'
  | 'first-click'
  | 'multi-roaster'
  | 'first-share'
  | 'serial-sharer';

const BADGE_ICON_PATHS: Record<BadgeIconName, string> = {
  visitor:
    '<path d="M12 4C8 4 4 7 4 11v6c0 3 2 5 5 5h6c3 0 5-2 5-5v-6c0-4-4-7-8-7z" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M12 4V2M8 2h8M18 10h3c1 0 2 1 2 2s-1 2-2 2h-1" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M8 14c0-2 1.5-3 4-3s4 1 4 3" stroke-width="1.2" stroke-linecap="round"/>',
  'bean-starter':
    '<ellipse cx="12" cy="13" rx="5" ry="7" transform="rotate(-15 12 13)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M9 8c1.5 3 1.5 8 0 10" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M15 8c-1.5 3-1.5 8 0 10" stroke-width="1.2" stroke-linecap="round"/>' +
    '<path d="M18 4c-1.5 0-2.5 1-3 2-.5-1-1.5-2-3-2-2 0-3.5 1.5-3 3.5C9.5 10 12 12 15 12s5.5-2 6-4.5c.5-2-1-3.5-3-3.5z" fill="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>',
  'bean-collector':
    '<ellipse cx="12" cy="7" rx="3" ry="4.5" transform="rotate(-10 12 7)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M10.5 3.5c.8 2 .8 4.5 0 6" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M13.5 3.5c-.8 2-.8 4.5 0 6" stroke-width="1" stroke-linecap="round"/>' +
    '<ellipse cx="7" cy="16" rx="3" ry="4.5" transform="rotate(-20 7 16)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M5.5 12.5c.8 2 .8 4.5 0 6" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M8.5 12.5c-.8 2-.8 4.5 0 6" stroke-width="1" stroke-linecap="round"/>' +
    '<ellipse cx="17" cy="16" rx="3" ry="4.5" transform="rotate(5 17 16)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M15.5 12.5c.8 2 .8 4.5 0 6" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M18.5 12.5c-.8 2-.8 4.5 0 6" stroke-width="1" stroke-linecap="round"/>',
  'roaster-radar':
    '<circle cx="12" cy="11" r="8" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="11" r="4.5" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="11" r="1.5" fill="currentColor" stroke-width="0"/>' +
    '<path d="M12 19v4M9 22l3-3 3 3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M16 6c1.5 1.5 2 3 2 5" stroke-width="1" stroke-linecap="round" stroke-dasharray="1 2"/>',
  'history-explorer':
    '<path d="M3 7l4-2 5 2 5-2 4 2v10l-4-2-5 2-5-2-4 2V7z" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="10" r="1.5" fill="currentColor" stroke-width="0"/>' +
    '<path d="M12 11.5c0 0-2 2.5-2 3.5s1 1.5 2 1.5 2-.5 2-1.5-2-3.5-2-3.5z" fill="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M8 13l-2 1.5M16 13l2 1.5" stroke-width="0.9" stroke-linecap="round"/>',
  'history-regular':
    '<circle cx="12" cy="12" r="9" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M12 3c-2 3-3 6-3 9s1 6 3 9c2-3 3-6 3-9s-1-6-3-9z" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3 12h18" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M5 7c2.5 1 5.5 1.5 7 1.5s4.5-.5 7-1.5" stroke-width="0.9" stroke-linecap="round"/>' +
    '<circle cx="16" cy="8" r="1.5" fill="currentColor" stroke-width="0"/>',
  'origin-scout':
    '<circle cx="10.5" cy="10.5" r="6.5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M15.5 15.5l4 4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M10.5 7c-1.5 1.5-2 3-2 3.5s.5 1 1 1 1.5-.5 1-1.5c-.5-1 0-3 0-3z" fill="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M8.5 11c-1 0-2 .5-2.5 1.5" stroke-width="0.9" stroke-linecap="round"/>',
  'origin-atlas':
    '<path d="M4 5h5l3 2 3-2h5v14h-5l-3-2-3 2H4V5z" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M9 5v14M15 5v14" stroke-width="1" stroke-linecap="round"/>' +
    '<circle cx="12" cy="9" r="1.2" fill="currentColor" stroke-width="0"/>' +
    '<path d="M12 10.2v3" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M10.5 12.5h3" stroke-width="0.9" stroke-linecap="round"/>',
  'process-nerd':
    '<circle cx="12" cy="12" r="3.5" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M12 5.5v2M12 16.5v2M5.5 12h2M16.5 12h2M7.4 7.4l1.4 1.4M15.2 15.2l1.4 1.4M7.4 16.6l1.4-1.4M15.2 8.8l1.4-1.4" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<ellipse cx="12" cy="12" rx="1.8" ry="2.5" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M11 9.5c.5 1.5.5 3 0 5" stroke-width="0.8" stroke-linecap="round"/>',
  'variety-hunter':
    '<path d="M8 4c0 2 2 3 4 3s4 1 4 3-2 3-4 3-4 1-4 3" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M8 4c0 2-2 3-2 5s2 3 2 5-2 3-2 5" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M14 7c1.5 0 3 1 3.5 2.5" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M14 13c1.5 0 3-1 3.5-2.5" stroke-width="1" stroke-linecap="round"/>' +
    '<path d="M10 10c-1.5 0-3 1-3.5 2.5" stroke-width="1" stroke-linecap="round"/>',
  'first-click':
    '<path d="M8 18V9c0-1 .5-1.5 1.5-1.5S11 8 11 9v6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M11 8.5V6c0-1 .5-1.5 1.5-1.5S14 5 14 6v5" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M14 7.5V5.5c0-1 .5-1.5 1.5-1.5S17 4.5 17 5.5V12c0 3-2 5-5 5h-1" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M17 12h2l1 6H8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="9.5" cy="20" r="1" fill="currentColor" stroke-width="0"/>' +
    '<circle cx="17.5" cy="20" r="1" fill="currentColor" stroke-width="0"/>',
  'multi-roaster':
    '<path d="M5 8h4v10H5z" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M10 5h4v13h-4z" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M15 10h4v8h-4z" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M6 6l1.5-1.5L9 6M11 3.5l1.5-1L14 3.5M16 8.5l1.5-1L19 8.5" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="7" cy="12" r="0.8" fill="currentColor" stroke-width="0"/>' +
    '<circle cx="12" cy="10" r="0.8" fill="currentColor" stroke-width="0"/>' +
    '<circle cx="17" cy="14" r="0.8" fill="currentColor" stroke-width="0"/>',
  'first-share':
    '<path d="M16 8l4-4-4-4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M20 4h-6c-3 0-5 2-5 5v8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M9 12c-2 0-4 1.5-4 3.5S7 19 9 19s4-1.5 4-3.5S11 12 9 12z" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M7 14.5c.5 1.5 2.5 1.5 3 0" stroke-width="0.9" stroke-linecap="round"/>',
  'serial-sharer':
    '<circle cx="12" cy="12" r="2.5" fill="currentColor" stroke-width="0"/>' +
    '<path d="M12 6V3M12 21v-3M6 12H3M21 12h-3M7.8 7.8L5.6 5.6M18.4 18.4l-2.2-2.2M7.8 16.2l-2.2 2.2M18.4 5.6l-2.2 2.2" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="12" cy="3" r="1" fill="currentColor" stroke-width="0"/>' +
    '<circle cx="12" cy="21" r="1" fill="currentColor" stroke-width="0"/>' +
    '<circle cx="3" cy="12" r="1" fill="currentColor" stroke-width="0"/>' +
    '<circle cx="21" cy="12" r="1" fill="currentColor" stroke-width="0"/>',
};

interface BadgeIconProps {
  name: BadgeIconName;
  size?: number;
  color?: string;
  unlocked?: boolean;
  className?: string;
  showRing?: boolean;
  progress?: number;
}

export default function BadgeIcon({
  name,
  size = 48,
  color = '#8b5a2b',
  unlocked = false,
  className = '',
  showRing = false,
  progress = 0,
}: BadgeIconProps) {
  const paths = BADGE_ICON_PATHS[name] ?? BADGE_ICON_PATHS.visitor;
  const strokeColor = unlocked ? color : 'rgba(107,83,68,0.55)';
  const fillColor = unlocked ? color : 'rgba(107,83,68,0.35)';

  const showProgress = !unlocked && progress > 0 && showRing;
  const svgContent = showProgress
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
        <defs>
          <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#c85c3d"/>
            <stop offset="100%" style="stop-color:#8b5a43"/>
          </linearGradient>
        </defs>
        <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(107,83,68,0.12)" stroke-width="1.5"/>
        <circle cx="12" cy="12" r="10" fill="none" stroke="url(#badgeGrad)" stroke-width="1.5"
          stroke-dasharray="62.8319" stroke-dashoffset="${62.8319 - (Math.min(progress, 100) / 100) * 62.8319}"
          stroke-linecap="round" transform="rotate(-90 12 12)"/>
        <g stroke="${strokeColor}" fill="${fillColor}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
      </svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">
        <g stroke="${strokeColor}" fill="${fillColor}" stroke-linecap="round" stroke-linejoin="round">${paths}</g>
      </svg>`;

  const src = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;

  if (showRing) {
    return (
      <View
        className={`badge-icon-ring ${unlocked ? 'badge-icon-ring--unlocked' : ''} ${className}`}
        style={{
          width: `${size + 16}px`,
          height: `${size + 16}px`,
          borderRadius: '50%',
          background: unlocked
            ? 'linear-gradient(135deg, #c85c3d 0%, #8b5a43 100%)'
            : 'rgba(247, 241, 232, 0.98)',
          border: unlocked ? 'none' : '1px solid rgba(107, 83, 68, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: unlocked ? '0 8rpx 16rpx rgba(200, 92, 61, 0.18)' : 'none',
        }}
      >
        <Image
          src={src}
          style={{ width: `${size}px`, height: `${size}px`, display: 'block' }}
          lazyLoad={false}
        />
      </View>
    );
  }

  return (
    <Image
      src={src}
      style={{ width: `${size}px`, height: `${size}px`, display: 'block', flexShrink: 0 }}
      className={className}
      lazyLoad={false}
    />
  );
}

export const ALL_BADGE_ICON_NAMES: BadgeIconName[] = [
  'visitor',
  'bean-starter',
  'bean-collector',
  'roaster-radar',
  'history-explorer',
  'history-regular',
  'origin-scout',
  'origin-atlas',
  'process-nerd',
  'variety-hunter',
  'first-click',
  'multi-roaster',
  'first-share',
  'serial-sharer',
];
