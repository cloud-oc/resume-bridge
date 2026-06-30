// ============================================================
// 智能字段匹配引擎
// 实现三级匹配：规则匹配 → 语义匹配 → LLM 兜底
// ============================================================

import type { FormField, PersonalInfo, Education, Experience, SkillInfo } from '@/shared/types/models';
import { ALL_FIELD_RULES, type FieldMappingRule } from './fieldMappingRules';

/** 匹配结果 */
export interface MatchResult {
  fieldId: string;
  label: string;
  /** 匹配到的值 */
  value: string;
  /** 匹配方式 */
  matchedBy: 'rule' | 'semantic' | 'llm' | 'none';
  /** 匹配的规则 */
  matchedRule?: FieldMappingRule;
  /** 匹配置信度 0-1 */
  confidence: number;
  /** 是否需要选项匹配（下拉框） */
  needOptionMatch: boolean;
  /** 推荐选项值（如果是下拉框） */
  recommendedOption?: string;
  /** 匹配诊断信息，用于结果页展示和排查 */
  reason?: string;
}

/** 用户数据上下文 */
export interface UserDataContext {
  personalInfo: PersonalInfo;
  educations: Education[];
  experiences: Experience[];
  skills: SkillInfo[];
}

// =================== 核心匹配逻辑 ===================

/**
 * 对所有表单字段执行智能匹配
 */
export function matchAllFields(
  fields: FormField[],
  userData: UserDataContext
): MatchResult[] {
  return fields.map((field) => matchSingleField(field, userData));
}

/**
 * 匹配单个表单字段
 */
export function matchSingleField(
  field: FormField,
  userData: UserDataContext
): MatchResult {
  // 标准化字段标签
  const searchTexts = buildSearchTexts(field);

  // 第一级：规则快速匹配
  const ruleMatch = tryRuleMatch(searchTexts, field, userData);
  if (ruleMatch && ruleMatch.confidence >= 0.8) {
    return ruleMatch;
  }

  // 第二级：语义相似度匹配（基于关键词模糊匹配）
  const semanticMatch = trySemanticMatch(searchTexts, field, userData);
  if (semanticMatch && semanticMatch.confidence >= 0.6) {
    return semanticMatch;
  }

  // 如果有部分匹配结果，返回置信度最高的
  if (ruleMatch) return ruleMatch;
  if (semanticMatch) return semanticMatch;

  // 无匹配
  return {
    fieldId: field.id,
    label: field.label,
    value: '',
    matchedBy: 'none',
    confidence: 0,
    needOptionMatch: field.tagName === 'select',
    reason: 'No reliable profile field matched this form label',
  };
}

// =================== 第一级：规则匹配 ===================

interface SearchText {
  text: string;
  source: 'label' | 'placeholder' | 'name' | 'id' | 'section';
  weight: number;
}

const GENERIC_LABELS = new Set([
  '',
  '未知字段',
  '字段',
  '请输入',
  '请选择',
  '描述',
  '备注',
  '说明',
  '内容',
  '其他',
  'url',
  'id',
  'urlid',
  'url/id',
]);

const ROOT_CATEGORY: Record<string, FieldMappingRule['category']> = {
  personalInfo: 'basic',
  education: 'education',
  experience: 'experience',
  skills: 'skill',
};

function buildSearchTexts(field: FormField): SearchText[] {
  const candidates: SearchText[] = [
    { text: normalizeLabel(field.label), source: 'label', weight: 1 },
    { text: normalizeLabel(field.placeholder || ''), source: 'placeholder', weight: 0.75 },
    { text: normalizeIdentifier(field.elementName || ''), source: 'name', weight: 0.9 },
    { text: normalizeIdentifier(field.elementId || ''), source: 'id', weight: 0.78 },
    { text: normalizeLabel(field.sectionContext || ''), source: 'section', weight: 0.28 },
  ];

  const unique = new Map<string, SearchText>();
  for (const candidate of candidates) {
    if (!candidate.text) continue;
    const existing = unique.get(`${candidate.source}:${candidate.text}`);
    if (!existing || candidate.weight > existing.weight) {
      unique.set(`${candidate.source}:${candidate.text}`, candidate);
    }
  }
  return Array.from(unique.values());
}

