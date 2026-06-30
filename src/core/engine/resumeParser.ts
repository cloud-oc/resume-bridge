// ============================================================
// 简历解析服务
// 支持 PDF / Word(.docx) / 纯文本 提取 + LLM 结构化
// ============================================================

import type { PersonalInfo, Education, Experience, AIModelConfig } from '@/shared/types/models';
import { llmParseResume } from './llmService';
import {
  personalInfoDB,
  educationDB,
  experienceDB,
  generateId,
} from '@/core/storage/db';

type ParsedObject = Record<string, unknown>;
type DatePair = { startDate: string; endDate: string };

/** 简历解析结果 */
export interface ResumeParseResult {
  success: boolean;
  message: string;
  data?: {
    personalInfo?: Partial<PersonalInfo>;
    educations?: Partial<Education>[];
    experiences?: Partial<Experience>[];
    skills?: string[];
  };
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
}

function pickString(source: ParsedObject, keys: string[]): string {
  for (const key of keys) {
    const value = asString(source[key]);
    if (value) return value;
  }
  return '';
}

function pickArray(source: ParsedObject, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return [value];
  }
  return [];
}

function collectArrays(source: ParsedObject, keys: string[]): unknown[] {
  return keys.flatMap((key) => {
    const value = source[key];
    if (Array.isArray(value)) return value;
    return value && typeof value === 'object' ? [value] : [];
  });
}

function mergeObjectSections(source: ParsedObject, keys: string[]): ParsedObject {
  return keys.reduce<ParsedObject>((merged, key) => {
    const value = source[key];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...merged, ...(value as ParsedObject) }
      : merged;
  }, { ...source });
}

function normalizeDate(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';
  if (/至今|现在|目前|present|current|now/i.test(raw)) return '';

  const normalized = raw.replace(/\s+/g, '').replace(/[./年]/g, '-').replace(/月/g, '').trim();
  const yearMonthDay = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yearMonthDay) {
    const [, year, month, day] = yearMonthDay;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const yearMonth = normalized.match(/^(\d{4})-(\d{1,2})$/);
  if (yearMonth) {
    const [, year, month] = yearMonth;
    return `${year}-${month.padStart(2, '0')}-01`;
  }

  const yearOnly = normalized.match(/^(\d{4})$/);
  if (yearOnly) return `${yearOnly[1]}-01-01`;

  return raw;
}

function splitDateRange(value: unknown): DatePair {
  const raw = asString(value);
  if (!raw) return { startDate: '', endDate: '' };

  const tokens = raw.match(/\d{4}-\d{1,2}(?:-\d{1,2})?|\d{4}[./年]\s*\d{1,2}(?:[./月]\s*\d{1,2})?|\d{4}|至今|现在|目前|present|current|now/gi) || [];
  if (tokens.length === 0) return { startDate: '', endDate: '' };
  if (tokens.length === 1) return { startDate: normalizeDate(tokens[0]), endDate: '' };

  return {
    startDate: normalizeDate(tokens[0]),
    endDate: normalizeDate(tokens[tokens.length - 1]),
  };
}

function pickDatePair(source: ParsedObject, startKeys: string[], endKeys: string[], rangeKeys: string[]): DatePair {
  const startDate = normalizeDate(startKeys.map((key) => source[key]).find((value) => asString(value)));
  const endDate = normalizeDate(endKeys.map((key) => source[key]).find((value) => asString(value)));
  if (startDate || endDate) return { startDate, endDate };

  return splitDateRange(pickString(source, rangeKeys));
}

function normalizeGender(value: unknown): PersonalInfo['gender'] {
  const raw = asString(value);
  if (raw.includes('女') || raw.toLowerCase() === 'female') return '女';
  if (raw.includes('男') || raw.toLowerCase() === 'male') return '男';
  if (raw) return '其他';
  return '';
}

function normalizeEducationType(value: unknown): Education['type'] {
  const raw = asString(value);
  if (raw.includes('博士')) return '博士';
  if (raw.includes('硕士') || raw.includes('研究生') || /master/i.test(raw)) return '硕士';
  if (raw.includes('交换')) return '交换';
  if (raw.includes('本科') || raw.includes('学士') || /bachelor/i.test(raw)) return '本科';
  return raw ? '其他' : '本科';
}

function normalizeExperienceType(value: unknown): Experience['type'] {
  const raw = asString(value);
  if (raw.includes('实习') || /intern/i.test(raw)) return '实习';
  if (raw.includes('项目') || /project/i.test(raw)) return '项目';
  if (raw.includes('科研') || raw.includes('研究') || /research/i.test(raw)) return '科研';
  if (raw.includes('活动') || raw.includes('社团') || raw.includes('志愿')) return '活动';
  if (raw.includes('竞赛') || raw.includes('比赛')) return '竞赛';
  if (raw.includes('其他')) return '其他';
  return '工作';
}

