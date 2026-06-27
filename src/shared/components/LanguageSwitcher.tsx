import { languageOptions, useLanguage } from '@/shared/i18n';

interface LanguageSwitcherProps {
  className?: string;
  compact?: boolean;
  showLabel?: boolean;
}

export function LanguageSwitcher({ className = '', compact = false, showLabel = false }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`language-switcher ${className}`.trim()}>
      {showLabel && <span className="language-switcher-label">{t('language.label')}</span>}
      <div className="language-switcher-options" role="group" aria-label={t('language.label')}>
        {languageOptions.map((option) => (
          <button
            key={option.code}
            type="button"
            className={`language-switcher-btn ${language === option.code ? 'active' : ''}`}
            onClick={() => void setLanguage(option.code)}
            aria-pressed={language === option.code}
            title={option.label}
          >
            {compact ? option.shortLabel : option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