function tryRuleMatch(
  searchTexts: SearchText[],
  field: FormField,
  userData: UserDataContext
): MatchResult | null {
  if (!hasReliableIdentity(searchTexts, field)) return null;

  let bestMatch: { rule: FieldMappingRule; score: number; source: SearchText['source']; keyword: string } | null = null;

  for (const rule of ALL_FIELD_RULES) {
    let matchScore = 0;
    let matchedSource: SearchText['source'] = 'label';
    let matchedKeyword = '';

    for (const keyword of rule.keywords) {
      const kw = normalizeKeyword(keyword);
      if (!kw) continue;
      for (const candidate of searchTexts) {
        const score = scoreTextAgainstKeyword(candidate, kw, rule);
        if (score > matchScore) {
          matchScore = Math.max(matchScore, score);
          matchedSource = candidate.source;
          matchedKeyword = keyword;
        }
      }
    }

    matchScore = applyContextCompatibility(matchScore, rule, field, searchTexts);

    if (matchScore > 0 && (!bestMatch || matchScore * rule.priority > bestMatch.score * bestMatch.rule.priority)) {
      bestMatch = { rule, score: matchScore, source: matchedSource, keyword: matchedKeyword };
    }
  }

  if (!bestMatch) return null;

  const { rule, score, source, keyword } = bestMatch;
  const value = resolveDataPath(rule.dataPath, userData, rule.transform);
  if (!value) return null;

  const valueScore = validateMatchedValue(rule, value);
  if (valueScore === 0) return null;

  const finalScore = Math.min(1, score * valueScore);

  // 如果是下拉框，尝试匹配选项
  let recommendedOption: string | undefined;
  if (field.tagName === 'select' && field.options && value) {
    recommendedOption = findBestOption(value, field.options);
  }

  return {
    fieldId: field.id,
    label: field.label,
    value: recommendedOption || value,
    matchedBy: 'rule',
    matchedRule: rule,
    confidence: finalScore,
    needOptionMatch: field.tagName === 'select',
    recommendedOption,
    reason: `Rule matched "${keyword}" from ${source}`,
  };
}

function hasReliableIdentity(searchTexts: SearchText[], field: FormField): boolean {
  const label = normalizeLabel(field.label);
  const placeholder = normalizeLabel(field.placeholder || '');
  const name = normalizeIdentifier(field.elementName || '');
  const id = normalizeIdentifier(field.elementId || '');

  if (label && !GENERIC_LABELS.has(label) && label.length >= 2) return true;
  if (name && name.length >= 2) return true;
  if (id && id.length >= 2 && !/^\d+$/.test(id)) return true;
  if (placeholder && !GENERIC_LABELS.has(placeholder) && placeholder.length >= 3) return true;

  const nonSection = searchTexts.filter((item) => item.source !== 'section');
  return nonSection.some((item) => item.text.length >= 3 && !GENERIC_LABELS.has(item.text));
}

