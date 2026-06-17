// Декоративный борт Nordwind сбоку (вектор, без внешних ассетов) для оживления интерфейса.
// Ливрея: белый фюзеляж, красный cheatline и кил с белой «N». Нос смотрит вправо (летит вправо).

export function NordwindJet({ className = "" }: { className?: string }) {
  const RED = "#E31E24";
  return (
    <svg viewBox="0 0 640 220" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Тень-контактна */}
      <ellipse cx="320" cy="206" rx="190" ry="9" fill="#000" opacity="0.12" />

      {/* Крыло дальнее (за фюзеляжем) */}
      <path d="M250 120 L150 178 L210 132 Z" fill="#c9ced6" />

      {/* Стабилизатор */}
      <path d="M70 104 L18 78 L70 96 Z" fill="#d7dbe2" />

      {/* Фюзеляж */}
      <path
        d="M590 108
           C566 92 470 86 360 86
           C250 86 150 90 92 94
           L40 98
           C36 98 34 102 38 104
           L80 111
           C72 118 66 123 62 129
           C60 132 62 135 66 134
           L122 127
           C220 136 360 138 470 132
           C540 128 576 122 590 118
           C606 116 606 110 590 108 Z"
        fill="#ffffff"
        stroke="#b9c0cb"
        strokeWidth="1.5"
      />

      {/* Cheatline (красная линия вдоль окон) */}
      <path
        d="M98 103 C200 98 360 97 470 101 C536 103 572 107 592 112"
        stroke={RED}
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* Ряд окон */}
      <path
        d="M150 107 H468"
        stroke="#9aa3b2"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />

      {/* Кокпит */}
      <path d="M556 106 C572 106 584 109 592 112 C584 115 572 116 558 115 Z" fill="#2b3340" />

      {/* Кил (хвостовое оперение) — красный с «N» */}
      <path d="M150 86 L120 26 C119 22 124 20 127 24 L196 86 Z" fill={RED} />
      <path d="M150 86 L120 26 C119 22 124 20 127 24 L196 86 Z" fill="#000" opacity="0.06" />
      <text x="150" y="70" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="34" fill="#fff" textAnchor="middle">
        N
      </text>

      {/* Крыло ближнее (полнее, со стреловидностью) */}
      <path d="M320 124 L188 184 L236 184 L300 130 Z" fill="#e4e8ee" stroke="#c9ced6" strokeWidth="1" />

      {/* Двигатель под крылом */}
      <g>
        <ellipse cx="296" cy="150" rx="32" ry="14" fill="#eef1f5" stroke="#c2c9d3" strokeWidth="1.5" />
        <ellipse cx="266" cy="150" rx="6" ry="12" fill="#2b3340" />
        <path d="M300 150 h6" stroke={RED} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}
