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
type ParsedResumeData = NonNullable<ResumeParseResult['data']>;
type LinkCategory = 'github' | 'linkedin' | 'portfolio' | 'sns' | 'project' | 'company' | 'other';
type ExtractedLink = { url: string; label?: string; category: LinkCategory };

const SOURCE_KEY = '__resumeBridgeSourceKey';
const PDF_LINKS_HEADER = 'PDF_HIDDEN_LINKS';

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

function normalizeLookupKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-./\\()[\]{}:：,，|]+/g, '');
}

function readValue(source: ParsedObject, keys: string[]): unknown {
  let fallback: unknown;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];
      if (hasValue(value)) return value;
      if (fallback === undefined) fallback = value;
    }
  }

  const normalizedEntries = Object.entries(source).map(([key, value]) => [normalizeLookupKey(key), value] as const);
  for (const key of keys) {
    const normalizedKey = normalizeLookupKey(key);
    const match = normalizedEntries.find(([candidate]) => candidate === normalizedKey);
    if (match) {
      if (hasValue(match[1])) return match[1];
      if (fallback === undefined) fallback = match[1];
    }
  }

  return fallback;
}

function pickString(source: ParsedObject, keys: string[]): string {
  return asString(readValue(source, keys));
}

function pickArray(source: ParsedObject, keys: string[]): unknown[] {
  const value = readValue(source, keys);
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return [value];
  return [];
}

function withSource(value: unknown, sourceKey: string): unknown {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as ParsedObject), [SOURCE_KEY]: sourceKey }
    : value;
}

function collectArrays(source: ParsedObject, keys: string[]): unknown[] {
  return keys.flatMap((key) => {
    const value = readValue(source, [key]);
    if (Array.isArray(value)) return value.map((item) => withSource(item, key));
    return value && typeof value === 'object' ? [withSource(value, key)] : [];
  });
}

function mergeObjectSections(source: ParsedObject, keys: string[]): ParsedObject {
  return keys.reduce<ParsedObject>((merged, key) => {
    const value = readValue(source, [key]);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? { ...merged, ...(value as ParsedObject) }
      : merged;
  }, { ...source });
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asString).filter(Boolean);
  const raw = asString(value);
  if (!raw) return [];
  return raw.split(/\n|,|，|、|；|;/).map((item) => item.trim()).filter(Boolean);
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim().replace(/[),，。；;]+$/g, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[A-Za-z]{2,}(?:\/\S*)?$/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"'）)，。；;]+|(?:www\.)?[\w.-]+\.[A-Za-z]{2,}(?:\/[^\s<>"'）)，。；;]*)?/gi) || [];
  const urls = matches
    .map(normalizeUrl)
    .filter((url) => /^https?:\/\//i.test(url));
  return Array.from(new Set(urls));
}

function classifyUrl(url: string, label = ''): LinkCategory {
  const value = `${url} ${label}`.toLowerCase();
  if (/github\.com/.test(value)) return 'github';
  if (/linkedin\.com|领英/.test(value)) return 'linkedin';
  if (/twitter\.com|x\.com|weibo\.com|zhihu\.com|bilibili\.com|medium\.com|facebook\.com|instagram\.com|sns|social|社交|主页/.test(value)) {
    return 'sns';
  }
  if (/project|demo|作品|case|prototype|figma\.com|behance\.net|dribbble\.com|项目/.test(value)) {
    return 'project';
  }
  if (/portfolio|作品集|个人网站|个人主页|homepage|personal|blog|博客|notion\.site|vercel\.app|netlify\.app|github\.io/.test(value)) {
    return 'portfolio';
  }
  if (/company|corp|inc|ltd|招聘|career|careers|about|公司|企业|官网/.test(value)) {
    return 'company';
  }
  return 'other';
}

function parseHiddenLinkLines(text: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith(`${PDF_LINKS_HEADER}:`)) continue;
    const payload = line.slice(PDF_LINKS_HEADER.length + 1).trim();
    const parts = payload.split(/\s+\|\s+/);
    const url = normalizeUrl(parts[0] || '');
    if (!/^https?:\/\//i.test(url)) continue;
    const label = parts.find((part) => part.startsWith('label='))?.replace(/^label=/, '').trim() || '';
    const categoryText = parts.find((part) => part.startsWith('category='))?.replace(/^category=/, '').trim() || '';
    const category = ['github', 'linkedin', 'portfolio', 'sns', 'project', 'company', 'other'].includes(categoryText)
      ? categoryText as LinkCategory
      : classifyUrl(url, label);
    links.push({ url, label, category });
  }
  return links;
}

