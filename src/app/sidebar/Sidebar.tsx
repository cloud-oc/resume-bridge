import { useState } from 'react';
import type { FormField, FillResult } from '@/shared/types/models';
import { ensureContentScriptReady, executeFullFill } from '@/core/engine/fillOrchestrator';
import { BrandMark, ProductIcon, type ProductIconName } from '@/shared/components/ProductIcons';
import QAPanel from './QAPanel';
import './Sidebar.css';

type TabType = 'fill' | 'result' | 'qa' | 'info' | 'help';

const sidebarTabs: { key: TabType; label: string; icon: ProductIconName }[] = [
  { key: 'fill', label: '填充', icon: 'scan' },
  { key: 'result', label: '结果', icon: 'result' },
  { key: 'qa', label: '问答', icon: 'qa' },
  { key: 'info', label: '资料', icon: 'database' },
  { key: 'help', label: '帮助', icon: 'help' },
];

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('fill');
  const [isScanning, setIsScanning] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [scannedFields, setScannedFields] = useState<FormField[]>([]);
  const [fillResult, setFillResult] = useState<FillResult | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

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
    setStatusMessage('正在扫描页面表单...');

    try {
      const tabId = await getActiveTabId();
      if (!tabId) {
        setStatusMessage('❌ 无法获取当前标签页');
        setIsScanning(false);
        return;
      }

      await ensureContentScriptReady(tabId);

      chrome.tabs.sendMessage(tabId, { type: 'SCAN_FORM_FIELDS' }, (response) => {
        if (response?.success) {
          setScannedFields(response.fields);
          setStatusMessage(`✅ 发现 ${response.fields.length} 个可填充字段`);
        } else {
          setStatusMessage('❌ 扫描失败，请确认页面已完全加载');
        }
        setIsScanning(false);
      });
    } catch {
      setStatusMessage('❌ 扫描出错，请刷新页面重试');
      setIsScanning(false);
    }
  };

  // 一键填充 —— 调用真实填充引擎
  const handleFill = async () => {
    setIsFilling(true);
    setStatusMessage('🔄 正在启动智能填充...');

    try {
      const tabId = await getActiveTabId();
      if (!tabId) {
        setStatusMessage('❌ 无法获取当前标签页');
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
        `✅ 填充完成！成功 ${result.successFields} 项，失败 ${result.failedFields} 项，待确认 ${result.pendingFields} 项`
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setStatusMessage(`❌ ${msg}`);
    } finally {
      setIsFilling(false);
    }
  };

  // 清空填充
  const handleClear = async () => {
    try {
      const tabId = await getActiveTabId();
      if (!tabId) {
        setStatusMessage('❌ 无法获取当前标签页');
        return;
      }

      await ensureContentScriptReady(tabId);

      chrome.tabs.sendMessage(tabId, { type: 'CLEAR_ALL_FILLED' }, (response) => {
        if (response?.success) {
          setFillResult(null);
          setScannedFields([]);
          setStatusMessage('已清空所有填充内容');
        } else {
          setStatusMessage('❌ 清空失败，请刷新页面重试');
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '清空失败';
      setStatusMessage(`❌ ${msg}`);
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
            <h1 className="sidebar-title">Resume Bridge</h1>
            <p className="sidebar-subtitle">网申填写与复核面板</p>
          </div>
        </div>
        <div className="sidebar-trust">本地存储</div>
      </header>

      {/* 标签切换 */}
      <nav className="sidebar-nav">
        {sidebarTabs.map((tab) => (
          <button
            key={tab.key}
            className={`sidebar-nav-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            title={tab.label}
          >
            <ProductIcon name={tab.icon} className="sidebar-nav-icon" />
            <span>{tab.label}</span>
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
                  <span className="ca-spinner" /> 填充中...
                </>
              ) : (
                <>
                  <ProductIcon name="spark" className="ca-btn-icon" />
                  一键智能填充
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
                    <span className="ca-spinner ca-spinner-sm" /> 扫描中
                  </>
                ) : (
                  <>
                    <ProductIcon name="scan" className="ca-btn-icon" />
                    扫描表单
                  </>
                )}
              </button>
              <button className="ca-btn ca-btn-outline" onClick={handleClear}>
                <ProductIcon name="result" className="ca-btn-icon" />
                清空填充
              </button>
            </div>

            <div className="workflow-strip" aria-label="推荐使用流程">
              <div className="workflow-step">
                <span>1</span>
                <strong>扫描字段</strong>
                <p>确认页面表单已经加载完成</p>
              </div>
              <div className="workflow-step">
                <span>2</span>
                <strong>智能填充</strong>
                <p>优先规则匹配，必要时 AI 兜底</p>
              </div>
              <div className="workflow-step">
                <span>3</span>
                <strong>人工复核</strong>
                <p>检查必填项、下拉框和长文本</p>
              </div>
            </div>

            {/* 扫描结果预览 */}
            {scannedFields.length > 0 && (
              <div className="ca-card scan-result-card">
                <div className="scan-result-header">
                  <div>
                    <h3 className="scan-result-title">
                      发现 {scannedFields.length} 个表单字段
                    </h3>
                    <p>请重点核对必填字段和当前页面隐藏展开项。</p>
                  </div>
                  <span className="ca-badge ca-badge-info">
                    {scannedFields.filter((field) => field.required).length} 必填
                  </span>
                </div>
                <div className="scan-fields-list">
                  {scannedFields.slice(0, 20).map((field) => (
                    <div key={field.id} className="scan-field-item">
                      <span className="scan-field-label">{field.label}</span>
                      <span className={`ca-badge ${field.required ? 'ca-badge-danger' : 'ca-badge-info'}`}>
                        {field.required ? '必填' : field.tagName}
                      </span>
                    </div>
                  ))}
                  {scannedFields.length > 20 && (
                    <p className="scan-field-more">...还有 {scannedFields.length - 20} 个字段</p>
                  )}
                </div>
              </div>
            )}

            {/* 使用提示 */}
            {scannedFields.length === 0 && !isScanning && (
              <div className="fill-tip-card">
                <h3>开始前确认</h3>
                <ol className="fill-tips">
                  <li>打开任意企业的网申页面</li>
                  <li>先扫描字段，确认页面已加载完成</li>
                  <li>执行智能填充后逐项复核</li>
                  <li>确认无误后再提交网申</li>
                </ol>
                <button className="ca-btn ca-btn-outline ca-btn-sm" onClick={() => setActiveTab('help')}>
                  <ProductIcon name="help" className="ca-btn-icon" />
                  查看完整帮助
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
                    <div className="ca-stat-label">总字段</div>
                  </div>
                  <div className="ca-stat">
                    <div className="ca-stat-value" style={{ color: 'var(--ca-success)' }}>
                      {fillResult.successFields}
                    </div>
                    <div className="ca-stat-label">成功</div>
                  </div>
                  <div className="ca-stat">
                    <div className="ca-stat-value" style={{ color: 'var(--ca-danger)' }}>
                      {fillResult.failedFields}
                    </div>
                    <div className="ca-stat-label">失败</div>
                  </div>
                  <div className="ca-stat">
                    <div className="ca-stat-value" style={{ color: 'var(--ca-warning)' }}>
                      {fillResult.pendingFields}
                    </div>
                    <div className="ca-stat-label">待确认</div>
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
                <p>暂无填充结果</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>请先执行一键填充操作</p>
                <button className="ca-btn ca-btn-outline ca-btn-sm" onClick={() => setActiveTab('fill')}>
                  回到填充
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
              <h3>个人资料库</h3>
              <p style={{ color: 'var(--ca-text-secondary)', fontSize: '13px', margin: '8px 0' }}>
                在资料库中维护基础信息、教育经历、工作项目和 AI 配置。
              </p>
              <button
                className="ca-btn ca-btn-outline ca-btn-block"
                onClick={() => chrome.runtime.openOptionsPage()}
              >
                <ProductIcon name="database" className="ca-btn-icon" />
                打开资料库
              </button>
            </div>

            <div className="ca-card" style={{ marginTop: '12px' }}>
              <h3>快捷操作</h3>
              <div className="info-quick-settings">
                <button
                  className="ca-btn ca-btn-outline ca-btn-sm"
                  onClick={() => {
                    chrome.runtime.openOptionsPage();
                  }}
                >
                  <ProductIcon name="settings" className="ca-btn-icon" />
                  AI 模型配置
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
                    setStatusMessage('✅ 数据已导出');
                  }}
                >
                  <ProductIcon name="backup" className="ca-btn-icon" />
                  导出数据
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'help' && (
          <div className="help-panel">
            <section className="help-section help-hero">
              <ProductIcon name="help" className="help-hero-icon" />
              <div>
                <h2>使用帮助</h2>
                <p>按这个顺序走，通常就能稳定完成一次网申填写。</p>
              </div>
            </section>

            <section className="help-section">
              <h3>第一次使用</h3>
              <ol className="help-list">
                <li>进入资料库，先补齐姓名、手机、邮箱、教育经历和常用经历。</li>
                <li>需要开放题生成或 AI 兜底匹配时，在 AI 模型配置里添加 API Key，并设为默认。</li>
                <li>如果已有简历，可以先用简历解析导入，再回到资料库检查每一项。</li>
              </ol>
            </section>

            <section className="help-section">
              <h3>填表时怎么做</h3>
              <ol className="help-list">
                <li>打开企业网申页面，等页面、分步表单和弹窗都加载完成。</li>
                <li>点击“扫描表单”，先看发现的字段数量是否符合当前页面。</li>
                <li>点击“一键智能填充”，等待结果页展示成功、失败和待确认项。</li>
                <li>逐项复核页面内容，尤其是下拉框、开放题、附件上传和隐私确认框。</li>
                <li>确认无误后再由你手动提交。</li>
              </ol>
            </section>

            <section className="help-section">
              <h3>常见问题</h3>
              <div className="help-faq">
                <details>
                  <summary>扫描不到字段怎么办？</summary>
                  <p>先刷新页面并展开当前步骤的所有折叠区域；如果是浏览器内部页、Chrome 商店页或登录保护页，扩展可能无法注入页面助手。</p>
                </details>
                <details>
                  <summary>填充后为什么还要复核？</summary>
                  <p>不同 ATS 的字段命名和下拉选项差异很大。Resume Bridge 会保留可见结果，但最终提交前仍建议你确认每个关键字段。</p>
                </details>
                <details>
                  <summary>我的数据会上传吗？</summary>
                  <p>资料库和 API Key 存在本地浏览器。只有当你启用 AI 功能时，相关问题和资料摘要会直接发送给你配置的模型服务。</p>
                </details>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* 底部 */}
      <footer className="sidebar-footer">
        <span>Resume Bridge v1.0.0</span>
        <span>数据仅存储在本地</span>
      </footer>
    </div>
  );
}
