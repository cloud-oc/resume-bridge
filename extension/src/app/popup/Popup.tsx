import './Popup.css';

export default function Popup() {
  const handleOpenSidebar = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
    window.close();
  };

  return (
    <div className="popup">
      <div className="popup-header">
        <span className="popup-logo" aria-hidden="true">RB</span>
        <div>
          <h1 className="popup-title">Resume Bridge</h1>
          <p className="popup-subtitle">校招申请填写助手 v1.0.0</p>
        </div>
      </div>

      <div className="popup-actions">
        <div className="popup-status">
          <span className="popup-status-dot" aria-hidden="true" />
          <span>本地资料库已就绪，填充前请先复核结果</span>
        </div>
        <button className="ca-btn ca-btn-primary ca-btn-block" onClick={handleOpenSidebar}>
          打开智能填充面板
        </button>
        <button className="ca-btn ca-btn-outline ca-btn-block" onClick={handleOpenOptions}>
          管理个人资料库
        </button>
      </div>

      <div className="popup-footer">
        <p>先扫描页面字段，再执行填充。</p>
        <p className="popup-privacy">所有数据仅存储在本地浏览器中。</p>
      </div>
    </div>
  );
}
