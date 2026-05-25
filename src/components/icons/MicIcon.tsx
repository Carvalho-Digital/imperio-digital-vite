/* Ícone de microfone estilo Néctar — line art, cápsula + arco + base.
   Substitui o emoji 🎤 nos composers do agente. */
export function MicIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      {/* Cápsula */}
      <rect x="9" y="3" width="6" height="11" rx="3" stroke={color} strokeWidth="1.6" fill="none" />
      {/* Arco de sustento */}
      <path d="M5.5 11v1a6.5 6.5 0 0 0 13 0v-1" stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {/* Haste */}
      <line x1="12" y1="18.5" x2="12" y2="22" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      {/* Base */}
      <line x1="9" y1="22" x2="15" y2="22" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/* Ícone de parar gravação (substitui ■). Quadrado arredondado, sólido. */
export function StopIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill={color} />
    </svg>
  );
}
