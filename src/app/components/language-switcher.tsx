import { useLanguage } from "../context/language-context";

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={() => setLanguage("en")}
        className={`transition-opacity ${
          language === "en" ? "opacity-100" : "opacity-50 hover:opacity-75"
        }`}
        title="English"
      >
        <span className="text-2xl">🇬🇧</span>
      </button>
      <button
        onClick={() => setLanguage("ru")}
        className={`transition-opacity ${
          language === "ru" ? "opacity-100" : "opacity-50 hover:opacity-75"
        }`}
        title="Русский"
      >
        <span className="text-2xl">🇷🇺</span>
      </button>
    </div>
  );
}
