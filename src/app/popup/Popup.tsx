import './Popup.css';
import { openExtensionSidebar } from '@/shared/browser/extensionApi';
import { BrandMark, ProductIcon } from '@/shared/components/ProductIcons';
import { HeaderSettingsMenu } from '@/shared/components/LanguageSwitcher';
import { useLanguage } from '@/shared/i18n';

const GITHUB_URL = 'https://github.com/cloud-oc/resume-bridge';

export default function Popup() {
  const { t } = useLanguage();

  const handleOpenSidebar = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await openExtensionSidebar(tab.id);
      window.close();
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  const handleOpenSettings = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html#settings') });
    window.close();
  };

  const handleOpenHelp = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html#help') });
    window.close();
  };

  const handleOpenGitHub = () => {
    chrome.tabs.create({ url: GITHUB_URL });
    window.close();
  };

  return (
    <div className="popup">
      <div className="popup-header">
        <div className="popup-brand">
          <span className="popup-logo" aria-hidden="true">
            <BrandMark />
          </span>
          <div>
            <h1 className="popup-title">{t('app.name')}</h1>
            <p className="popup-subtitle">{t('app.productTagline')}</p>
          </div>
        </div>
        <HeaderSettingsMenu onOpenSettingsPage={handleOpenSettings} />
      </div>

      <div className="popup-actions">
        <div className="popup-status">
          <span className="popup-status-dot" aria-hidden="true" />
          <span>{t('popup.status')}</span>
        </div>
        <button className="ca-btn ca-btn-primary ca-btn-block" onClick={handleOpenSidebar}>
          <ProductIcon name="scan" className="ca-btn-icon" />
          {t('popup.openSidebar')}
        </button>
        <button className="ca-btn ca-btn-outline ca-btn-block" onClick={handleOpenOptions}>
          <ProductIcon name="database" className="ca-btn-icon" />
          {t('popup.openOptions')}
        </button>
        <button className="ca-btn ca-btn-outline ca-btn-block" onClick={handleOpenHelp}>
          <ProductIcon name="help" className="ca-btn-icon" />
          {t('popup.openHelp')}
        </button>
      </div>

      <div className="popup-footer">
        <div className="popup-links">
          <button type="button" onClick={handleOpenGitHub}>{t('app.github')}</button>
          <span>{t('app.copyright')}</span>
        </div>
      </div>
    </div>
  );
}
