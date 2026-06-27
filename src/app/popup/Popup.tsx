import './Popup.css';
import { openExtensionSidebar } from '@/shared/browser/extensionApi';
import { BrandMark, ProductIcon } from '@/shared/components/ProductIcons';

export default function Popup() {
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

  const handleOpenHelp = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('pages/options.html#help') });
    window.close();
  };

  return (
    <div className="popup">
      <div className="popup-header">
        <span className="popup-logo" aria-hidden="true">
          <BrandMark />
        </span>
        <div>
          <h1 className="popup-title">Resume Bridge</h1>
          <p className="popup-subtitle">网申填写助手 v1.0.0</p>
        </div>
      </div>

      <div className="popup-actions">
        <div className="popup-status">
          <span className="popup-status-dot" aria-hidden="true" />
          <span>本地资料库已就绪，填充前请先复核结果</span>
        </div>
        <button className="ca-btn ca-btn-primary ca-btn-block" onClick={handleOpenSidebar}>
          <ProductIcon name="scan" className="ca-btn-icon" />
          打开智能填充面板
        </button>
        <button className="ca-btn ca-btn-outline ca-btn-block" onClick={handleOpenOptions}>
          <ProductIcon name="database" className="ca-btn-icon" />
          管理个人资料库
        </button>
        <button className="ca-btn ca-btn-outline ca-btn-block" onClick={handleOpenHelp}>
          <ProductIcon name="help" className="ca-btn-icon" />
          使用帮助
        </button>
      </div>

      <div className="popup-footer">
        <p>先扫描页面字段，再执行填充。</p>
        <p className="popup-privacy">所有数据仅存储在本地浏览器中。</p>
      </div>
    </div>
  );
}
