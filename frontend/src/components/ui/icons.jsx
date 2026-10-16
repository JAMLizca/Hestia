/**
 * Íconos con el trazado exacto del mockup que no tienen un equivalente
 * idéntico en lucide-react. Mismo API que lucide: size, color, strokeWidth.
 */
function Svg({ size = 14, color = "currentColor", strokeWidth = 1.75, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function BedIcon(props) {
  return (
    <Svg {...props}>
      <path d="M2 20v-8a2 2 0 012-2h16a2 2 0 012 2v8" />
      <path d="M2 14h20" />
      <path d="M7 14v-3a1 1 0 011-1h8a1 1 0 011 1v3" />
    </Svg>
  );
}

export function ServiceBellIcon(props) {
  return (
    <Svg {...props}>
      <path d="M2 19h20" />
      <path d="M12 3v3" />
      <path d="M12 6a9 9 0 019 9H3a9 9 0 019-9z" />
    </Svg>
  );
}

export function PercentIcon(props) {
  return (
    <Svg {...props}>
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </Svg>
  );
}

export function SparklesIcon(props) {
  return (
    <Svg {...props}>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 13l.75 2.25L22 16l-2.25.75L19 19l-.75-2.25L16 16l2.25-.75L19 13z" />
      <path d="M5 2l.5 1.5L7 4l-1.5.5L5 6l-.5-1.5L3 4l1.5-.5L5 2z" />
    </Svg>
  );
}
