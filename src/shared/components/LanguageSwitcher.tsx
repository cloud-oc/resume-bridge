import { languageOptions, useLanguage } from '@/shared/i18n';
import { themeOptions, useTheme } from '@/shared/theme';
import { ProductIcon } from './ProductIcons';

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

interface AppearanceSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export function AppearanceSwitcher({ className = '', showLabel = false }: AppearanceSwitcherProps) {
  const { themeMode, effectiveTheme, setThemeMode } = useTheme();
  const { t } = useLanguage();

  return (
    <div className={`appearance-switcher ${className}`.trim()}>
      {showLabel && <span className="appearance-switcher-label">{t('appearance.label')}</span>}
      <div className="appearance-switcher-options" role="group" aria-label={t('appearance.label')}>
        {themeOptions.map((option) => (
          <button
            key={option.mode}
            type="button"
            className={`appearance-switcher-btn ${themeMode === option.mode ? 'active' : ''}`}
            onClick={() => void setThemeMode(option.mode)}
            aria-pressed={themeMode === option.mode}
          >
            {t(option.labelKey)}
          </button>
        ))}
      </div>
      <p className="appearance-switcher-status">
        {t('appearance.effective', {
          theme: t(effectiveTheme === 'dark' ? 'appearance.theme.dark' : 'appearance.theme.light'),
        })}
      </p>
    </div>
  );
}

interface HeaderSettingsMenuProps {
  className?: string;
  onOpenSettingsPage?: () => void;
}

export function HeaderSettingsMenu({ className = '', onOpenSettingsPage }: HeaderSettingsMenuProps) {
  const { t } = useLanguage();

  return (
    <details className={`header-settings-menu ${className}`.trim()}>
      <summary className="header-settings-trigger" aria-label={t('settings.button')} title={t('settings.button')}>
        <ProductIcon name="settings" />
      </summary>
      <div className="header-settings-popover">
        <div className="header-settings-head">
          <strong>{t('settings.title')}</strong>
          <span>{t('settings.subtitle')}</span>
        </div>
        <section className="header-settings-section">
          <div>
            <h2>{t('language.label')}</h2>
            <p>{t('language.description')}</p>
          </div>
          <LanguageSwitcher compact />
        </section>
        <section className="header-settings-section">
          <div>
            <h2>{t('appearance.label')}</h2>
            <p>{t('appearance.description')}</p>
          </div>
          <AppearanceSwitcher />
        </section>
        {onOpenSettingsPage && (
          <button type="button" className="header-settings-link" onClick={onOpenSettingsPage}>
            <ProductIcon name="external" />
            {t('settings.openSettingsPage')}
          </button>
        )}
      </div>
    </details>
  );
}
