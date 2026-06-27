import { useState } from 'react';
import type { FormField, FillResult } from '@/shared/types/models';
import { executeFullFill } from '@/core/engine/fillOrchestrator';
import QAPanel from './QAPanel';
import './Sidebar.css';

type TabType = 'fill' | 'result' | 'qa' | 'info';

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
        return;
      }

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
    const tabId = await getActiveTabId();
    if (!tabId) return;

    chrome.tabs.sendMessage(tabId, { type: 'CLEAR_ALL_FILLED' }, (response) => {
      if (response?.success) {
        setFillResult(null);
        setScannedFields([]);
        setStatusMessage('已清空所有填充内容');
      }
    });
  };

  return (
    <div className="sidebar">
      {/* 头部 */}
      <header className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon" aria-hidden="true">RB</span>
          <div>
            <h1 className="sidebar-title">Resume Bridge</h1>
            <p className="sidebar-subtitle">网申填写与复核面板</p>
          </div>
        </div>
        <div className="sidebar-trust">本地存储</div>
      </header>

      {/* 标签切换 */}
      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-btn ${activeTab === 'fill' ? 'active' : ''}`}
          onClick={() => setActiveTab('fill')}
        >
          填充
        </button>
        <button
          className={`sidebar-nav-btn ${activeTab === 'result' ? 'active' : ''}`}
          onClick={() => setActiveTab('result')}
        >
          结果
        </button>
        <button
          className={`sidebar-nav-btn ${activeTab === 'qa' ? 'active' : ''}`}
          onClick={() => setActiveTab('qa')}
        >
          问答
        </button>
        <button
          className={`sidebar-nav-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          资料
        </button>
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
                <>一键智能填充</>
              )}
            </button>

            {/* 辅助操作 */}
            <div className="fill-actions">
              <button
                className="ca-btn ca-btn-outline"
                onClick={handleScan}
                disabled={isScanning}
              >
                {isScanning ? '扫描中...' : '扫描表单'}
              </button>
              <button className="ca-btn ca-btn-outline" onClick={handleClear}>
                清空填充
              </button>
            </div>

            {/* 扫描结果预览 */}
            {scannedFields.length > 0 && (
              <div className="ca-card scan-result-card">
                <h3 className="scan-result-title">
                  发现 {scannedFields.length} 个表单字段
                </h3>
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
              <div className="ca-card fill-tip-card">
                <h3>开始前确认</h3>
                <ol className="fill-tips">
                  <li>打开任意企业的网申页面</li>
                  <li>先扫描字段，确认页面已加载完成</li>
                  <li>执行智能填充后逐项复核</li>
                  <li>确认无误后再提交网申</li>
                </ol>
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
                在资料库中维护基础信息、教育经历、实习项目和 AI 配置。
              </p>
              <button
                className="ca-btn ca-btn-outline ca-btn-block"
                onClick={() => chrome.runtime.openOptionsPage()}
              >
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
                  导出数据
                </button>
              </div>
            </div>
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