function collectLinksFromSourceText(text: string): ExtractedLink[] {
  const explicitUrls = extractUrlsFromText(text).map((url) => ({
    url,
    label: '',
    category: classifyUrl(url),
  }));
  const hiddenLinks = parseHiddenLinkLines(text);
  const byUrl = new Map<string, ExtractedLink>();
  [...explicitUrls, ...hiddenLinks].forEach((link) => {
    const existing = byUrl.get(link.url);
    if (!existing || existing.category === 'other') {
      byUrl.set(link.url, link);
    }
  });
  return Array.from(byUrl.values());
}

function mergeLinksIntoParsedData(data: ParsedResumeData, sourceText: string): void {
  const links = collectLinksFromSourceText(sourceText);
  if (!links.length) return;

  const personalInfo = data.personalInfo || {};
  for (const link of links) {
    if (link.category === 'github' && !personalInfo.github) personalInfo.github = link.url;
    if (link.category === 'linkedin' && !personalInfo.linkedin) personalInfo.linkedin = link.url;
    if ((link.category === 'portfolio' || link.category === 'sns') && !personalInfo.portfolio) {
      personalInfo.portfolio = link.url;
    }
  }

  if (Object.values(personalInfo).some(hasValue)) {
    data.personalInfo = personalInfo;
  }

  const experienceLinks = links.filter((link) => link.category === 'project' || link.category === 'company');
  if (!experienceLinks.length) return;

  for (const link of experienceLinks) {
    const match = data.experiences?.find((exp) => {
      if (exp.url) return false;
      const identity = `${exp.organization || ''} ${exp.role || ''} ${exp.description || ''} ${exp.bullets?.join(' ') || ''}`.toLowerCase();
      const host = new URL(link.url).hostname.replace(/^www\./, '').split('.')[0];
      return Boolean(host && identity.includes(host)) || Boolean(link.label && identity.includes(link.label.toLowerCase()));
    }) || data.experiences?.find((exp) =>
      !exp.url && link.category === 'project' && exp.type === '项目'
    ) || data.experiences?.find((exp) =>
      !exp.url && link.category === 'company' && (exp.type === '工作' || exp.type === '实习')
    );
    if (match) {
      match.url = link.url;
      continue;
    }

    if (link.category === 'project') {
      data.experiences = data.experiences || [];
      data.experiences.push({
        type: '项目',
        organization: link.label || new URL(link.url).hostname.replace(/^www\./, ''),
        role: '',
        startDate: '',
        endDate: '',
        url: link.url,
        description: link.label ? `${link.label} 项目链接` : '项目链接',
        bullets: [],
      });
    }
  }
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
  const nested = readValue(parsed, ['resume', 'resumeData', 'resume_data', 'data', 'result', 'profile', 'candidate', '简历']);
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

function createEmptyParsedData(): ParsedResumeData {
  return {
    personalInfo: {},
    educations: [],
    experiences: [],
    skills: [],
  };
}

function hasParsedResumeData(data: ParsedResumeData): boolean {
  return Boolean(
    Object.values(data.personalInfo || {}).some(hasValue) ||
    data.educations?.length ||
    data.experiences?.length ||
    data.skills?.length
  );
}

function mergePersonalInfo(
  primary?: Partial<PersonalInfo>,
  fallback?: Partial<PersonalInfo>
): Partial<PersonalInfo> {
  const merged = { ...(fallback || {}) };
  for (const [key, value] of Object.entries(primary || {})) {
    if (hasValue(value)) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

function mergeParsedResumeData(primary: ParsedResumeData, fallback: ParsedResumeData): ParsedResumeData {
  return {
    personalInfo: mergePersonalInfo(primary.personalInfo, fallback.personalInfo),
    educations: primary.educations?.length ? primary.educations : fallback.educations,
    experiences: primary.experiences?.length ? primary.experiences : fallback.experiences,
    skills: primary.skills?.length ? primary.skills : fallback.skills,
  };
}

function inferExperienceType(value: unknown): Experience['type'] {
  return normalizeExperienceType(value || '');
}

function inferExperienceTypeFromSource(exp: ParsedObject): Experience['type'] {
  return inferExperienceType(exp.type ?? exp.category ?? exp['类型'] ?? exp['经历类型'] ?? exp[SOURCE_KEY]);
}

export function normalizeParsedResumeData(
  parsedResume: Record<string, unknown>,
  sourceText = ''
): ParsedResumeData {
  const parsed = normalizeResumeJson(parsedResume);
  const data = createEmptyParsedData();

  // 映射个人信息
  const personalInfo = mergeObjectSections(parsed, [
    'personalInfo',
    'personal_info',
    'basicInfo',
    'basic_info',
    'basicInformation',
    'candidateInfo',
    'applicant',
    'profile',
    'contact',
    'contactInfo',
    'contact_info',
    '个人信息',
    '基础信息',
    '基本信息',
    '联系方式',
  ]);

  if (
    pickString(personalInfo, ['name', 'fullName', 'full_name', 'candidateName', '姓名', '姓名/名称']) ||
    pickString(personalInfo, ['phone', 'mobile', 'telephone', 'tel', 'phoneNumber', 'mobilePhone', '手机号', '手机', '电话', '联系电话']) ||
    pickString(personalInfo, ['email', 'mail', 'emailAddress', '邮箱'])
  ) {
    data.personalInfo = {
      name: pickString(personalInfo, ['name', 'fullName', 'full_name', 'candidateName', '姓名', '姓名/名称']),
      nameEn: pickString(personalInfo, ['nameEn', 'englishName', 'english_name', '英文名', '英文姓名']),
      gender: normalizeGender(readValue(personalInfo, ['gender', 'sex', '性别'])),
      phone: pickString(personalInfo, ['phone', 'mobile', 'telephone', 'tel', 'phoneNumber', 'mobilePhone', '手机号', '手机', '电话', '联系电话']),
      email: pickString(personalInfo, ['email', 'mail', 'emailAddress', '邮箱']),
      birthDate: normalizeDate(readValue(personalInfo, ['birthDate', 'birthday', 'dateOfBirth', 'date_of_birth', '出生日期', '生日'])),
      nativePlace: pickString(personalInfo, ['nativePlace', 'hometown', 'birthplace', '籍贯', '家乡']),
      politicalStatus: pickString(personalInfo, ['politicalStatus', 'political_status', '政治面貌']),
      currentCity: pickString(personalInfo, ['currentCity', 'current_city', 'city', 'location', 'address', '现居城市', '所在地', '居住地']),
      ethnicity: pickString(personalInfo, ['ethnicity', '民族']),
      wechat: pickString(personalInfo, ['wechat', 'weChat', 'weixin', '微信']),
      linkedin: pickString(personalInfo, ['linkedin', 'linkedIn', 'LinkedIn', '领英', 'linkedinUrl', 'linkedInUrl']),
      github: pickString(personalInfo, ['github', 'GitHub', 'githubUrl']),
      portfolio: pickString(personalInfo, ['portfolio', 'website', 'personalWebsite', 'homepage', 'blog', '作品集', '个人网站', '个人主页', '博客']),
      expectedSalary: pickString(personalInfo, ['expectedSalary', 'salaryExpectation', '期望薪资', '薪资期望']),
      availableDate: normalizeDate(readValue(personalInfo, ['availableDate', 'availability', '可到岗日期', '到岗时间'])),
      targetCities: normalizeStringArray(readValue(personalInfo, ['targetCities', 'targetCity', 'preferredCities', '意向城市', '期望城市'])),
      targetPositions: normalizeStringArray(readValue(personalInfo, ['targetPositions', 'targetPosition', 'desiredPosition', 'preferredPosition', '意向岗位', '期望岗位'])),
    };
  }

  // 映射教育经历
  const educations = pickArray(parsed, [
    'educations',
    'education',
    'educationList',
    'educationExperience',
    'educationExperiences',
    'education_experience',
    'education_experiences',
    'academicBackground',
    'academic_background',
    'academicExperience',
    'schools',
    'degrees',
    '教育经历',
    '教育背景',
    '学习经历',
  ]);
  if (educations.length) {
    data.educations = educations
      .filter((edu): edu is ParsedObject => Boolean(edu) && typeof edu === 'object' && !Array.isArray(edu))
      .map((edu) => {
        const dates = pickDatePair(
          edu,
          ['startDate', 'start_date', 'start', 'from', 'beginDate', 'begin_date', '入学时间', '开始时间', '开始日期'],
          ['endDate', 'end_date', 'end', 'to', 'finishDate', 'finish_date', 'graduationDate', 'graduation_date', '毕业时间', '结束时间', '结束日期'],
          ['dateRange', 'date_range', 'period', 'duration', 'time', '时间', '起止时间', '在校时间']
        );
        return {
          type: normalizeEducationType(readValue(edu, ['type', 'educationType', 'education_type', 'level', '学历', '学历层次']) ?? readValue(edu, ['degree', '学位'])),
          school: pickString(edu, ['school', 'university', 'institution', 'schoolName', 'universityName', '学校', '学校名称', '院校', '大学']),
          schoolEn: pickString(edu, ['schoolEn', 'schoolEnglishName', '英文学校']),
          college: pickString(edu, ['college', 'department', 'faculty', 'schoolDepartment', '学院', '院系']),
          major: pickString(edu, ['major', 'field', 'fieldOfStudy', 'field_of_study', 'majorName', '专业', '研究方向']),
          degree: pickString(edu, ['degree', 'degreeName', '学位']),
          startDate: dates.startDate,
          endDate: dates.endDate,
          gpa: pickString(edu, ['gpa', 'GPA', '绩点']),
          gpaTotal: pickString(edu, ['gpaTotal', 'gpaScale', 'gpa_scale', '满绩点']),
          ranking: pickString(edu, ['ranking', 'rank', '排名']),
          trainingMode: pickString(edu, ['trainingMode', 'studyMode', '培养方式', '学习方式']),
          mainCourses: normalizeStringArray(readValue(edu, ['mainCourses', 'courses', '主修课程', '主要课程'])),
          awards: normalizeStringArray(readValue(edu, ['awards', 'honors', '奖项', '荣誉'])),
        };
      })
      .filter((edu) => edu.school || edu.major);
  }

  // 映射工作/项目经历
  const experiences = collectArrays(parsed, [
    'experiences',
    'experience',
    'experienceList',
    'experience_list',
    'professionalExperience',
    'professional_experience',
    'employmentHistory',
    'employment_history',
    'workExperiences',
    'work_experiences',
    'projectExperiences',
    'project_experiences',
    'internshipExperiences',
    'internship_experiences',
    'researchExperiences',
    'research_experiences',
    'activityExperiences',
    'activity_experiences',
    'workExperience',
    'work_experience',
    'projectExperience',
    'project_experience',
    'internshipExperience',
    'internship_experience',
    'researchExperience',
    'research_experience',
    'activities',
    'projects',
    'project',
    'internships',
    'work',
    'works',
    'jobs',
    '工作经历',
    '实习经历',
    '项目经历',
    '科研经历',
    '校园经历',
    '活动经历',
    '经历',
  ]);
  if (experiences.length) {
    data.experiences = experiences
      .filter((exp): exp is ParsedObject => Boolean(exp) && typeof exp === 'object' && !Array.isArray(exp))
      .map((exp) => {
        const dates = pickDatePair(
          exp,
          ['startDate', 'start_date', 'start', 'from', 'beginDate', 'begin_date', '开始时间', '开始日期'],
          ['endDate', 'end_date', 'end', 'to', 'finishDate', 'finish_date', '结束时间', '结束日期'],
          ['dateRange', 'date_range', 'period', 'duration', 'time', '时间', '起止时间', '任职时间', '项目时间']
        );
        const organization = pickString(exp, ['organization', 'company', 'employer', 'institution', 'team', 'client', 'projectName', 'project_name', 'name', '公司', '组织', '公司/组织', '单位', '项目方', '团队', '项目名称']);
        const role = pickString(exp, ['role', 'position', 'title', 'jobTitle', 'job_title', '岗位', '角色', '职位', '职务', '项目角色']);
        return {
          type: inferExperienceTypeFromSource(exp),
          organization,
          role,
          startDate: dates.startDate,
          endDate: dates.endDate,
          location: pickString(exp, ['location', 'city', '地点', '城市']),
          url: pickString(exp, ['url', 'link', 'website', 'projectUrl', 'project_url', 'demoUrl', 'demo_url', 'companyUrl', 'company_url', '项目链接', '项目网址', '作品链接', '公司网址', '官网']),
          description: pickString(exp, ['description', 'summary', 'overview', 'projectDescription', 'project_description', '描述', '核心描述', '项目描述', '简介']),
          bullets: normalizeBullets(readValue(exp, ['bullets', 'bulletPoints', 'highlights', 'achievements', 'responsibilities', 'details', 'content', '要点', '职责', '成果', '工作内容', '项目内容'])),
          techStack: normalizeStringArray(readValue(exp, ['techStack', 'technologies', 'tools', '技术栈', '使用技术', '工具'])),
          achievements: normalizeStringArray(readValue(exp, ['achievements', 'results', '成果', '项目成果', '工作成果'])),
        };
      })
      .filter((exp) => exp.organization || exp.role || exp.description || exp.bullets.length);
  }

  data.skills = normalizeStringArray(readValue(parsed, ['skills', 'skill', 'technicalSkills', 'technical_skills', '技能', '专业技能']));

  const merged = mergeParsedResumeData(data, extractResumeDataFromText(sourceText));
  mergeLinksIntoParsedData(merged, sourceText);
  return merged;
}

function cleanResumeText(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function nonEmptyLines(text: string): string[] {
  return cleanResumeText(text)
    .split('\n')
    .map((line) => line.replace(/^[-•●▪*·\s]+/, '').trim())
    .filter(Boolean);
}

function pickRegex(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return '';
}

function stripLabel(value: string): string {
  return value.replace(/^(姓名|中文名|电话|手机|手机号|邮箱|电子邮箱|学校|院校|专业|公司|单位|岗位|职位|项目名称)\s*[:：]\s*/, '').trim();
}

function extractLikelyName(text: string, lines: string[]): string {
  const labeled = pickRegex(text, [
    /(?:^|\n)\s*(?:姓名|中文名|Name)\s*[:：]\s*([^\n|｜,，]{2,40})/i,
  ]);
  if (labeled) return stripLabel(labeled);

  const firstUsefulLine = lines.find((line) => {
    if (/@|电话|手机|邮箱|教育|工作|项目|经历|求职|应聘|resume|cv/i.test(line)) return false;
    return /^[\u4e00-\u9fa5]{2,5}(?:\s|$)/.test(line) || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}$/.test(line);
  });

  return firstUsefulLine ? stripLabel(firstUsefulLine.split(/[|｜,，]/)[0]) : '';
}

function getSectionLines(lines: string[], startKeywords: string[], stopKeywords: string[]): string[] {
  const startIndex = lines.findIndex((line) => startKeywords.some((keyword) => line.includes(keyword)));
  if (startIndex < 0) return [];

  const sectionLines: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (stopKeywords.some((keyword) => line.includes(keyword)) && sectionLines.length > 0) break;
    sectionLines.push(line);
  }

  return sectionLines.filter(Boolean);
}

function firstLineMatching(lines: string[], patterns: RegExp[]): string {
  return lines.find((line) => patterns.some((pattern) => pattern.test(line))) || '';
}

function extractEducationFromText(lines: string[]): Partial<Education>[] {
  const section = getSectionLines(
    lines,
    ['教育经历', '教育背景', '学习经历', 'Education'],
    ['工作经历', '实习经历', '项目经历', '科研经历', '校园经历', '工作经验', '专业技能', '技能', '证书', '获奖', 'Experience', 'Project', 'Skills']
  );
  const source = section.length ? section : lines;
  const schoolLine = firstLineMatching(source, [/大学|学院|学校|University|College|Institute/i]);
  const majorLine = firstLineMatching(source, [/专业|Major|硕士|本科|博士|Bachelor|Master|PhD/i]);
  const dateLine = firstLineMatching(source, [/\d{4}[./年-]\s*\d{1,2}|\d{4}\s*[-~–—至]\s*\d{4}|至今|Present/i]);

  const school = stripLabel(pickRegex(schoolLine, [
    /(?:学校|院校|毕业院校)\s*[:：]\s*([^|｜,，]+)/,
    /([\u4e00-\u9fa5A-Za-z\s]*(?:大学|学院|学校|University|College|Institute)[\u4e00-\u9fa5A-Za-z\s]*)/,
  ]) || schoolLine.split(/[|｜,，]/)[0] || '');

  const major = stripLabel(pickRegex(`${majorLine}\n${schoolLine}`, [
    /(?:专业|主修|Major)\s*[:：]\s*([^|｜,，\n]+)/i,
    /([\u4e00-\u9fa5A-Za-z]+(?:专业|工程|科学|管理|经济|金融|会计|数学|计算机|软件|数据)[\u4e00-\u9fa5A-Za-z]*)/,
  ]));

  const dates = splitDateRange(dateLine);
  const type = normalizeEducationType(`${majorLine} ${schoolLine}`);

  return school || major ? [{
    type,
    school,
    major,
    startDate: dates.startDate,
    endDate: dates.endDate,
  }] : [];
}

function extractExperiencesFromText(lines: string[]): Partial<Experience>[] {
  const groups = [
    { type: '工作' as const, starts: ['工作经历', '工作经验', '职业经历', 'Employment', 'Work Experience'] },
    { type: '实习' as const, starts: ['实习经历', 'Internship'] },
    { type: '项目' as const, starts: ['项目经历', '项目经验', 'Project Experience', 'Projects'] },
  ];

  const stopKeywords = ['教育经历', '教育背景', '专业技能', '技能', '证书', '获奖', '自我评价', '个人总结', 'Education', 'Skills'];
  const experiences: Partial<Experience>[] = [];

  for (const group of groups) {
    const section = getSectionLines(lines, group.starts, stopKeywords);
    if (!section.length) continue;

    const titleLine = firstLineMatching(section, [/公司|有限公司|科技|集团|项目|系统|平台|Company|Project|Inc|Ltd/i]) || section[0];
    const roleLine = firstLineMatching(section, [/岗位|职位|角色|工程师|经理|实习生|助理|负责人|Developer|Engineer|Manager|Intern|Designer|Analyst/i]) || titleLine;
    const dateLine = firstLineMatching(section, [/\d{4}[./年-]\s*\d{1,2}|\d{4}\s*[-~–—至]\s*\d{4}|至今|Present/i]);
    const dates = splitDateRange(dateLine);

    const organization = stripLabel(pickRegex(titleLine, [
      /(?:公司|单位|组织|项目名称)\s*[:：]\s*([^|｜,，]+)/,
      /([\u4e00-\u9fa5A-Za-z0-9\s]*(?:公司|科技|集团|银行|大学|学院|实验室|项目|系统|平台|Company|Inc|Ltd)[\u4e00-\u9fa5A-Za-z0-9\s]*)/,
    ]) || titleLine.split(/[|｜,，]/)[0] || '');

    const role = stripLabel(pickRegex(roleLine, [
      /(?:岗位|职位|角色|担任)\s*[:：]\s*([^|｜,，]+)/,
      /(工程师|产品经理|项目经理|实习生|助理|负责人|开发|运营|设计师|研究员|Developer|Engineer|Manager|Intern|Designer|Analyst)/i,
    ]));

    const bullets = section
      .filter((line) => line !== titleLine && line !== roleLine && line !== dateLine)
      .map((line) => line.replace(/^[-•●▪*·\d.、\s]+/, '').trim())
      .filter((line) => line.length >= 6)
      .slice(0, 6);

    if (organization || role || bullets.length) {
      experiences.push({
        type: group.type,
        organization,
        role,
        startDate: dates.startDate,
        endDate: dates.endDate,
        description: bullets[0] || '',
        bullets,
      });
    }
  }

  return experiences;
}

function extractResumeDataFromText(text: string): ParsedResumeData {
  const cleaned = cleanResumeText(text);
  const lines = nonEmptyLines(cleaned);
  if (!cleaned || lines.length === 0) return createEmptyParsedData();

  const phone = pickRegex(cleaned, [
    /(?:手机|手机号|电话|联系电话|Mobile|Phone)\s*[:：]?\s*((?:\+?\d[\d\s-]{6,}\d))/i,
    /(?<!\d)(1[3-9]\d{9})(?!\d)/,
  ]);
  const email = pickRegex(cleaned, [
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
  ]);
  const name = extractLikelyName(cleaned, lines);

  const data = createEmptyParsedData();
  if (name || phone || email) {
    data.personalInfo = {
      name,
      phone: phone.replace(/\s+/g, ''),
      email,
    };
  }
  data.educations = extractEducationFromText(lines);
  data.experiences = extractExperiencesFromText(lines);

  return data;
}

/**
 * 从 PDF 文件中提取文本内容
 * 使用浏览器端的 FileReader 读取 PDF 文本
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/legacy/build/pdf.worker.mjs',
      import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    const textParts: string[] = [];
    const hiddenLinks: string[] = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      textParts.push(pageText);

      const annotations = await page.getAnnotations();
      annotations.forEach((annotation: Record<string, unknown>) => {
        const rawUrl = typeof annotation.url === 'string'
          ? annotation.url
          : typeof annotation.unsafeUrl === 'string'
            ? annotation.unsafeUrl
            : '';
        const url = normalizeUrl(rawUrl);
        if (!/^https?:\/\//i.test(url)) return;

        const label = typeof annotation.contentsObj === 'object' && annotation.contentsObj
          ? asString((annotation.contentsObj as Record<string, unknown>).str)
          : asString(annotation.contents);
        const category = classifyUrl(url, label);
        hiddenLinks.push(`${PDF_LINKS_HEADER}: ${url} | category=${category}${label ? ` | label=${label}` : ''}`);
      });
    }

    const uniqueHiddenLinks = Array.from(new Set(hiddenLinks));
    const text = [
      textParts.join('\n').replace(/\s+/g, ' ').trim(),
      uniqueHiddenLinks.join('\n'),
    ].filter(Boolean).join('\n');
    if (text.length < 30) {
      throw new Error('PDF 未提取到足够文本，可能是扫描版图片简历');
    }
    return text;
  } catch (e) {
    console.warn('[Resume Bridge] PDF 解析失败:', e);
    throw new Error('PDF 文本提取失败。请使用可复制文字的 PDF，或改用 Word/TXT 简历。');
  }
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
    const data = normalizeParsedResumeData(await llmParseResume(aiConfig, text), text);

    if (!hasParsedResumeData(data)) {
      return {
        success: false,
        message: '未能从简历中识别出可保存的基础信息、教育经历或工作/项目经历。请检查 AI 模型返回内容，或尝试上传文本更清晰的 Word/TXT 简历。',
        data,
      };
    }

    return {
      success: true,
      message: '简历解析成功',
      data,
    };
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
        schoolEn: edu.schoolEn || '',
        college: edu.college || '',
        major: edu.major || '',
        majorEn: edu.majorEn || '',
        degree: edu.degree || '',
        startDate: normalizeDate(edu.startDate),
        endDate: normalizeDate(edu.endDate),
        gpa: edu.gpa || '',
        gpaTotal: edu.gpaTotal || '',
        ranking: edu.ranking || '',
        trainingMode: edu.trainingMode || '',
        cet4: edu.cet4 || '',
        cet6: edu.cet6 || '',
        ielts: edu.ielts || '',
        toefl: edu.toefl || '',
        mainCourses: edu.mainCourses?.filter(Boolean) || [],
        awards: edu.awards?.filter(Boolean) || [],
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
        url: exp.url || '',
        description: exp.description || '',
        bullets: exp.bullets?.filter(Boolean) || [],
        techStack: exp.techStack?.filter(Boolean) || [],
        achievements: exp.achievements?.filter(Boolean) || [],
      };
      if (!normalized.organization && !normalized.role && !normalized.description && normalized.bullets.length === 0) continue;

      const key = experienceKey(normalized);
      if (existingKeys.has(key)) continue;

      const now = new Date().toISOString();
      await experienceDB.save({
        id: generateId(),
        ...normalized,
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
