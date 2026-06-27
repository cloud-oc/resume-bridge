import { useState } from 'react';
import type { FormField, FillResult } from '@/shared/types/models';
import { ensureContentScriptReady, executeFullFill } from '@/core/engine/fillOrchestrator';
import { BrandMark, ProductIcon, type ProductIconName } from '@/shared/components/ProductIcons';
import { HeaderSettingsMenu } from '@/shared/components/LanguageSwitcher';
import { useLanguage } from '@/shared/i18n';
import QAPanel from './QAPanel';
import './Sidebar.css';

type TabType = 'fill' | 'result' | 'qa' | 'info' | 'help';

const GITHUB_URL = 'https://github.com/cloud-oc/resume-bridge';

const sidebarTabs: { key: TabType; labelKey: string; icon: ProductIconName }[] = [
  { key: 'fill', labelKey: 'sidebar.tab.fill', icon: 'scan' },
  { key: 'result', labelKey: 'sidebar.tab.result', icon: 'result' },
  { key: 'qa', labelKey: 'sidebar.tab.qa', icon: 'qa' },
  { key: 'info', labelKey: 'sidebar.tab.info', icon: 'database' },
  { key: 'help', labelKey: 'sidebar.tab.help', icon: 'help' },
];

export default function Sidebar() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabType>('fill');
  const [isScanning, setIsScanning] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [scannedFields, setScannedFields] = useState<FormField[]>([]);
  const [fillResult, setFillResult] = useState<FillResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const openOptionsPage = (hash?: string) => {
    const url = hash ? chrome.runtime.getURL(`pages/options.html#${hash}`) : undefined;
    if (url) {
      chrome.tabs.create({ url });
      return;
    }
    chrome.runtime.openOptionsPage();
  };

  // 获取当前标签页 ID
  const getActiveTabId = (): Promise<number | undefined> => {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]?.id);
      });
    });
  };

  // 扫描页面表单
  const handleScan = async () => {
    setIsScanning(true);
    setStatusMessage(t('sidebar.status.scanning'));

    try {
      const tabId = await getActiveTabId();
      if (!tabId) {
        setStatusMessage(t('sidebar.status.noTab'));
        setIsScanning(false);
        return;
      }

      await ensureContentScriptReady(tabId);

      chrome.tabs.sendMessage(tabId, { type: 'SCAN_FORM_FIELDS' }, (response) => {
        if (response?.success) {
          setScannedFields(response.fields);
          setStatusMessage(t('sidebar.status.scanFound', { count: response.fields.length }));
        } else {
          setStatusMessage(t('sidebar.status.scanFailed'));
        }
        setIsScanning(false);
      });
    } catch {
      setStatusMessage(t('sidebar.status.scanError'));
      setIsScanning(false);
    }
  };

  // 一键填充 —— 调用真实填充引擎
  const handleFill = async () => {
    setIsFilling(true);
    setStatusMessage(t('sidebar.status.filling'));

    try {
      const tabId = await getActiveTabId();
      if (!tabId) {
        setStatusMessage(t('sidebar.status.noTab'));
        setIsFilling(false);
        return;
      }

      // 调用填充编排器（扫描→规则匹配→语义匹配→LLM兜底→填充→校验）
      const result = await executeFullFill(tabId, (step, progress) => {
        setStatusMessage(`${step} (${progress}%)`);
      });

      setFillResult(result);
      setActiveTab('result');
      setStatusMessage(
        t('sidebar.status.fillDone', {
          success: result.successFields,
          failed: result.failedFields,
          pending: result.pendingFields,
        })
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('sidebar.status.unknownError');
      setStatusMessage(msg);
    } finally {
      setIsFilling(false);
    }
  };

  // 清空填充
  const handleClear = async () => {
    try {
      const tabId = await getActiveTabId();
      if (!tabId) {
        setStatusMessage(t('sidebar.status.noTab'));
        return;
      }

      await ensureContentScriptReady(tabId);

      chrome.tabs.sendMessage(tabId, { type: 'CLEAR_ALL_FILLED' }, (response) => {
        if (response?.success) {
          setFillResult(null);
          setScannedFields([]);
          setStatusMessage(t('sidebar.status.clearDone'));
        } else {
          setStatusMessage(t('sidebar.status.clearFailed'));
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('sidebar.status.clearFailed');
      setStatusMessage(msg);
    }
  };

  return (
    <div className="sidebar">
      {/* 头部 */}
      <header className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon" aria-hidden="true">
            <BrandMark />
          </span>
          <div>
            <h1 className="sidebar-title">{t('app.name')}</h1>
            <p className="sidebar-subtitle">{t('app.productPanel')}</p>
          </div>
        </div>
        <div className="sidebar-header-actions">
          <div className="sidebar-trust">{t('app.localStorage')}</div>
          <HeaderSettingsMenu onOpenSettingsPage={() => openOptionsPage('settings')} />
        </div>
      </header>

      {/* 标签切换 */}
      <nav className="sidebar-nav">
        {sidebarTabs.map((tab) => (
          <button
            key={tab.key}
            className={`sidebar-nav-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            title={t(tab.labelKey)}
          >
            <ProductIcon name={tab.icon} className="sidebar-nav-icon" />
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </nav>

      {/* 状态消息 */}
      {statusMessage && (
        <div className="sidebar-status">{statusMessage}</div>
      )}

      {/* 内容区域 */}
      <main className="sidebar-content">
        {/* ===== 智能填充标签 ===== */}
        {activeTab === 'fill' && (
          <div className="fill-panel">
            {/* 一键填充大按钮 */}
            <button
              className="ca-btn ca-btn-primary ca-btn-lg ca-btn-block fill-main-btn"
              onClick={handleFill}
              disabled={isFilling}
            >
              {isFilling ? (
                <>
                  <span className="ca-spinner" /> {t('sidebar.fill.loading')}
                </>
              ) : (
                <>
                  <ProductIcon name="spark" className="ca-btn-icon" />
                  {t('sidebar.fill.primary')}
                </>
              )}
            </button>

            {/* 辅助操作 */}
            <div className="fill-actions">
              <button
                className="ca-btn ca-btn-outline"
                onClick={handleScan}
                disabled={isScanning}
              >
                {isScanning ? (
                  <>
                    <span className="ca-spinner ca-spinner-sm" /> {t('sidebar.fill.scanning')}
                  </>
                ) : (
                  <>
                    <ProductIcon name="scan" className="ca-btn-icon" />
                    {t('sidebar.fill.scan')}
                  </>
                )}
              </button>
              <button className="ca-btn ca-btn-outline" onClick={handleClear}>
                <ProductIcon name="result" className="ca-btn-icon" />
                {t('sidebar.fill.clear')}
              </button>
            </div>

            <div className="workflow-strip" aria-label={t('sidebar.workflow.aria')}>
              <div className="workflow-step">
                <span>1</span>
                <strong>{t('sidebar.workflow.scan.title')}</strong>
                <p>{t('sidebar.workflow.scan.desc')}</p>
              </div>
              <div className="workflow-step">
                <span>2</span>
                <strong>{t('sidebar.workflow.fill.title')}</strong>
                <p>{t('sidebar.workflow.fill.desc')}</p>
              </div>
              <div className="workflow-step">
                <span>3</span>
                <strong>{t('sidebar.workflow.review.title')}</strong>
                <p>{t('sidebar.workflow.review.desc')}</p>
              </div>
            </div>

            {/* 扫描结果预览 */}
            {scannedFields.length > 0 && (
              <div className="ca-card scan-result-card">
                <div className="scan-result-header">
                  <div>
                    <h3 className="scan-result-title">
                      {t('sidebar.scan.title', { count: scannedFields.length })}
                    </h3>
                    <p>{t('sidebar.scan.desc')}</p>
                  </div>
                  <span className="ca-badge ca-badge-info">
                    {t('sidebar.scan.requiredCount', {
                      count: scannedFields.filter((field) => field.required).length,
                    })}
                  </span>
                </div>
                <div className="scan-fields-list">
                  {scannedFields.slice(0, 20).map((field) => (
                    <div key={field.id} className="scan-field-item">
                      <span className="scan-field-label">{field.label}</span>
                      <span className={`ca-badge ${field.required ? 'ca-badge-danger' : 'ca-badge-info'}`}>
                        {field.required ? t('sidebar.scan.required') : field.tagName}
                      </span>
                    </div>
                  ))}
                  {scannedFields.length > 20 && (
                    <p className="scan-field-more">{t('sidebar.scan.more', { count: scannedFields.length - 20 })}</p>
                  )}
                </div>
              </div>
            )}

            {/* 使用提示 */}
            {scannedFields.length === 0 && !isScanning && (
              <div className="fill-tip-card">
                <h3>{t('sidebar.tip.title')}</h3>
                <ol className="fill-tips">
                  <li>{t('sidebar.tip.1')}</li>
                  <li>{t('sidebar.tip.2')}</li>
                  <li>{t('sidebar.tip.3')}</li>
                  <li>{t('sidebar.tip.4')}</li>
                </ol>
                <button className="ca-btn ca-btn-outline ca-btn-sm" onClick={() => setActiveTab('help')}>
                  <ProductIcon name="help" className="ca-btn-icon" />
                  {t('sidebar.tip.fullHelp')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== 填充结果标签 ===== */}
        {activeTab === 'result' && (
          <div className="result-panel">
            {fillResult ? (
              <>
                {/* 统计概览 */}
                <div className="result-stats">
                  <div className="ca-stat">
                    <div className="ca-stat-value" style={{ color: 'var(--ca-primary)' }}>
                      {fillResult.totalFields}
                    </div>
                    <div className="ca-stat-label">{t('sidebar.result.total')}</div>
                  </div>
                  <div className="ca-stat">
                    <div className="ca-stat-value" style={{ color: 'var(--ca-success)' }}>
                      {fillResult.successFields}
                    </div>
                    <div className="ca-stat-label">{t('sidebar.result.success')}</div>
                  </div>
                  <div className="ca-stat">
                    <div className="ca-stat-value" style={{ color: 'var(--ca-danger)' }}>
                      {fillResult.failedFields}
                    </div>
                    <div className="ca-stat-label">{t('sidebar.result.failed')}</div>
                  </div>
                  <div className="ca-stat">
                    <div className="ca-stat-value" style={{ color: 'var(--ca-warning)' }}>
                      {fillResult.pendingFields}
                    </div>
                    <div className="ca-stat-label">{t('sidebar.result.pending')}</div>
                  </div>
                </div>

                {/* 进度条 */}
                <div className="ca-progress" style={{ marginBottom: '16px' }}>
                  <div
                    className="ca-progress-bar"
                    style={{
                      width: `${(fillResult.successFields / fillResult.totalFields) * 100}%`,
                    }}
                  />
                </div>

                {/* 字段列表 */}
                <div className="result-fields">
                  {fillResult.fields.map((field) => (
                    <div key={field.fieldId} className={`result-field-item ${field.status}`}>
                      <div className="result-field-header">
                        <span className="result-field-label">{field.label}</span>
                        <span
                          className={`ca-badge ${
                            field.status === 'success'
                              ? 'ca-badge-success'
                              : field.status === 'failed'
                              ? 'ca-badge-danger'
                              : 'ca-badge-warning'
                          }`}
                        >
                          {field.status === 'success' ? '✓' : field.status === 'failed' ? '✗' : '?'}
                        </span>
                      </div>
                      {field.filledValue && (
                        <div className="result-field-value">{field.filledValue}</div>
                      )}
                      {field.errorMessage && (
                        <div className="result-field-error">{field.errorMessage}</div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="ca-empty">
                <div className="ca-empty-icon">—</div>
                <p>{t('sidebar.result.empty')}</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>{t('sidebar.result.emptyHint')}</p>
                <button className="ca-btn ca-btn-outline ca-btn-sm" onClick={() => setActiveTab('fill')}>
                  {t('sidebar.result.back')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===== AI 问答标签 ===== */}
        {activeTab === 'qa' && (
          <QAPanel onStatusUpdate={setStatusMessage} />
        )}

        {/* ===== 我的信息标签 ===== */}
        {activeTab === 'info' && (
          <div className="info-panel">
            <div className="ca-card">
              <h3>{t('sidebar.info.libraryTitle')}</h3>
              <p style={{ color: 'var(--ca-text-secondary)', fontSize: '13px', margin: '8px 0' }}>
                {t('sidebar.info.libraryDesc')}
              </p>
              <button
                className="ca-btn ca-btn-outline ca-btn-block"
                onClick={() => openOptionsPage()}
              >
                <ProductIcon name="database" className="ca-btn-icon" />
                {t('sidebar.info.openLibrary')}
              </button>
            </div>

            <div className="ca-card" style={{ marginTop: '12px' }}>
              <h3>{t('sidebar.info.quickActions')}</h3>
              <div className="info-quick-settings">
                <button
                  className="ca-btn ca-btn-outline ca-btn-sm"
                  onClick={() => {
                    openOptionsPage('ai');
                  }}
                >
                  <ProductIcon name="settings" className="ca-btn-icon" />
                  {t('sidebar.info.aiSettings')}
                </button>
                <button
                  className="ca-btn ca-btn-outline ca-btn-sm"
                  onClick={async () => {
                    // 导出数据
                    const { exportAllData } = await import('@/core/storage/db');
                    const data = await exportAllData();
                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `resume-bridge-backup-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setStatusMessage(t('sidebar.status.exported'));
                  }}
                >
                  <ProductIcon name="backup" className="ca-btn-icon" />
                  {t('sidebar.info.exportData')}
                </button>
              </div>
            </div>

            <div className="ca-card info-about-card">
              <h3>{t('sidebar.info.aboutTitle')}</h3>
              <p>{t('app.productIntro')}</p>
              <div className="info-about-actions">
                <button
                  className="ca-btn ca-btn-outline ca-btn-sm"
                  onClick={() => chrome.tabs.create({ url: GITHUB_URL })}
                >
                  <ProductIcon name="backup" className="ca-btn-icon" />
                  {t('app.github')}
                </button>
                <span>{t('app.copyright')}</span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <div className="help-panel">
            <section className="help-section help-hero">
              <ProductIcon name="help" className="help-hero-icon" />
              <div>
                <h2>{t('sidebar.help.title')}</h2>
                <p>{t('sidebar.help.subtitle')}</p>
              </div>
            </section>

            <section className="help-section">
              <h3>{t('sidebar.help.firstTitle')}</h3>
              <ol className="help-list">
                <li>{t('sidebar.help.first.1')}</li>
                <li>{t('sidebar.help.first.2')}</li>
                <li>{t('sidebar.help.first.3')}</li>
              </ol>
            </section>

            <section className="help-section">
              <h3>{t('sidebar.help.fillTitle')}</h3>
              <ol className="help-list">
                <li>{t('sidebar.help.fill.1')}</li>
                <li>{t('sidebar.help.fill.2')}</li>
                <li>{t('sidebar.help.fill.3')}</li>
                <li>{t('sidebar.help.fill.4')}</li>
                <li>{t('sidebar.help.fill.5')}</li>
              </ol>
            </section>

            <section className="help-section">
              <h3>{t('sidebar.help.faqTitle')}</h3>
              <div className="help-faq">
                <details>
                  <summary>{t('sidebar.help.faq.scan.q')}</summary>
                  <p>{t('sidebar.help.faq.scan.a')}</p>
                </details>
                <details>
                  <summary>{t('sidebar.help.faq.review.q')}</summary>
                  <p>{t('sidebar.help.faq.review.a')}</p>
                </details>
                <details>
                  <summary>{t('sidebar.help.faq.privacy.q')}</summary>
                  <p>{t('sidebar.help.faq.privacy.a')}</p>
                </details>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* 底部 */}
      <footer className="sidebar-footer">
        <button type="button" onClick={() => chrome.tabs.create({ url: GITHUB_URL })}>
          {t('app.github')}
        </button>
        <span>{t('app.copyright')}</span>
      </footer>
    </div>
  );
}
