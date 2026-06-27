import { useState, useCallback } from 'react';
import type { AIModelConfig } from '@/shared/types/models';
import { aiConfigDB, personalInfoDB, educationDB, experienceDB } from '@/core/storage/db';
import { llmGenerateAnswer } from '@/core/engine/llmService';
import { generateUserDataSummary} from '@/core/engine/fillOrchestrator';
import { useLanguage } from '@/shared/i18n';

interface QAProps {
  onStatusUpdate?: (msg: string) => void;
}

/** 开放性问题 AI 回答组件 */
export default function QAPanel({ onStatusUpdate }: QAProps) {
  const { t } = useLanguage();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!question.trim()) return;

    setIsGenerating(true);
    onStatusUpdate?.(t('qa.status.generating'));

    try {
      // 加载配置
      const config = await aiConfigDB.getActive();
      if (!config) {
        onStatusUpdate?.(t('qa.status.needModel'));
        setIsGenerating(false);
        return;
      }

      // 加载用户数据
      const [personalInfo, educations, experiences] = await Promise.all([
        personalInfoDB.get(),
        educationDB.getAll(),
        experienceDB.getAll(),
      ]);

      if (!personalInfo?.name) {
        onStatusUpdate?.(t('qa.status.needProfile'));
        setIsGenerating(false);
        return;
      }

      const userData = {
        personalInfo,
        educations,
        experiences,
        skills: [],
      };

      const summary = generateUserDataSummary(userData);
      const result = await llmGenerateAnswer(config, question.trim(), summary);
      setAnswer(result);
      onStatusUpdate?.(t('qa.status.done'));
    } catch (error) {
      const msg = error instanceof Error ? error.message : t('qa.status.failed');
      onStatusUpdate?.(msg);
    } finally {
      setIsGenerating(false);
    }
  }, [question, onStatusUpdate, t]);

  const handleCopy = () => {
    navigator.clipboard.writeText(answer).then(() => {
      onStatusUpdate?.(t('qa.status.copied'));
    });
  };

  return (
    <div className="qa-panel">
      <div className="ca-card">
        <h3 style={{ marginBottom: '8px' }}>{t('qa.title')}</h3>
        <p style={{ fontSize: '12px', color: 'var(--ca-text-muted)', marginBottom: '12px' }}>
          {t('qa.desc')}
        </p>

        <div className="ca-form-group">
          <label className="ca-label">{t('qa.question')}</label>
          <textarea
            className="ca-input ca-textarea"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('qa.placeholder')}
            rows={3}
          />
        </div>

        <div className="qa-presets">
          {[
            t('qa.preset.career'),
            t('qa.preset.company'),
            t('qa.preset.strength'),
            t('qa.preset.challenge'),
          ].map((preset) => (
            <button
              key={preset}
              className="qa-preset-btn"
              onClick={() => setQuestion(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <button
          className="ca-btn ca-btn-primary ca-btn-block"
          onClick={handleGenerate}
          disabled={isGenerating || !question.trim()}
          style={{ marginTop: '12px' }}
        >
          {isGenerating ? (
            <>
              <span className="ca-spinner" /> {t('qa.generating')}
            </>
          ) : (
            t('qa.generate')
          )}
        </button>
      </div>

      {answer && (
        <div className="ca-card" style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3>{t('qa.result')}</h3>
            <button className="ca-btn ca-btn-outline ca-btn-sm" onClick={handleCopy}>
              {t('qa.copy')}
            </button>
          </div>
          <div className="qa-answer">{answer}</div>
        </div>
      )}
    </div>
  );
}