function normalizeBullets(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  const raw = asString(value);
  if (!raw) return [];
  return raw.split(/\n|；|;/).map((item) => item.replace(/^[-•\d.、\s]+/, '').trim()).filter(Boolean);
}

function normalizeResumeJson(parsed: ParsedObject): ParsedObject {
  const nested = parsed.resume || parsed.resumeData || parsed.data || parsed.result || parsed.profile || parsed.candidate || parsed['简历'];
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? { ...parsed, ...(nested as ParsedObject) }
    : parsed;
}

function educationKey(edu: Pick<Education, 'school' | 'major' | 'startDate' | 'endDate'> & Partial<Education>) {
  return [edu.school, edu.major, edu.degree || '', edu.startDate, edu.endDate].map((part) => part.trim().toLowerCase()).join('|');
}

function experienceKey(exp: Pick<Experience, 'organization' | 'role' | 'startDate' | 'endDate'> & Partial<Experience>) {
  const identity = [exp.organization, exp.role, exp.startDate, exp.endDate].map((part) => part.trim().toLowerCase()).join('|');
  if (identity !== '|||') return identity;
  return (exp.description || exp.bullets?.join(' ') || '').trim().toLowerCase().slice(0, 120);
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
}

function isEmptyStoredValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || value === '';
}

/**
 * 从 PDF 文件中提取文本内容
 * 使用浏览器端的 FileReader 读取 PDF 文本
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // 方案 1：使用 pdf.js CDN 来解析（如果可用）
  try {
    const arrayBuffer = await file.arrayBuffer();
    // @ts-expect-error pdfjsLib 由 CDN 提供
    if (typeof window.pdfjsLib !== 'undefined') {
      // @ts-expect-error pdfjsLib 由 CDN 提供
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const textParts: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: { str: string }) => item.str)
          .join(' ');
        textParts.push(pageText);
      }
      return textParts.join('\n');
    }
  } catch (e) {
    console.warn('[Resume Bridge] pdf.js 解析失败，使用备用方案:', e);
  }

  // 方案 2：直接读取文本（对某些 PDF 有效）
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      // 尝试提取可读文本
      const cleanText = text.replace(/[^\x20-\x7E\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleanText.length > 50) {
        resolve(cleanText);
      } else {
        reject(new Error('PDF 文本提取失败，请尝试使用纯文本简历'));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * 从 Word (.docx) 文件中提取文本
 * 使用 mammoth 库解析 .docx 格式
 */
export async function extractTextFromWord(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const text = result.value.trim();
    if (text.length < 20) {
      throw new Error('Word 文档内容太少');
    }
    if (result.messages.length > 0) {
      console.warn('[Resume Bridge] Word 解析警告:', result.messages);
    }
    return text;
  } catch (e) {
    if (e instanceof Error && e.message.includes('内容太少')) throw e;
    throw new Error('Word 文档解析失败，请确认文件格式是否正确(.docx)');
  }
}

/**
 * 从纯文本/Markdown 简历中提取文本
 */
export async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (text.trim().length < 20) {
        reject(new Error('简历内容太少'));
        return;
      }
      resolve(text);
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsText(file);
  });
}

/**
 * 解析简历文本为结构化数据
 */
