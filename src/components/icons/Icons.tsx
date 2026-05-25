/* Ícones SVG line-art consistentes — usar size + color como props.
   Estilo: stroke 1.6, line-cap round, line-join round. */

interface IconProps { size?: number; color?: string; }

const baseProps = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
  style: { display: 'block' as const },
});

const strokeProps = (color: string) => ({
  stroke: color,
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none' as const,
});

export function LinkIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      {/* Dois elos de corrente diagonais */}
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1 1" {...strokeProps(color)} />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" {...strokeProps(color)} />
    </svg>
  );
}

export function EditIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      {/* Lápis */}
      <path d="M12 20h9" {...strokeProps(color)} />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" {...strokeProps(color)} />
    </svg>
  );
}

export function TrashIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      {/* Lixeira */}
      <path d="M3 6h18" {...strokeProps(color)} />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...strokeProps(color)} />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" {...strokeProps(color)} />
      <line x1="10" y1="11" x2="10" y2="17" {...strokeProps(color)} />
      <line x1="14" y1="11" x2="14" y2="17" {...strokeProps(color)} />
    </svg>
  );
}

export function CopyIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      {/* 2 retângulos sobrepostos */}
      <rect x="9" y="9" width="11" height="11" rx="2" {...strokeProps(color)} />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" {...strokeProps(color)} />
    </svg>
  );
}

export function CheckIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <polyline points="20 6 9 17 4 12" {...strokeProps(color)} />
    </svg>
  );
}

export function CloseIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <line x1="18" y1="6" x2="6" y2="18" {...strokeProps(color)} />
      <line x1="6" y1="6" x2="18" y2="18" {...strokeProps(color)} />
    </svg>
  );
}

export function PlusIcon({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg {...baseProps(size)}>
      <line x1="12" y1="5" x2="12" y2="19" {...strokeProps(color)} />
      <line x1="5" y1="12" x2="19" y2="12" {...strokeProps(color)} />
    </svg>
  );
}

export function PowerOffIcon({ size = 16, color = 'currentColor' }: IconProps) {
  /* Ícone "revogar" — power off (arco + linha vertical) */
  return (
    <svg {...baseProps(size)}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" {...strokeProps(color)} />
      <line x1="12" y1="2" x2="12" y2="12" {...strokeProps(color)} />
    </svg>
  );
}
