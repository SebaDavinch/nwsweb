import { useEffect, useState } from "react";

interface CountryFlagProps {
  iso2?: string | null;
  countryName?: string | null;
  className?: string;
  fallbackText?: string;
}

export function CountryFlag({ iso2, countryName, className = "h-4 w-6", fallbackText = "--" }: CountryFlagProps) {
  const normalized = String(iso2 || "").trim().toLowerCase();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [normalized]);

  if (!/^[a-z]{2}$/.test(normalized) || failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm border border-gray-200 bg-gray-100 text-[9px] font-semibold uppercase tracking-wide text-gray-500 ${className}`}
        aria-hidden="true"
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/${normalized}.svg`}
      alt={String(countryName || normalized.toUpperCase())}
      title={String(countryName || normalized.toUpperCase())}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`inline-block rounded-sm border border-black/5 object-cover shadow-sm ${className}`}
    />
  );
}