export async function parseResumeText(
  text: string,
  aiConfig: AIModelConfig
): Promise<ResumeParseResult> {
  try {
    const parsed = normalizeResumeJson(await llmParseResume(aiConfig, text));

    const result: ResumeParseResult = {
      success: true,
      message: '简历解析成功',
      data: {
        personalInfo: {},
        educations: [],
        experiences: [],
        skills: [],
      },
    };

    // 映射个人信息
    const personalInfo = mergeObjectSections(parsed, [
      'personalInfo',
      'basicInfo',
      'contact',
      'contactInfo',
      '个人信息',
      '基础信息',
      '联系方式',
    ]);

    if (
      pickString(personalInfo, ['name', 'fullName', '姓名', '姓名/名称']) ||
      pickString(personalInfo, ['phone', 'mobile', 'telephone', 'tel', '手机号', '手机', '电话', '联系电话']) ||
      pickString(personalInfo, ['email', 'mail', '邮箱'])
    ) {
      result.data!.personalInfo = {
        name: pickString(personalInfo, ['name', 'fullName', '姓名', '姓名/名称']),
        gender: normalizeGender(personalInfo.gender ?? personalInfo['性别']),
        phone: pickString(personalInfo, ['phone', 'mobile', 'telephone', 'tel', '手机号', '手机', '电话', '联系电话']),
        email: pickString(personalInfo, ['email', 'mail', '邮箱']),
        birthDate: normalizeDate(personalInfo.birthDate ?? personalInfo.birthday ?? personalInfo.dateOfBirth ?? personalInfo['出生日期'] ?? personalInfo['生日']),
        nativePlace: pickString(personalInfo, ['nativePlace', 'hometown', '籍贯', '家乡']),
        politicalStatus: pickString(personalInfo, ['politicalStatus', '政治面貌']),
        currentCity: pickString(personalInfo, ['currentCity', 'city', 'location', '现居城市', '所在地', '居住地']),
        ethnicity: pickString(personalInfo, ['ethnicity', '民族']),
        wechat: pickString(personalInfo, ['wechat', 'weChat', '微信']),
        linkedin: pickString(personalInfo, ['linkedin', 'LinkedIn']),
        github: pickString(personalInfo, ['github', 'GitHub']),
        portfolio: pickString(personalInfo, ['portfolio', 'website', '作品集', '个人网站']),
      };
    }

    // 映射教育经历
    const educations = pickArray(parsed, [
      'educations',
      'education',
      'educationList',
      'educationExperience',
      'educationExperiences',
      'academicBackground',
      'schools',
      '教育经历',
      '教育背景',
      '学习经历',
    ]);
    if (educations.length) {
      result.data!.educations = educations
        .filter((edu): edu is ParsedObject => Boolean(edu) && typeof edu === 'object' && !Array.isArray(edu))
        .map((edu) => {
          const dates = pickDatePair(
            edu,
            ['startDate', 'start', 'from', 'beginDate', '入学时间', '开始时间', '开始日期'],
            ['endDate', 'end', 'to', 'finishDate', 'graduationDate', '毕业时间', '结束时间', '结束日期'],
            ['dateRange', 'period', 'duration', 'time', '时间', '起止时间', '在校时间']
          );
          return {
            type: normalizeEducationType(edu.type ?? edu.educationType ?? edu.level ?? edu.degree ?? edu['学历'] ?? edu['学位']),
            school: pickString(edu, ['school', 'university', 'institution', '学校', '学校名称', '院校', '大学']),
            college: pickString(edu, ['college', 'department', 'faculty', '学院', '院系']),
            major: pickString(edu, ['major', 'field', 'fieldOfStudy', '专业', '研究方向']),
            degree: pickString(edu, ['degree', '学位']),
            startDate: dates.startDate,
            endDate: dates.endDate,
            gpa: pickString(edu, ['gpa', 'GPA', '绩点']),
            gpaTotal: pickString(edu, ['gpaTotal', 'gpaScale', '满绩点']),
            ranking: pickString(edu, ['ranking', 'rank', '排名']),
          };
        })
        .filter((edu) => edu.school || edu.major);
    }

    // 映射工作/项目经历
    const experiences = collectArrays(parsed, [
      'experiences',
      'experience',
      'experienceList',
      'workExperiences',
      'projectExperiences',
      'internshipExperiences',
      'researchExperiences',
      'activityExperiences',
      'workExperience',
      'projectExperience',
      'internshipExperience',
      'researchExperience',
      'activities',
      'projects',
      'internships',
      'works',
      '工作经历',
      '实习经历',
      '项目经历',
      '科研经历',
      '校园经历',
      '活动经历',
      '经历',
    ]);
    if (experiences.length) {
      result.data!.experiences = experiences
        .filter((exp): exp is ParsedObject => Boolean(exp) && typeof exp === 'object' && !Array.isArray(exp))
        .map((exp) => {
          const dates = pickDatePair(
            exp,
            ['startDate', 'start', 'from', 'beginDate', '开始时间', '开始日期'],
            ['endDate', 'end', 'to', 'finishDate', '结束时间', '结束日期'],
            ['dateRange', 'period', 'duration', 'time', '时间', '起止时间', '任职时间', '项目时间']
          );
          return {
            type: normalizeExperienceType(exp.type ?? exp.category ?? exp['类型'] ?? exp['经历类型']),
            organization: pickString(exp, ['organization', 'company', 'employer', 'institution', 'team', 'client', '公司', '组织', '公司/组织', '单位', '项目方', '团队']),
            role: pickString(exp, ['role', 'position', 'title', 'jobTitle', '岗位', '角色', '职位', '职务', '项目角色']),
            startDate: dates.startDate,
            endDate: dates.endDate,
            location: pickString(exp, ['location', 'city', '地点', '城市']),
            description: pickString(exp, ['description', 'summary', 'overview', 'projectDescription', '描述', '核心描述', '项目描述', '简介']),
            bullets: normalizeBullets(exp.bullets ?? exp.highlights ?? exp.achievements ?? exp.responsibilities ?? exp.details ?? exp['要点'] ?? exp['职责'] ?? exp['成果'] ?? exp['工作内容'] ?? exp['项目内容']),
          };
        })
        .filter((exp) => exp.organization || exp.role || exp.description || exp.bullets.length);
    }

    // 技能
    if (Array.isArray(parsed.skills)) {
      result.data!.skills = parsed.skills as string[];
    }

    return result;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '解析失败',
    };
  }
}

