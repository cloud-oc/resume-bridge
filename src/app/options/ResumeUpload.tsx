import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductIcon } from '@/shared/components/ProductIcons';
import { aiConfigDB } from '@/core/storage/db';
import { useLanguage } from '@/shared/i18n';
import type { AIModelConfig } from '@/shared/types/models';
import {
  extractTextFromPDF,
  extractTextFromWord,
  extractTextFromFile,
  parseResumeText,
  saveResumeData,
  type ResumeParseResult,
} from '@/core/engine/resumeParser';

interface ResumeUploadProps {
  onComplete?: () => void;
  onOpenAISettings?: () => void;
}

/** 简历上传解析组件 */
export default function ResumeUpload({ onComplete, onOpenAISettings }: ResumeUploadProps) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<'idle' | 'extracting' | 'parsing' | 'saving' | 'done' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [parseResult, setParseResult] = useState<ResumeParseResult | null>(null);
  const [saveResult, setSaveResult] = useState<{ saved: string[]; skipped: string[] } | null>(null);
  const [activeAIConfig, setActiveAIConfig] = useState<AIModelConfig | null>(null);
  const [isCheckingModel, setIsCheckingModel] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAIConfigReady = useCallback((config?: AIModelConfig | null) => {
    if (!config?.model?.trim()) return false;
    if (config.provider === 'ollama') return true;
    if (config.provider === 'custom' && config.baseUrl?.trim()) return true;
    return Boolean(config.apiKey?.trim());
  }, []);

  const loadActiveAIConfig = useCallback(async () => {
    setIsCheckingModel(true);
    const config = await aiConfigDB.getActive();
    setActiveAIConfig(isAIConfigReady(config) ? config ?? null : null);
    setIsCheckingModel(false);
    return isAIConfigReady(config) ? config : undefined;
  }, [isAIConfigReady]);

  useEffect(() => {
    void loadActiveAIConfig();
  }, [loadActiveAIConfig]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentAIConfig = activeAIConfig ?? await loadActiveAIConfig();
    if (!currentAIConfig) {
      setStatus('error');
      setStatusMessage(t('resume.needModel'));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB限制
    if (file.size > maxSize) {
      setStatus('error');
      setStatusMessage(t('resume.tooLarge'));
      return;
    }

    try {
      setParseResult(null);
      setSaveResult(null);

      // Step 1: 提取文本
      setStatus('extracting');
      setStatusMessage(t('resume.extracting', { file: file.name }));

      let text: string;
      const fileName = file.name.toLowerCase();
      if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
        text = await extractTextFromPDF(file);
      } else if (
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')
      ) {
        text = await extractTextFromWord(file);
      } else {
        text = await extractTextFromFile(file);
      }

      if (text.length < 30) {
        throw new Error(t('resume.tooShort'));
      }

      setStatusMessage(t('resume.extracted', { count: text.length }));

      // Step 2: AI 结构化解析
      setStatus('parsing');
      const result = await parseResumeText(text, currentAIConfig);
      setParseResult(result);

      if (!result.success) {
        setStatus('error');
        setStatusMessage(t('resume.parseFailed', { message: result.message }));
        return;
      }

      setStatusMessage(t('resume.saving'));

      // Step 3: 保存到本地
      setStatus('saving');
      const saved = await saveResumeData(result.data);
      setSaveResult(saved);

      setStatus('done');
      const savedMsg = saved.saved.length > 0 ? t('resume.saved', { items: saved.saved.join(', ') }) : '';
      const skippedMsg = saved.skipped.length > 0 ? t('resume.skipped', { items: saved.skipped.join(', ') }) : '';
      setStatusMessage([savedMsg, skippedMsg].filter(Boolean).join('。'));

      onComplete?.();
    } catch (error) {
      setStatus('error');
      setStatusMessage(error instanceof Error ? error.message : t('resume.failed'));
    }

    // 重置 input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isBusy = status === 'extracting' || status === 'parsing' || status === 'saving';
  const canUpload = Boolean(activeAIConfig) && !isCheckingModel && !isBusy;

  const getStepBadge = (step: string, current: boolean, done: boolean) => (
    <div className={`resume-step ${done ? 'done' : current ? 'active' : ''}`}>
      <span className="resume-step-icon">{done ? '✓' : current ? '…' : '○'}</span>
      <span>{step}</span>
    </div>
  );

  return (
    <div className="resume-upload">
      <h3 style={{ marginBottom: '4px' }}>{t('resume.title')}</h3>
      <p style={{ fontSize: '12px', color: 'var(--ca-text-muted)', marginBottom: '12px' }}>
        {t('resume.desc')}
      </p>

      {/* 上传区域 */}
      <div
        className={`resume-upload-zone ${!activeAIConfig && !isCheckingModel ? 'resume-upload-zone-disabled' : ''}`}
        onClick={() => {
          if (canUpload) {
            fileInputRef.current?.click();
          }
        }}
        style={{ cursor: canUpload ? 'pointer' : 'default' }}
        aria-disabled={!canUpload}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf,.txt,.md,.markdown"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={!canUpload}
        />
        {isCheckingModel && (
          <>
            <div className="ca-spinner" style={{ width: '24px', height: '24px', marginBottom: '8px' }} />
            <p>{t('resume.checkingModel')}</p>
          </>
        )}
        {!isCheckingModel && !activeAIConfig && (
          <div className="resume-model-gate">
            <ProductIcon name="settings" className="resume-upload-icon resume-upload-icon-error" />
            <p>{t('resume.needModelTitle')}</p>
            <p className="resume-model-gate-desc">{t('resume.needModelDesc')}</p>
            {onOpenAISettings && (
              <button
                type="button"
                className="ca-btn ca-btn-primary ca-btn-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenAISettings();
                }}
              >
                <ProductIcon name="settings" className="ca-btn-icon" />
                {t('resume.configureModel')}
              </button>
            )}
          </div>
        )}
        {!isCheckingModel && activeAIConfig && status === 'idle' && (
          <>
            <ProductIcon name="resume" className="resume-upload-icon" />
            <p>{t('resume.choose')}</p>
            <p style={{ fontSize: '11px', color: 'var(--ca-text-muted)' }}>
              {t('resume.supported')}
            </p>
          </>
        )}
        {activeAIConfig && (status === 'extracting' || status === 'parsing' || status === 'saving') && (
          <>
            <div className="ca-spinner" style={{ width: '24px', height: '24px', marginBottom: '8px' }} />
            <p>{statusMessage}</p>
          </>
        )}
        {activeAIConfig && status === 'done' && (
          <>
            <ProductIcon name="shield" className="resume-upload-icon resume-upload-icon-success" />
            <p>{t('resume.done')}</p>
          </>
        )}
        {activeAIConfig && status === 'error' && (
          <>
            <ProductIcon name="help" className="resume-upload-icon resume-upload-icon-error" />
            <p>{statusMessage}</p>
            <p style={{ fontSize: '11px', color: 'var(--ca-text-muted)', marginTop: '4px' }}>
              {t('resume.retry')}
            </p>
          </>
        )}
      </div>

      {/* 进度步骤 */}
      {status !== 'idle' && (
        <div className="resume-steps">
          {getStepBadge(t('resume.step.extract'), status === 'extracting', ['parsing', 'saving', 'done'].includes(status))}
          {getStepBadge(t('resume.step.parse'), status === 'parsing', ['saving', 'done'].includes(status))}
          {getStepBadge(t('resume.step.save'), status === 'saving', status === 'done')}
        </div>
      )}

      {/* 解析结果预览 */}
      {parseResult?.success && parseResult.data && (
        <div className="resume-result">
          <h4 style={{ marginBottom: '8px' }}>{t('resume.preview')}</h4>
          {parseResult.data.personalInfo?.name && (
            <div className="resume-result-item">
              <span className="resume-result-label">{t('resume.name')}</span>
              <span>{parseResult.data.personalInfo.name}</span>
            </div>
          )}
          {parseResult.data.personalInfo?.phone && (
            <div className="resume-result-item">
              <span className="resume-result-label">{t('resume.phone')}</span>
              <span>{parseResult.data.personalInfo.phone}</span>
            </div>
          )}
          {parseResult.data.personalInfo?.email && (
            <div className="resume-result-item">
              <span className="resume-result-label">{t('resume.email')}</span>
              <span>{parseResult.data.personalInfo.email}</span>
            </div>
          )}
          {parseResult.data.educations?.map((edu, i) => (
            <div key={i} className="resume-result-item">
              <span className="resume-result-label">{t('resume.education', { index: i + 1 })}</span>
              <span>{edu.school} · {edu.major} · {edu.type}</span>
            </div>
          ))}
          {parseResult.data.experiences?.map((exp, i) => (
            <div key={i} className="resume-result-item">
              <span className="resume-result-label">{t('resume.experience', { index: i + 1 })}</span>
              <span>{exp.organization} · {exp.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* 保存结果 */}
      {saveResult && (
        <div className="resume-save-result" style={{ marginTop: '8px', fontSize: '12px' }}>
          {saveResult.saved.length > 0 && (
            <p style={{ color: 'var(--ca-success)' }}>{t('resume.saved', { items: saveResult.saved.join(', ') })}</p>
          )}
          {saveResult.skipped.length > 0 && (
            <p style={{ color: 'var(--ca-warning)' }}>{t('resume.skipped', { items: saveResult.skipped.join(', ') })}</p>
          )}
        </div>
      )}
    </div>
  );
}