function normalizeIdentifier(text: string): string {
  return text
    .replace(/^formilyitem/i, '')
    .replace(/[_\-\s]+/g, '')
    .replace(/[^\w\u4e00-\u9fa5/]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeKeyword(keyword: string): string {
  return /[a-z0-9_ -]/i.test(keyword)
    ? normalizeIdentifier(keyword)
    : normalizeLabel(keyword);
}

function scoreTextAgainstKeyword(
  candidate: SearchText,
  keyword: string,
  rule: FieldMappingRule
): number {
  const text = candidate.text;
  if (!text || GENERIC_LABELS.has(text)) return 0;

  let base = 0;
  if (text === keyword) {
    base = 1;
  } else if (text.includes(keyword)) {
    const ratio = keyword.length / text.length;
    base = ratio >= 0.55 ? 0.74 + ratio * 0.18 : 0.58 + ratio * 0.2;
  } else if (keyword.includes(text)) {
    if (text.length < 2) return 0;
    if (text.length === 2 && !/^[\u4e00-\u9fa5]{2}$/.test(text)) return 0;
    const ratio = text.length / keyword.length;
    base = ratio >= 0.65 ? 0.6 + ratio * 0.22 : 0;
  } else if (/^[a-z0-9]+$/.test(text) && /^[a-z0-9]+$/.test(keyword)) {
    base = tokenSimilarity(text, keyword) * 0.72;
  }

  if (base <= 0) return 0;

  const sourceWeight = candidate.weight;
  const categoryBoost = rule.category === 'basic' && candidate.source !== 'section' ? 1.02 : 1;
  return Math.min(1, base * sourceWeight * categoryBoost);
}

function tokenSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let matches = 0;
  for (const char of shorter) {
    if (longer.includes(char)) matches++;
  }
  return matches / longer.length;
}

function applyContextCompatibility(
  score: number,
  rule: FieldMappingRule,
  field: FormField,
  searchTexts: SearchText[]
): number {
  if (score <= 0) return 0;

  const sectionText = normalizeLabel(field.sectionContext || '');
  const labelText = normalizeLabel(field.label);
  const mainIdentity = searchTexts
    .filter((item) => item.source !== 'section')
    .map((item) => item.text)
    .join(' ');

  if (/^(url|id|urlid)$/.test(labelText) && rule.dataPath !== 'personalInfo.github' && rule.dataPath !== 'personalInfo.linkedin' && rule.dataPath !== 'personalInfo.portfolio') {
    return 0;
  }

  if (
    /作品/.test(labelText) &&
    (rule.dataPath === 'personalInfo.github' || rule.dataPath === 'personalInfo.linkedin')
  ) {
    return score * 0.25;
  }

  if (/github/.test(labelText) && rule.dataPath !== 'personalInfo.github') {
    return score * 0.25;
  }

  if (/个人网站|个人主页|作品集|作品链接|博客|portfolio|website|blog/.test(labelText) && rule.dataPath === 'personalInfo.github') {
    return score * 0.35;
  }

  const sectionCategory = inferCategory(sectionText);
  if (sectionCategory && sectionCategory !== rule.category) {
    if (rule.category === 'basic' && !/姓名|邮箱|手机|电话|证件|身份证|email|phone|mobile|name|id/.test(mainIdentity)) {
      return score * 0.45;
    }
    if (rule.category !== 'basic') return score * 0.72;
  }

  if (/证书|竞赛|获奖|奖项|语言|社交|渠道/.test(sectionText) && rule.category === 'experience') {
    return score * 0.35;
  }

  if (/描述|说明|内容/.test(labelText) && rule.dataPath !== 'experience.description') {
    return score * 0.4;
  }

  return score;
}

function inferCategory(text: string): FieldMappingRule['category'] | undefined {
  if (!text) return undefined;
  if (/基本|基础|个人信息|联系方式/.test(text)) return 'basic';
  if (/教育|学历|学校|院校/.test(text)) return 'education';
  if (/实习|工作|项目|科研|经历/.test(text)) return 'experience';
  if (/技能|证书|语言|资质/.test(text)) return 'skill';
  if (/意向|期望|申请信息/.test(text)) return 'intention';
  return undefined;
}

function validateMatchedValue(rule: FieldMappingRule, value: string): number {
  const normalized = value.trim();
  if (!normalized) return 0;

  switch (rule.dataPath) {
    case 'personalInfo.email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? 1 : 0;
    case 'personalInfo.phone':
      return /(?:\+?\d[\d\s-]{7,}\d)/.test(normalized) ? 1 : 0;
    case 'personalInfo.idNumber':
      return /^[0-9A-Za-z]{6,24}$/.test(normalized) && /\d/.test(normalized) ? 1 : 0;
    case 'personalInfo.github':
    case 'personalInfo.linkedin':
    case 'personalInfo.portfolio':
      return /^(https?:\/\/|www\.|[A-Za-z0-9_.-]+\.[A-Za-z]{2,})/.test(normalized) ? 1 : 0.65;
    default:
      return 1;
  }
}

// =================== 第二级：语义模糊匹配 ===================

function trySemanticMatch(
  searchTexts: SearchText[],
  field: FormField,
  userData: UserDataContext
): MatchResult | null {
  if (!hasReliableIdentity(searchTexts, field)) return null;

  // 基于上下文 + 字段类型的模糊推断
  const context = searchTexts.map((item) => item.text).join(' ');
  const identityTexts = searchTexts.filter((item) => item.source !== 'section');
  if (!identityTexts.length) return null;

  // 通过上下文的关键词推断匹配
  const contextRules = [
    { test: /教育|学校|院校|学历|专业/, category: 'education' as const },
    { test: /实习|项目|工作|公司|科研|经历/, category: 'experience' as const },
    { test: /技能|技术|证书|资质/, category: 'skill' as const },
    { test: /意向|期望|求职/, category: 'intention' as const },
  ];

  for (const cr of contextRules) {
    if (cr.test.test(context)) {
      // 在该类别的规则中进行宽松匹配
      const categoryRules = ALL_FIELD_RULES.filter((r) => r.category === cr.category);
      for (const rule of categoryRules) {
        for (const kw of rule.keywords) {
          const normalizedKeyword = normalizeKeyword(kw);
          if (!normalizedKeyword) continue;
          const kwChars = normalizedKeyword.split('');
          for (const candidate of identityTexts) {
            const text = candidate.text;
            // 字符重叠率匹配
            const overlap = kwChars.filter((c) => text.includes(c)).length / kwChars.length;
            if (overlap >= 0.68 && text.length <= normalizedKeyword.length * 1.8) {
              const value = resolveDataPath(rule.dataPath, userData, rule.transform);
              if (value) {
                const score = applyContextCompatibility(overlap * 0.62 * candidate.weight, rule, field, searchTexts);
                if (score < 0.42) continue;
                return {
                  fieldId: field.id,
                  label: field.label,
                  value,
                  matchedBy: 'semantic',
                  matchedRule: rule,
                  confidence: score, // 语义匹配置信度较低
                  needOptionMatch: field.tagName === 'select',
                  reason: `Semantic overlap with "${kw}" from ${candidate.source}`,
                };
              }
            }
          }
        }
      }
    }
  }

  return null;
}

// =================== 数据路径解析 ===================

/**
 * 根据 dataPath 从用户数据中提取对应的值
 * 例如 "personalInfo.name" → userData.personalInfo.name
 */
function resolveDataPath(
  dataPath: string,
  userData: UserDataContext,
  transform?: string
): string {
  const parts = dataPath.split('.');
  const root = parts[0];
  const field = parts.slice(1).join('.');

  let rawValue: unknown;

  switch (root) {
    case 'personalInfo':
      rawValue = getNestedValue(userData.personalInfo, field);
      break;

    case 'education': {
      // 优先使用 isPrimary 的主学历
      const primaryEdu = userData.educations.find((e) => e.isPrimary) || userData.educations[0];
      if (primaryEdu) {
        rawValue = getNestedValue(primaryEdu, field);
      }
      break;
    }

    case 'experience': {
      // 使用最近的经历
      const latestExp = userData.experiences[0];
      if (latestExp) {
        rawValue = getNestedValue(latestExp, field);
      }
      break;
    }

    case 'skills':
      rawValue = userData.skills.map((s) => s.items.join('、')).join('；');
      break;

    case 'special':
      // 特殊字段，需要 LLM 生成
      rawValue = '';
      break;

    default:
      rawValue = '';
  }

  // 应用值转换
  const stringValue = rawValue != null ? String(rawValue) : '';
  if (transform && stringValue) {
    return applyTransform(transform, stringValue, userData);
  }

  return stringValue;
}

/** 获取嵌套对象的值 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

// =================== 值转换函数 ===================

function applyTransform(
  transformName: string,
  value: string,
  _userData: UserDataContext
): string {
  switch (transformName) {
    case 'extractFamilyName':
      // 中文姓名取第一个字（或前两个字如复姓）
      if (/[\u4e00-\u9fa5]/.test(value)) {
        const commonDoubleFamily = ['欧阳', '司马', '上官', '皇甫', '令狐', '诸葛', '司徒', '公孙'];
        const twoChar = value.substring(0, 2);
        if (commonDoubleFamily.includes(twoChar)) return twoChar;
        return value.substring(0, 1);
      }
      // 英文名取最后一个词
      const parts = value.trim().split(/\s+/);
      return parts[parts.length - 1];

    case 'extractGivenName':
      if (/[\u4e00-\u9fa5]/.test(value)) {
        const commonDoubleFamily = ['欧阳', '司马', '上官', '皇甫', '令狐', '诸葛', '司徒', '公孙'];
        const twoChar = value.substring(0, 2);
        if (commonDoubleFamily.includes(twoChar)) return value.substring(2);
        return value.substring(1);
      }
      const nameParts = value.trim().split(/\s+/);
      return nameParts.slice(0, -1).join(' ');

    case 'joinArray':
      // 将数组值用顿号连接
      try {
        const arr = JSON.parse(value);
        if (Array.isArray(arr)) return arr.join('、');
      } catch {
        // 可能已经是字符串
      }
      return value;

    case 'formatSkills':
      // 格式化技能列表
      return value;

    default:
      return value;
  }
}

// =================== 下拉选项匹配 ===================

/**
 * 在下拉选项中找到最匹配的选项
 */
function findBestOption(value: string, options: string[]): string | undefined {
  const normalizedValue = value.toLowerCase().trim();

  // 1. 精确匹配
  const exactMatch = options.find(
    (opt) => opt.toLowerCase().trim() === normalizedValue
  );
  if (exactMatch) return exactMatch;

  // 2. 包含匹配
  const containMatch = options.find(
    (opt) =>
      opt.toLowerCase().includes(normalizedValue) ||
      normalizedValue.includes(opt.toLowerCase().trim())
  );
  if (containMatch) return containMatch;

  // 3. 模糊匹配（针对中文选项）
  // 例如性别：值为"男"，选项可能是"男性"、"Male/男"等
  const fuzzyMatch = options.find((opt) => {
    const optLower = opt.toLowerCase().trim();
    // 检查是否有字符重叠
    const chars = normalizedValue.split('');
    const overlapCount = chars.filter((c) => optLower.includes(c)).length;
    return overlapCount >= Math.ceil(chars.length * 0.5) && chars.length > 0;
  });
  if (fuzzyMatch) return fuzzyMatch;

  // 4. 特殊值映射（性别等）
  const specialMappings: Record<string, string[]> = {
    '男': ['男', '男性', 'male', 'm', '1'],
    '女': ['女', '女性', 'female', 'f', '2'],
    '本科': ['本科', '大学本科', 'bachelor', 'undergraduate', '学士'],
    '硕士': ['硕士', '研究生', 'master', 'graduate', '硕士研究生'],
    '博士': ['博士', 'phd', 'doctor', 'doctoral', '博士研究生'],
    '群众': ['群众', '普通群众'],
    '共青团员': ['共青团员', '团员', '中国共青团员'],
    '中共党员': ['中共党员', '党员', '中国共产党党员'],
    '中共预备党员': ['中共预备党员', '预备党员'],
    '全日制': ['全日制', '统招', '普通全日制'],
    '非全日制': ['非全日制', '在职'],
  };

  const aliases = specialMappings[value];
  if (aliases) {
    for (const alias of aliases) {
      const aliasMatch = options.find(
        (opt) =>
          opt.toLowerCase().trim() === alias.toLowerCase() ||
          opt.toLowerCase().includes(alias.toLowerCase())
      );
      if (aliasMatch) return aliasMatch;
    }
  }

  return undefined;
}

// =================== 标签标准化 ===================

function normalizeLabel(label: string): string {
  return label
    .replace(/[*:\s：（）()【】\[\]]/g, '') // 去掉特殊字符
    .replace(/请输入|请选择|请填写|请将|可选|选填|必填|正确的/g, '') // 去掉提示文字
    .trim()
    .toLowerCase();
}
