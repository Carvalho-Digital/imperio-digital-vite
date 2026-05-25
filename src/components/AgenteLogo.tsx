/* Logo do Agente — hexágono com triângulo de pontos conectados.
   Símbolo abstrato: orbital + rede. Limpo, geométrico, não-cliché. */
export default function AgenteLogo({ size = 28, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      {/* Hexágono externo */}
      <path
        d="M12 2.2L20.5 7v10L12 21.8 3.5 17V7L12 2.2z"
        stroke={color}
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Linhas internas do triângulo (sutis) */}
      <path
        d="M12 8.2L8 15.4M12 8.2L16 15.4M8 15.4H16"
        stroke={color}
        strokeWidth="0.7"
        strokeOpacity="0.45"
        strokeLinecap="round"
      />
      {/* 3 pontos do triângulo (núcleos) */}
      <circle cx="12" cy="8.2" r="1.55" fill={color} />
      <circle cx="8" cy="15.4" r="1.55" fill={color} />
      <circle cx="16" cy="15.4" r="1.55" fill={color} />
    </svg>
  );
}
