import { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import type { PersonalInfo, Education, Experience, AIModelConfig } from '@/shared/types/models';
import {
  personalInfoDB,
  educationDB,
  experienceDB,
  aiConfigDB,
  generateId,
  exportAllData,
  importAllData,
} from '@/core/storage/db';
import { BrandMark, ProductIcon, type ProductIconName } from '@/shared/components/ProductIcons';
import {
  AppearanceSwitcher,
  HeaderSettingsMenu,
  LanguageSwitcher,
} from '@/shared/components/LanguageSwitcher';
import { useLanguage } from '@/shared/i18n';
import './Options.css';

type PageType = 'personal' | 'education' | 'experience' | 'ai' | 'resume' | 'backup' | 'settings' | 'help';

const ResumeUpload = lazy(() => import('./ResumeUpload'));

const GITHUB_URL = 'https://github.com/cloud-oc/resume-bridge';

const optionsNavItems: { key: PageType; icon: ProductIconName; labelKey: string }[] = [
  { key: 'personal', icon: 'user', labelKey: 'options.nav.personal' },
  { key: 'education', icon: 'education', labelKey: 'options.nav.education' },
  { key: 'experience', icon: 'briefcase', labelKey: 'options.nav.experience' },
  { key: 'ai', icon: 'settings', labelKey: 'options.nav.ai' },
  { key: 'resume', icon: 'resume', labelKey: 'options.nav.resume' },
  { key: 'backup', icon: 'backup', labelKey: 'options.nav.backup' },
  { key: 'settings', icon: 'settings', labelKey: 'options.nav.settings' },
  { key: 'help', icon: 'help', labelKey: 'options.nav.help' },
];

function createEmptyPersonalInfo(): PersonalInfo {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    name: '',
    gender: '',
    birthDate: '',
    phone: '',
    email: '',
    targetCities: [],
    targetPositions: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createEmptyEducation(): Education {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    type: '本科',
    school: '',
    major: '',
    startDate: '',
    endDate: '',
    isPrimary: false,
    order: 0,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createEmptyExperience(): Experience {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    type: '工作',
    organization: '',
    role: '',
    startDate: '',
    endDate: '',
    description: '',
    bullets: [''],
    versions: [],
    abilityTags: [],
    industryTags: [],
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export default function Options() {
  const { t } = useLanguage();
  const [activePage, setActivePage] = useState<PageType>(() => {
    const hash = window.location.hash.replace('#', '') as PageType;
    return optionsNavItems.some((item) => item.key === hash) ? hash : 'personal';
  });
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(createEmptyPersonalInfo());
  const [educations, setEducations] = useState<Education[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [aiConfigs, setAIConfigs] = useState<AIModelConfig[]>([]);
  const [saveStatus, setSaveStatus] = useState('');

  // 加载数据
  const loadData = useCallback(async () => {
    const [info, edus, exps, configs] = await Promise.all([
      personalInfoDB.get(),
      educationDB.getAll(),
      experienceDB.getAll(),
      aiConfigDB.getAll(),
    ]);
    if (info) setPersonalInfo(info);
    setEducations(edus.sort((a, b) => a.order - b.order));
    setExperiences(exps.sort((a, b) => a.order - b.order));
    setAIConfigs(configs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as PageType;
      if (optionsNavItems.some((item) => item.key === hash)) {
        setActivePage(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const selectPage = (page: PageType) => {
    setActivePage(page);
    window.history.replaceState(null, '', `#${page}`);
  };

  const openGitHub = () => {
    window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
  };

  // 保存个人信息
  const savePersonalInfo = async () => {
    const updated = { ...personalInfo, updatedAt: new Date().toISOString() };
    await personalInfoDB.save(updated);
    setPersonalInfo(updated);
    setSaveStatus(t('options.save.personal'));
    setTimeout(() => setSaveStatus(''), 2000);
  };

  // 保存教育经历
  const saveEducation = async (edu: Education) => {
    const updated = { ...edu, updatedAt: new Date().toISOString() };
    await educationDB.save(updated);
    await loadData();
    setSaveStatus(t('options.save.education'));
    setTimeout(() => setSaveStatus(''), 2000);
  };

  // 保存工作经历
  const saveExperience = async (exp: Experience) => {
    const updated = { ...exp, updatedAt: new Date().toISOString() };
    await experienceDB.save(updated);
    await loadData();
    setSaveStatus(t('options.save.experience'));
    setTimeout(() => setSaveStatus(''), 2000);
  };

  // 删除教育经历
  const deleteEducation = async (id: string) => {
    if (confirm(t('options.confirm.deleteEducation'))) {
      await educationDB.delete(id);
      await loadData();
    }
  };

  // 删除经历
  const deleteExperience = async (id: string) => {
    if (confirm(t('options.confirm.deleteExperience'))) {
      await experienceDB.delete(id);
      await loadData();
    }
  };

  // 保存 AI 配置
  const saveAIConfig = async (config: AIModelConfig) => {
    // 如果设为激活，先取消其他的激活状态
    if (config.isActive) {
      for (const c of aiConfigs) {
        if (c.id !== config.id && c.isActive) {
          await aiConfigDB.save({ ...c, isActive: false });
        }
      }
    }
    await aiConfigDB.save(config);
    await loadData();
    setSaveStatus(t('options.save.ai'));
    setTimeout(() => setSaveStatus(''), 2000);
  };

  // 导出数据
  const handleExport = async () => {
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resume-bridge-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSaveStatus(t('options.save.export'));
    setTimeout(() => setSaveStatus(''), 2000);
  };

  // 导入数据
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.version) {
          alert(t('options.alert.invalidBackup'));
          return;
        }
        if (confirm(t('options.confirm.import'))) {
          await importAllData(data);
          await loadData();
          setSaveStatus(t('options.save.import'));
          setTimeout(() => setSaveStatus(''), 2000);
        }
      } catch {
        alert(t('options.alert.importFailed'));
      }
    };
    input.click();
  };

  return (
    <div className="options-page">
      {/* 侧边导航 */}
      <nav className="options-nav">
        <div className="options-nav-header">
          <div className="options-nav-brand">
            <span className="options-nav-logo" aria-hidden="true">
              <BrandMark />
            </span>
            <div>
              <h1>{t('app.name')}</h1>
              <p>{t('options.nav.subtitle')}</p>
            </div>
          </div>
          <HeaderSettingsMenu onOpenSettingsPage={() => selectPage('settings')} />
        </div>
        <div className="options-nav-items">
          {optionsNavItems.map((item) => (
            <button
              key={item.key}
              className={`options-nav-item ${activePage === item.key ? 'active' : ''}`}
              onClick={() => selectPage(item.key)}
            >
              <span className="options-nav-item-icon">
                <ProductIcon name={item.icon} />
              </span>
              <span className="options-nav-item-label">{t(item.labelKey)}</span>
            </button>
          ))}
        </div>
        <div className="options-nav-footer">
          <button type="button" onClick={openGitHub}>{t('app.github')}</button>
          <span>{t('app.copyright')}</span>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="options-main">
        {saveStatus && <div className="options-save-status">{saveStatus}</div>}

        {/* ===== 基础信息 ===== */}
        {activePage === 'personal' && (
          <div className="options-section">
            <h2>{t('options.personal.title')}</h2>
            <p className="options-desc">{t('options.personal.desc')}</p>

            <div className="options-form-grid">
              <div className="ca-form-group">
                <label className="ca-label required">{t('options.personal.name')}</label>
                <input className="ca-input" value={personalInfo.name}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, name: e.target.value })}
                  placeholder={t('options.personal.namePlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.englishName')}</label>
                <input className="ca-input" value={personalInfo.nameEn || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, nameEn: e.target.value })}
                  placeholder="English Name" />
              </div>
              <div className="ca-form-group">
                <label className="ca-label required">{t('options.personal.gender')}</label>
                <select className="ca-input ca-select" value={personalInfo.gender}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, gender: e.target.value as PersonalInfo['gender'] })}>
                  <option value="">{t('options.personal.select')}</option>
                  <option value="男">男</option>
                  <option value="女">女</option>
                </select>
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.birthDate')}</label>
                <input className="ca-input" type="date" value={personalInfo.birthDate}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, birthDate: e.target.value })} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label required">{t('options.personal.phone')}</label>
                <input className="ca-input" value={personalInfo.phone}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                  placeholder={t('options.personal.phonePlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label required">{t('options.personal.email')}</label>
                <input className="ca-input" type="email" value={personalInfo.email}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                  placeholder={t('options.personal.emailPlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.ethnicity')}</label>
                <input className="ca-input" value={personalInfo.ethnicity || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, ethnicity: e.target.value })}
                  placeholder={t('options.personal.ethnicityPlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.political')}</label>
                <select className="ca-input ca-select" value={personalInfo.politicalStatus || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, politicalStatus: e.target.value })}>
                  <option value="">{t('options.personal.select')}</option>
                  <option value="群众">群众</option>
                  <option value="共青团员">共青团员</option>
                  <option value="中共党员">中共党员</option>
                  <option value="中共预备党员">中共预备党员</option>
                </select>
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.nativePlace')}</label>
                <input className="ca-input" value={personalInfo.nativePlace || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, nativePlace: e.target.value })}
                  placeholder={t('options.personal.nativePlacePlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.currentCity')}</label>
                <input className="ca-input" value={personalInfo.currentCity || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, currentCity: e.target.value })}
                  placeholder={t('options.personal.currentCityPlaceholder')} />
              </div>
            </div>

            <div className="ca-divider" />
            <h3>{t('options.personal.social')}</h3>
            <div className="options-form-grid">
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.wechat')}</label>
                <input className="ca-input" value={personalInfo.wechat || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, wechat: e.target.value })} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">LinkedIn</label>
                <input className="ca-input" value={personalInfo.linkedin || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, linkedin: e.target.value })}
                  placeholder={t('options.personal.linkedinPlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">GitHub</label>
                <input className="ca-input" value={personalInfo.github || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, github: e.target.value })}
                  placeholder={t('options.personal.githubPlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.portfolio')}</label>
                <input className="ca-input" value={personalInfo.portfolio || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, portfolio: e.target.value })}
                  placeholder={t('options.personal.portfolioPlaceholder')} />
              </div>
            </div>

            <div className="ca-divider" />
            <h3>{t('options.personal.intent')}</h3>
            <div className="options-form-grid">
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.targetCities')}</label>
                <input className="ca-input"
                  value={personalInfo.targetCities.join(', ')}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, targetCities: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder={t('options.personal.targetCitiesPlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.targetPositions')}</label>
                <input className="ca-input"
                  value={personalInfo.targetPositions.join(', ')}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, targetPositions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                  placeholder={t('options.personal.targetPositionsPlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.expectedSalary')}</label>
                <input className="ca-input" value={personalInfo.expectedSalary || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, expectedSalary: e.target.value })}
                  placeholder={t('options.personal.expectedSalaryPlaceholder')} />
              </div>
              <div className="ca-form-group">
                <label className="ca-label">{t('options.personal.availableDate')}</label>
                <input className="ca-input" type="date" value={personalInfo.availableDate || ''}
                  onChange={(e) => setPersonalInfo({ ...personalInfo, availableDate: e.target.value })} />
              </div>
            </div>

            <button className="ca-btn ca-btn-primary ca-btn-lg" onClick={savePersonalInfo} style={{ marginTop: '16px' }}>
              {t('options.personal.save')}
            </button>
          </div>
        )}

        {/* ===== 教育经历 ===== */}
        {activePage === 'education' && (
          <div className="options-section">
            <div className="options-section-header">
              <div>
                <h2>{t('options.education.title')}</h2>
                <p className="options-desc">{t('options.education.desc')}</p>
              </div>
              <button className="ca-btn ca-btn-primary" onClick={() => {
                const newEdu = createEmptyEducation();
                newEdu.order = educations.length;
                setEducations([...educations, newEdu]);
              }}>
                {t('options.education.add')}
              </button>
            </div>

            {educations.length === 0 ? (
              <div className="ca-empty">
                <div className="ca-empty-icon">—</div>
                <p>{t('options.education.empty')}</p>
                <p style={{ fontSize: '12px' }}>{t('options.education.emptyHint')}</p>
              </div>
            ) : (
              educations.map((edu, index) => (
                <div key={edu.id} className="ca-card" style={{ marginBottom: '16px' }}>
                  <div className="options-card-header">
                    <h3>{t('options.education.card', { index: index + 1 })}</h3>
                    <button className="ca-btn ca-btn-danger ca-btn-sm" onClick={() => deleteEducation(edu.id)}>{t('options.education.delete')}</button>
                  </div>
                  <div className="options-form-grid">
                    <div className="ca-form-group">
                      <label className="ca-label required">{t('options.education.type')}</label>
                      <select className="ca-input ca-select" value={edu.type}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, type: e.target.value as Education['type'] }; setEducations(updated); }}>
                        <option value="本科">本科</option>
                        <option value="硕士">硕士</option>
                        <option value="博士">博士</option>
                        <option value="交换">交换</option>
                      </select>
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label required">{t('options.education.school')}</label>
                      <input className="ca-input" value={edu.school}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, school: e.target.value }; setEducations(updated); }}
                        placeholder={t('options.education.schoolPlaceholder')} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.education.college')}</label>
                      <input className="ca-input" value={edu.college || ''}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, college: e.target.value }; setEducations(updated); }}
                        placeholder={t('options.education.collegePlaceholder')} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label required">{t('options.education.major')}</label>
                      <input className="ca-input" value={edu.major}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, major: e.target.value }; setEducations(updated); }}
                        placeholder={t('options.education.majorPlaceholder')} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.education.start')}</label>
                      <input className="ca-input" type="date" value={edu.startDate}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, startDate: e.target.value }; setEducations(updated); }} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.education.end')}</label>
                      <input className="ca-input" type="date" value={edu.endDate}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, endDate: e.target.value }; setEducations(updated); }} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">GPA</label>
                      <input className="ca-input" value={edu.gpa || ''}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, gpa: e.target.value }; setEducations(updated); }}
                        placeholder="如：3.8" />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.education.gpaTotal')}</label>
                      <input className="ca-input" value={edu.gpaTotal || ''}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, gpaTotal: e.target.value }; setEducations(updated); }}
                        placeholder="如：4.0" />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.education.ranking')}</label>
                      <input className="ca-input" value={edu.ranking || ''}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, ranking: e.target.value }; setEducations(updated); }}
                        placeholder="如：5/120" />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.education.cet4')}</label>
                      <input className="ca-input" value={edu.cet4 || ''}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, cet4: e.target.value }; setEducations(updated); }}
                        placeholder="如：550" />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.education.cet6')}</label>
                      <input className="ca-input" value={edu.cet6 || ''}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, cet6: e.target.value }; setEducations(updated); }}
                        placeholder="如：520" />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.education.training')}</label>
                      <select className="ca-input ca-select" value={edu.trainingMode || ''}
                        onChange={(e) => { const updated = [...educations]; updated[index] = { ...edu, trainingMode: e.target.value }; setEducations(updated); }}>
                        <option value="">{t('options.personal.select')}</option>
                        <option value="全日制">全日制</option>
                        <option value="非全日制">非全日制</option>
                      </select>
                    </div>
                  </div>
                  <button className="ca-btn ca-btn-primary" onClick={() => saveEducation(edu)} style={{ marginTop: '12px' }}>
                    {t('options.education.save')}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ===== 工作/项目经历 ===== */}
        {activePage === 'experience' && (
          <div className="options-section">
            <div className="options-section-header">
              <div>
                <h2>{t('options.experience.title')}</h2>
                <p className="options-desc">{t('options.experience.desc')}</p>
              </div>
              <button className="ca-btn ca-btn-primary" onClick={() => {
                const newExp = createEmptyExperience();
                newExp.order = experiences.length;
                setExperiences([...experiences, newExp]);
              }}>
                {t('options.experience.add')}
              </button>
            </div>

            {experiences.length === 0 ? (
              <div className="ca-empty">
                <div className="ca-empty-icon">—</div>
                <p>{t('options.experience.empty')}</p>
              </div>
            ) : (
              experiences.map((exp, index) => (
                <div key={exp.id} className="ca-card" style={{ marginBottom: '16px' }}>
                  <div className="options-card-header">
                    <h3>{t('options.experience.card', { index: index + 1 })}</h3>
                    <button className="ca-btn ca-btn-danger ca-btn-sm" onClick={() => deleteExperience(exp.id)}>{t('options.education.delete')}</button>
                  </div>
                  <div className="options-form-grid">
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.experience.type')}</label>
                      <select className="ca-input ca-select" value={exp.type}
                        onChange={(e) => { const u = [...experiences]; u[index] = { ...exp, type: e.target.value as Experience['type'] }; setExperiences(u); }}>
                        <option value="工作">工作</option>
                        <option value="实习">实习</option>
                        <option value="项目">项目</option>
                        <option value="科研">科研</option>
                        <option value="活动">活动</option>
                        <option value="竞赛">竞赛</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label required">{t('options.experience.organization')}</label>
                      <input className="ca-input" value={exp.organization}
                        onChange={(e) => { const u = [...experiences]; u[index] = { ...exp, organization: e.target.value }; setExperiences(u); }}
                        placeholder={t('options.experience.organizationPlaceholder')} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label required">{t('options.experience.role')}</label>
                      <input className="ca-input" value={exp.role}
                        onChange={(e) => { const u = [...experiences]; u[index] = { ...exp, role: e.target.value }; setExperiences(u); }}
                        placeholder={t('options.experience.rolePlaceholder')} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.experience.location')}</label>
                      <input className="ca-input" value={exp.location || ''}
                        onChange={(e) => { const u = [...experiences]; u[index] = { ...exp, location: e.target.value }; setExperiences(u); }}
                        placeholder={t('options.experience.locationPlaceholder')} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.experience.start')}</label>
                      <input className="ca-input" type="date" value={exp.startDate}
                        onChange={(e) => { const u = [...experiences]; u[index] = { ...exp, startDate: e.target.value }; setExperiences(u); }} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.experience.end')}</label>
                      <input className="ca-input" type="date" value={exp.endDate}
                        onChange={(e) => { const u = [...experiences]; u[index] = { ...exp, endDate: e.target.value }; setExperiences(u); }} />
                    </div>
                  </div>
                  <div className="ca-form-group">
                    <label className="ca-label">{t('options.experience.description')}</label>
                    <textarea className="ca-input ca-textarea" value={exp.description}
                      onChange={(e) => { const u = [...experiences]; u[index] = { ...exp, description: e.target.value }; setExperiences(u); }}
                      placeholder={t('options.experience.descriptionPlaceholder')} />
                  </div>
                  <div className="ca-form-group">
                    <label className="ca-label">{t('options.experience.bullets')}</label>
                    <textarea className="ca-input ca-textarea" value={exp.bullets.join('\n')}
                      onChange={(e) => { const u = [...experiences]; u[index] = { ...exp, bullets: e.target.value.split('\n') }; setExperiences(u); }}
                      placeholder={t('options.experience.bulletsPlaceholder')} />
                  </div>
                  <button className="ca-btn ca-btn-primary" onClick={() => saveExperience(exp)} style={{ marginTop: '12px' }}>
                    {t('options.experience.save')}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ===== AI 配置 ===== */}
        {activePage === 'ai' && (
          <div className="options-section">
            <div className="options-section-header">
              <div>
                <h2>{t('options.ai.title')}</h2>
                <p className="options-desc">{t('options.ai.desc')}</p>
              </div>
              <button className="ca-btn ca-btn-primary" onClick={() => {
                const newConfig: AIModelConfig = {
                  id: generateId(),
                  provider: 'openai',
                  name: t('options.ai.newName'),
                  model: 'gpt-4o-mini',
                  isActive: aiConfigs.length === 0,
                  createdAt: new Date().toISOString(),
                };
                setAIConfigs([...aiConfigs, newConfig]);
              }}>
                {t('options.ai.add')}
              </button>
            </div>

            {aiConfigs.length === 0 ? (
              <div className="ca-card">
                <div className="ca-empty">
                  <div className="ca-empty-icon">—</div>
                  <p>{t('options.ai.empty')}</p>
                  <p style={{ fontSize: '12px' }}>{t('options.ai.emptyHint')}</p>
                </div>
              </div>
            ) : (
              aiConfigs.map((config, index) => (
                <div key={config.id} className="ca-card" style={{ marginBottom: '16px' }}>
                  <div className="options-card-header">
                    <h3>
                      {config.name}
                      {config.isActive && <span className="ca-badge ca-badge-success" style={{ marginLeft: '8px' }}>{t('options.ai.active')}</span>}
                    </h3>
                    <button className="ca-btn ca-btn-danger ca-btn-sm" onClick={async () => {
                      await aiConfigDB.delete(config.id);
                      await loadData();
                    }}>{t('options.education.delete')}</button>
                  </div>
                  <div className="options-form-grid">
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.ai.name')}</label>
                      <input className="ca-input" value={config.name}
                        onChange={(e) => { const u = [...aiConfigs]; u[index] = { ...config, name: e.target.value }; setAIConfigs(u); }} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.ai.provider')}</label>
                      <select className="ca-input ca-select" value={config.provider}
                        onChange={(e) => {
                          const provider = e.target.value as AIModelConfig['provider'];
                          const defaultModels: Record<string, string> = {
                            openai: 'gpt-4o-mini',
                            claude: 'claude-3-5-sonnet-20241022',
                            deepseek: 'deepseek-chat',
                            minimax: 'MiniMax-Text-01',
                            zhipu: 'glm-4-flash',
                            moonshot: 'moonshot-v1-8k',
                            qianwen: 'qwen-turbo',
                            doubao: 'doubao-pro-4k',
                            baichuan: 'Baichuan4',
                            ollama: 'llama3',
                            custom: '',
                          };
                          const u = [...aiConfigs];
                          u[index] = { ...config, provider, model: defaultModels[provider] || config.model };
                          setAIConfigs(u);
                        }}>
                        <option value="openai">OpenAI</option>
                        <option value="claude">Anthropic Claude</option>
                        <option value="deepseek">DeepSeek 深度求索</option>
                        <option value="minimax">MiniMax</option>
                        <option value="zhipu">智谱 GLM</option>
                        <option value="moonshot">月之暗面 Kimi</option>
                        <option value="qianwen">阿里通义千问</option>
                        <option value="doubao">字节跳动豆包</option>
                        <option value="baichuan">百川智能</option>
                        <option value="ollama">Ollama（本地）</option>
                        <option value="custom">自定义（兼容 OpenAI 格式）</option>
                      </select>
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.ai.model')}</label>
                      <input className="ca-input" value={config.model}
                        onChange={(e) => { const u = [...aiConfigs]; u[index] = { ...config, model: e.target.value }; setAIConfigs(u); }}
                        placeholder={t('options.ai.modelPlaceholder')} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">API Key</label>
                      <input className="ca-input" type="password" value={config.apiKey || ''}
                        onChange={(e) => { const u = [...aiConfigs]; u[index] = { ...config, apiKey: e.target.value }; setAIConfigs(u); }}
                        placeholder={t('options.ai.apiKeyPlaceholder')} />
                    </div>
                    <div className="ca-form-group">
                      <label className="ca-label">{t('options.ai.baseUrl')}</label>
                      <input className="ca-input" value={config.baseUrl || ''}
                        onChange={(e) => { const u = [...aiConfigs]; u[index] = { ...config, baseUrl: e.target.value }; setAIConfigs(u); }}
                        placeholder={t('options.ai.baseUrlPlaceholder')} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button className="ca-btn ca-btn-primary" onClick={() => saveAIConfig(config)}>
                      {t('options.ai.save')}
                    </button>
                    {!config.isActive && (
                      <button className="ca-btn ca-btn-outline" onClick={() => saveAIConfig({ ...config, isActive: true })}>
                        {t('options.ai.setDefault')}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            <div className="ca-card options-note options-note-success" style={{ marginTop: '16px' }}>
              <h4>{t('options.ai.securityTitle')}</h4>
              <ul>
                <li>{t('options.ai.security.1')}</li>
                <li>{t('options.ai.security.2')}</li>
                <li>{t('options.ai.security.3')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* ===== 简历解析 ===== */}
        {activePage === 'resume' && (
          <div className="options-section">
            <h2>{t('options.resume.title')}</h2>
            <p className="options-desc">{t('options.resume.desc')}</p>
            <Suspense fallback={<div className="ca-card options-loading">{t('options.resume.loading')}</div>}>
              <ResumeUpload onComplete={loadData} />
            </Suspense>
          </div>
        )}

        {/* ===== 数据备份 ===== */}
        {activePage === 'backup' && (
          <div className="options-section">
            <h2>{t('options.backup.title')}</h2>
            <p className="options-desc">{t('options.backup.desc')}</p>

            <div className="backup-cards">
              <div className="ca-card">
                <h3>{t('options.backup.exportTitle')}</h3>
                <p style={{ fontSize: '13px', color: 'var(--ca-text-secondary)', margin: '8px 0' }}>
                  {t('options.backup.exportDesc')}
                </p>
                <button className="ca-btn ca-btn-primary" onClick={handleExport}>
                  {t('options.backup.exportButton')}
                </button>
              </div>

              <div className="ca-card">
                <h3>{t('options.backup.importTitle')}</h3>
                <p style={{ fontSize: '13px', color: 'var(--ca-text-secondary)', margin: '8px 0' }}>
                  {t('options.backup.importDesc')}
                </p>
                <button className="ca-btn ca-btn-outline" onClick={handleImport}>
                  {t('options.backup.importButton')}
                </button>
              </div>
            </div>

            <div className="ca-card options-note options-note-info" style={{ marginTop: '16px' }}>
              <h4>{t('options.backup.tipsTitle')}</h4>
              <ul>
                <li>{t('options.backup.tip.1')}</li>
                <li>{t('options.backup.tip.2')}</li>
                <li>{t('options.backup.tip.3')}</li>
              </ul>
            </div>
          </div>
        )}

        {activePage === 'settings' && (
          <div className="options-section settings-page">
            <h2>{t('options.settings.title')}</h2>
            <p className="options-desc">{t('options.settings.desc')}</p>

            <div className="settings-grid">
              <section className="settings-card">
                <div className="settings-card-copy">
                  <ProductIcon name="settings" className="settings-card-icon" />
                  <div>
                    <h3>{t('options.settings.languageTitle')}</h3>
                    <p>{t('options.settings.languageDesc')}</p>
                  </div>
                </div>
                <LanguageSwitcher showLabel className="settings-control" />
              </section>

              <section className="settings-card">
                <div className="settings-card-copy">
                  <ProductIcon name="shield" className="settings-card-icon" />
                  <div>
                    <h3>{t('options.settings.appearanceTitle')}</h3>
                    <p>{t('options.settings.appearanceDesc')}</p>
                  </div>
                </div>
                <AppearanceSwitcher showLabel className="settings-control" />
              </section>
            </div>

            <section className="settings-scope">
              <h3>{t('options.settings.scopeTitle')}</h3>
              <p>{t('options.settings.scopeDesc')}</p>
            </section>
          </div>
        )}

        {activePage === 'help' && (
          <div className="options-section help-page">
            <div className="options-section-header">
              <div>
                <h2>{t('options.help.title')}</h2>
                <p className="options-desc">{t('options.help.desc')}</p>
              </div>
            </div>

            <section className="help-about">
              <div className="help-about-main">
                <span className="help-about-logo" aria-hidden="true">
                  <BrandMark />
                </span>
                <div>
                  <h3>{t('options.help.aboutTitle')}</h3>
                  <p>{t('options.help.aboutDesc')}</p>
                  <p>{t('options.help.githubDesc')}</p>
                  <div className="help-about-actions">
                    <a className="ca-btn ca-btn-primary ca-btn-sm" href={GITHUB_URL} target="_blank" rel="noreferrer">
                      <ProductIcon name="backup" className="ca-btn-icon" />
                      {t('app.github')}
                    </a>
                    <span>{t('app.copyright')}</span>
                  </div>
                </div>
              </div>
              <div className="help-trust-card">
                <ProductIcon name="shield" className="help-trust-icon" />
                <h3>{t('options.help.trustTitle')}</h3>
                <p>{t('options.help.trustDesc')}</p>
              </div>
            </section>

            <div className="help-grid">
              <section className="help-block help-block-primary">
                <ProductIcon name="database" className="help-block-icon" />
                <div>
                  <h3>{t('options.help.step1.title')}</h3>
                  <p>{t('options.help.step1.desc')}</p>
                </div>
              </section>

              <section className="help-block">
                <ProductIcon name="resume" className="help-block-icon" />
                <div>
                  <h3>{t('options.help.step2.title')}</h3>
                  <p>{t('options.help.step2.desc')}</p>
                </div>
              </section>

              <section className="help-block">
                <ProductIcon name="settings" className="help-block-icon" />
                <div>
                  <h3>{t('options.help.step3.title')}</h3>
                  <p>{t('options.help.step3.desc')}</p>
                </div>
              </section>

              <section className="help-block">
                <ProductIcon name="scan" className="help-block-icon" />
                <div>
                  <h3>{t('options.help.step4.title')}</h3>
                  <p>{t('options.help.step4.desc')}</p>
                </div>
              </section>

              <section className="help-block">
                <ProductIcon name="spark" className="help-block-icon" />
                <div>
                  <h3>{t('options.help.step5.title')}</h3>
                  <p>{t('options.help.step5.desc')}</p>
                </div>
              </section>

              <section className="help-block">
                <ProductIcon name="shield" className="help-block-icon" />
                <div>
                  <h3>{t('options.help.step6.title')}</h3>
                  <p>{t('options.help.step6.desc')}</p>
                </div>
              </section>
            </div>

            <section className="help-checklist">
              <h3>{t('options.help.checklistTitle')}</h3>
              <div className="help-checklist-grid">
                <label><input type="checkbox" /> {t('options.help.check.1')}</label>
                <label><input type="checkbox" /> {t('options.help.check.2')}</label>
                <label><input type="checkbox" /> {t('options.help.check.3')}</label>
                <label><input type="checkbox" /> {t('options.help.check.4')}</label>
                <label><input type="checkbox" /> {t('options.help.check.5')}</label>
                <label><input type="checkbox" /> {t('options.help.check.6')}</label>
              </div>
            </section>

            <section className="help-troubleshooting">
              <h3>{t('options.help.troubleTitle')}</h3>
              <details open>
                <summary>{t('options.help.trouble.scan.q')}</summary>
                <p>{t('options.help.trouble.scan.a')}</p>
              </details>
              <details>
                <summary>{t('options.help.trouble.dropdown.q')}</summary>
                <p>{t('options.help.trouble.dropdown.a')}</p>
              </details>
              <details>
                <summary>{t('options.help.trouble.answer.q')}</summary>
                <p>{t('options.help.trouble.answer.a')}</p>
              </details>
              <details>
                <summary>{t('options.help.trouble.privacy.q')}</summary>
                <p>{t('options.help.trouble.privacy.a')}</p>
              </details>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
