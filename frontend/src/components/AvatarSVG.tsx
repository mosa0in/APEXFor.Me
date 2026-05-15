import React from 'react';

// ─── Config ──────────────────────────────────────────────────────────────────

export interface AvatarConfig {
  skin:      string;
  hair:      string;
  hairStyle: 'none' | 'short' | 'medium' | 'curly' | 'long' | 'bun' | 'hijab';
  eyes:      'normal' | 'wide' | 'sleepy';
  outfit:    string;
  bg:        string;
}

export const DEFAULT_AVATAR: AvatarConfig = {
  skin:      '#F5C5A3',
  hair:      '#1A1110',
  hairStyle: 'short',
  eyes:      'normal',
  outfit:    '#2D5EAD',
  bg:        '#FFFC00',
};

// ─── Palette options (exported for the builder) ───────────────────────────────

export const SKIN_COLORS = [
  '#FDDBB4', '#F5C5A3', '#EAA87A', '#D08850',
  '#A0602A', '#7A3A18', '#5C2A10', '#3A1808',
];
export const HAIR_COLORS = [
  '#1A1110', '#3B2010', '#6B3A20', '#A07840',
  '#D4A840', '#C04820', '#808080', '#E0D0D0',
  '#2060C0', '#C020A0',
];
export const BG_COLORS = [
  '#FFFC00', '#87CEEB', '#98FFD8', '#E8BAFF',
  '#FFB3C1', '#FFD580', '#B0F0B0', '#C0D8FF',
];
export const OUTFIT_COLORS = [
  '#2D5EAD', '#C0392B', '#27AE60', '#8E44AD',
  '#2C3E50', '#E67E22', '#16A085', '#E8E8E8',
];
export const HAIR_STYLES: AvatarConfig['hairStyle'][] = [
  'none', 'short', 'medium', 'curly', 'long', 'bun', 'hijab',
];
export const HAIR_STYLE_LABELS: Record<AvatarConfig['hairStyle'], string> = {
  none:   'قصير جداً',
  short:  'قصير',
  medium: 'متوسط',
  curly:  'مجعّد',
  long:   'طويل',
  bun:    'كعكة',
  hijab:  'حجاب',
};
export const EYE_STYLES: AvatarConfig['eyes'][] = ['normal', 'wide', 'sleepy'];
export const EYE_STYLE_LABELS: Record<AvatarConfig['eyes'], string> = {
  normal: 'عادي',
  wide:   'واسع',
  sleepy: 'ناعس',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ─── Sub-renderers ────────────────────────────────────────────────────────────

function Eyes({ style }: { style: AvatarConfig['eyes'] }) {
  if (style === 'wide') return (
    <g>
      {/* Left eye */}
      <ellipse cx="42" cy="44" rx="5.5" ry="6.5" fill="white" />
      <circle cx="43" cy="44.5" r="3.5" fill="#1a1110" />
      <circle cx="44.2" cy="43.2" r="1.2" fill="white" />
      {/* Right eye */}
      <ellipse cx="58" cy="44" rx="5.5" ry="6.5" fill="white" />
      <circle cx="57" cy="44.5" r="3.5" fill="#1a1110" />
      <circle cx="58.2" cy="43.2" r="1.2" fill="white" />
      {/* Lashes */}
      <path d="M37 40 Q38 38 39 39.5" stroke="#1a1110" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <path d="M63 40 Q62 38 61 39.5" stroke="#1a1110" strokeWidth="1" fill="none" strokeLinecap="round"/>
    </g>
  );

  if (style === 'sleepy') return (
    <g>
      {/* Left eye — half closed */}
      <ellipse cx="42" cy="45" rx="5" ry="4" fill="white" />
      <ellipse cx="42" cy="47" rx="5" ry="2.5" fill={shade('#F5C5A3', -10)} />
      <circle cx="42.5" cy="45.5" r="2.8" fill="#1a1110" />
      <circle cx="43.5" cy="44.5" r="1" fill="white" />
      {/* Right eye */}
      <ellipse cx="58" cy="45" rx="5" ry="4" fill="white" />
      <ellipse cx="58" cy="47" rx="5" ry="2.5" fill={shade('#F5C5A3', -10)} />
      <circle cx="57.5" cy="45.5" r="2.8" fill="#1a1110" />
      <circle cx="58.5" cy="44.5" r="1" fill="white" />
      {/* Droopy lash line */}
      <path d="M37.5 43.5 Q42 41.5 46.5 43.5" stroke="#1a1110" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M53.5 43.5 Q58 41.5 62.5 43.5" stroke="#1a1110" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </g>
  );

  // normal
  return (
    <g>
      <ellipse cx="42" cy="45" rx="5" ry="5.5" fill="white" />
      <circle cx="42.5" cy="45.5" r="3.2" fill="#1a1110" />
      <circle cx="43.5" cy="44.2" r="1.1" fill="white" />
      <ellipse cx="58" cy="45" rx="5" ry="5.5" fill="white" />
      <circle cx="57.5" cy="45.5" r="3.2" fill="#1a1110" />
      <circle cx="58.5" cy="44.2" r="1.1" fill="white" />
      {/* Eyebrows */}
      <path d="M37.5 40 Q42 38 46 40" stroke="#1a1110" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M54 40 Q58 38 62.5 40" stroke="#1a1110" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    </g>
  );
}

function HairBack({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  if (style === 'long') return (
    <g>
      <rect x="24" y="52" width="13" height="44" rx="6.5" fill={color} />
      <rect x="63" y="52" width="13" height="44" rx="6.5" fill={color} />
    </g>
  );
  if (style === 'hijab') return (
    <ellipse cx="50" cy="64" rx="33" ry="38" fill={color} />
  );
  return null;
}

function HairFront({ style, color, clipId }: { style: AvatarConfig['hairStyle']; color: string; clipId: string }) {
  const dark = shade(color, -25);

  if (style === 'none') return (
    // Buzzcut shadow line
    <ellipse cx="50" cy="22" rx="23" ry="6" fill={shade(color, -15)} opacity="0.35" clipPath={`url(#hc-${clipId})`} />
  );

  if (style === 'short') return (
    <g clipPath={`url(#hc-${clipId})`}>
      <ellipse cx="50" cy="20" rx="24" ry="14" fill={color} />
      {/* Hairline detail */}
      <path d="M27 34 Q50 28 73 34" stroke={dark} strokeWidth="1.2" fill="none" />
    </g>
  );

  if (style === 'medium') return (
    <g>
      {/* Main top hair */}
      <ellipse cx="50" cy="18" rx="25" ry="16" fill={color} />
      {/* Side hair (ears visible) */}
      <rect x="24" y="28" width="9" height="22" rx="4" fill={color} />
      <rect x="67" y="28" width="9" height="22" rx="4" fill={color} />
      {/* Hairline */}
      <path d="M26 38 Q50 30 74 38" stroke={dark} strokeWidth="1.2" fill="none" />
    </g>
  );

  if (style === 'curly') return (
    <g>
      {/* Curly bumps — a crown of circles */}
      {[30, 38, 46, 54, 62, 70].map((cx, i) => (
        <circle key={i} cx={cx} cy={i % 2 === 0 ? 22 : 17} r={9} fill={color} />
      ))}
      {/* Fill between bumps */}
      <rect x="27" y="24" width="46" height="16" fill={color} />
      <path d="M26 38 Q50 32 74 38" stroke={dark} strokeWidth="1.2" fill="none" />
    </g>
  );

  if (style === 'long') return (
    <g clipPath={`url(#hc-${clipId})`}>
      <ellipse cx="50" cy="19" rx="25" ry="15" fill={color} />
      <path d="M27 34 Q50 28 73 34" stroke={dark} strokeWidth="1.2" fill="none" />
    </g>
  );

  if (style === 'bun') return (
    <g>
      {/* Base on head */}
      <ellipse cx="50" cy="24" rx="23" ry="10" fill={color} clipPath={`url(#hc-${clipId})`} />
      {/* Stalk */}
      <rect x="46" y="8" width="8" height="10" rx="4" fill={color} />
      {/* Bun circle */}
      <circle cx="50" cy="6" r="10" fill={color} />
      <circle cx="50" cy="6" r="7" fill={shade(color, 15)} />
      {/* Bun detail spiral */}
      <path d="M46 6 Q50 2 54 6 Q50 10 46 6" stroke={dark} strokeWidth="1" fill="none" />
    </g>
  );

  if (style === 'hijab') return (
    <g>
      {/* Hijab front cap */}
      <ellipse cx="50" cy="25" rx="26" ry="16" fill={color} />
      {/* Chin wrap */}
      <path d="M24 38 Q24 70 50 72 Q76 70 76 38 Q64 48 50 48 Q36 48 24 38Z" fill={color} />
      {/* Highlight fold */}
      <path d="M30 42 Q50 52 70 42" stroke={shade(color, 20)} strokeWidth="1.5" fill="none" opacity="0.5" />
    </g>
  );

  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────

let idCounter = 0;

export function AvatarSVG({ config, size = 100 }: { config: AvatarConfig; size?: number }) {
  const clipId = React.useRef(`av${++idCounter}`).current;
  const skinDark = shade(config.skin, -20);
  const skinMid  = shade(config.skin, -10);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Circular mask for the whole avatar */}
        <clipPath id={`ac-${clipId}`}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
        {/* Hair clip — top of head */}
        <clipPath id={`hc-${clipId}`}>
          <ellipse cx="50" cy="36" rx="26" ry="30" />
        </clipPath>
      </defs>

      <g clipPath={`url(#ac-${clipId})`}>
        {/* ── Background ── */}
        <circle cx="50" cy="50" r="50" fill={config.bg} />

        {/* ── Outfit / Body ── */}
        <ellipse cx="50" cy="108" rx="40" ry="26" fill={config.outfit} />
        {/* Collar V-shape */}
        <path d="M43 84 L50 92 L57 84" fill={shade(config.outfit, -20)} />
        {/* Shirt highlight */}
        <ellipse cx="50" cy="108" rx="28" ry="18" fill={shade(config.outfit, 15)} opacity="0.25" />

        {/* ── Hair back layer ── */}
        <HairBack style={config.hairStyle} color={config.hair} />

        {/* ── Neck ── */}
        <rect x="43" y="74" width="14" height="22" rx="5" fill={config.skin} />
        <rect x="44" y="74" width="5" height="22" rx="3" fill={skinDark} opacity="0.2" />

        {/* ── Ears ── */}
        <ellipse cx="24" cy="52" rx="5" ry="7" fill={config.skin} />
        <ellipse cx="24" cy="52" rx="3" ry="4.5" fill={skinMid} />
        <ellipse cx="76" cy="52" rx="5" ry="7" fill={config.skin} />
        <ellipse cx="76" cy="52" rx="3" ry="4.5" fill={skinMid} />

        {/* ── Head ── */}
        <ellipse cx="50" cy="42" rx="26" ry="30" fill={config.skin} />
        {/* Subtle chin shadow */}
        <ellipse cx="50" cy="70" rx="16" ry="4" fill={skinDark} opacity="0.15" />

        {/* ── Hair front layer ── */}
        <HairFront style={config.hairStyle} color={config.hair} clipId={clipId} />

        {/* ── Eyes ── */}
        <Eyes style={config.eyes} />

        {/* ── Nose ── */}
        <path
          d="M47 58 Q50 63 53 58"
          stroke={skinDark}
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />

        {/* ── Mouth / Smile ── */}
        <path
          d="M43 67 Q50 74 57 67"
          stroke="#9B3030"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {/* Lip fill */}
        <path
          d="M43 67 Q50 72 57 67 Q50 75 43 67Z"
          fill="#C04848"
          opacity="0.55"
        />

        {/* ── Cheek blush ── */}
        <ellipse cx="34" cy="63" rx="7" ry="4" fill="#FF8080" opacity="0.22" />
        <ellipse cx="66" cy="63" rx="7" ry="4" fill="#FF8080" opacity="0.22" />
      </g>
    </svg>
  );
}