/**
 * 将解析后的简历数据保存到本地数据库
 */
export async function saveResumeData(
  data: ResumeParseResult['data']
): Promise<{ saved: string[]; skipped: string[] }> {
  const saved: string[] = [];
  const skipped: string[] = [];

  if (!data) return { saved, skipped };

  // 保存个人信息（合并，不覆盖已有数据）
  if (data.personalInfo) {
    const existing = await personalInfoDB.get();
    const personalInfoPatch = Object.fromEntries(
      Object.entries(data.personalInfo).filter(([, value]) => hasValue(value))
    ) as Partial<PersonalInfo>;
    const hasPersonalInfo = Object.keys(personalInfoPatch).length > 0;
    if (existing) {
      // 只填充空白字段
      const merged = { ...existing };
      let changed = false;
      for (const [key, value] of Object.entries(personalInfoPatch)) {
        if (isEmptyStoredValue((merged as Record<string, unknown>)[key])) {
          (merged as Record<string, unknown>)[key] = value;
          changed = true;
        }
      }
      if (changed) {
        merged.updatedAt = new Date().toISOString();
        await personalInfoDB.save(merged);
        saved.push('个人信息');
      } else if (hasPersonalInfo) {
        skipped.push('个人信息（无新增字段）');
      }
    } else if (hasPersonalInfo) {
      // 新建
      const now = new Date().toISOString();
      await personalInfoDB.save({
        id: generateId(),
        name: personalInfoPatch.name || '',
        gender: (personalInfoPatch.gender || '') as PersonalInfo['gender'],
        birthDate: personalInfoPatch.birthDate || '',
        phone: personalInfoPatch.phone || '',
        email: personalInfoPatch.email || '',
        targetCities: [],
        targetPositions: [],
        ...personalInfoPatch,
        createdAt: now,
        updatedAt: now,
      });
      saved.push('个人信息（新建）');
    }
  }

  // 保存教育经历
  if (data.educations?.length) {
    const existing = await educationDB.getAll();
    const existingKeys = new Set(existing.map(educationKey));
    let appended = 0;

    for (const edu of data.educations) {
      const normalized = {
        type: (edu.type || '本科') as Education['type'],
        school: edu.school || '',
        college: edu.college || '',
        major: edu.major || '',
        startDate: normalizeDate(edu.startDate),
        endDate: normalizeDate(edu.endDate),
        gpa: edu.gpa || '',
        gpaTotal: edu.gpaTotal || '',
        ranking: edu.ranking || '',
      };
      if (!normalized.school && !normalized.major) continue;

      const key = educationKey(normalized);
      if (existingKeys.has(key)) continue;

      const now = new Date().toISOString();
      await educationDB.save({
        id: generateId(),
        ...normalized,
        isPrimary: existing.length === 0 && appended === 0,
        order: existing.length + appended,
        mainCourses: [],
        awards: [],
        tags: [],
        createdAt: now,
        updatedAt: now,
      });
      existingKeys.add(key);
      appended += 1;
    }

    if (appended > 0) {
      saved.push(`${appended} 条教育经历`);
      if (appended < data.educations.length) {
        skipped.push(`${data.educations.length - appended} 条重复教育经历`);
      }
    } else {
      skipped.push('教育经历（无新增数据）');
    }
  }

  // 保存工作/项目经历
  if (data.experiences?.length) {
    const existing = await experienceDB.getAll();
    const existingKeys = new Set(existing.map(experienceKey));
    let appended = 0;

    for (const exp of data.experiences) {
      const normalized = {
        type: (exp.type || '工作') as Experience['type'],
        organization: exp.organization || '',
        role: exp.role || '',
        startDate: normalizeDate(exp.startDate),
        endDate: normalizeDate(exp.endDate),
        location: exp.location || '',
        description: exp.description || '',
        bullets: exp.bullets?.filter(Boolean) || [],
      };
      if (!normalized.organization && !normalized.role && !normalized.description && normalized.bullets.length === 0) continue;

      const key = experienceKey(normalized);
      if (existingKeys.has(key)) continue;

      const now = new Date().toISOString();
      await experienceDB.save({
        id: generateId(),
        ...normalized,
        techStack: [],
        achievements: [],
        versions: [],
        abilityTags: [],
        industryTags: [],
        order: existing.length + appended,
        createdAt: now,
        updatedAt: now,
      });
      existingKeys.add(key);
      appended += 1;
    }

    if (appended > 0) {
      saved.push(`${appended} 条经历`);
      if (appended < data.experiences.length) {
        skipped.push(`${data.experiences.length - appended} 条重复经历`);
      }
    } else {
      skipped.push('经历（无新增数据）');
    }
  }

  return { saved, skipped };
}
