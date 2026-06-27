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
  const normalizedLabel = normalizeLabel(field.label);
  const searchTexts = [
    normalizedLabel,
    field.placeholder || '',
    field.elementName || '',
    field.elementId || '',
    field.sectionContext || '',
  ]
    .map((t) => t.toLowerCase())
    .filter(Boolean);

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
  };
}

// =================== 第一级：规则匹配 ===================

function tryRuleMatch(
  searchTexts: string[],
  field: FormField,
  userData: UserDataContext
): MatchResult | null {
  let bestMatch: { rule: FieldMappingRule; score: number } | null = null;

  for (const rule of ALL_FIELD_RULES) {
    let matchScore = 0;

    for (const keyword of rule.keywords) {
      const kw = keyword.toLowerCase();
      for (const text of searchTexts) {
        // 精确包含匹配
        if (text.includes(kw) || kw.includes(text)) {
          // 越短的标签和关键词完全匹配，置信度越高
          const lengthRatio = Math.min(text.length, kw.length) / Math.max(text.length, kw.length);
          const score = 0.6 + lengthRatio * 0.4;
          matchScore = Math.max(matchScore, score);
        }
        // 完全相等匹配
        if (text === kw) {
          matchScore = 1.0;
        }
      }
    }

    if (matchScore > 0 && (!bestMatch || matchScore * rule.priority > bestMatch.score * bestMatch.rule.priority)) {
      bestMatch = { rule, score: matchScore };
    }
  }

  if (!bestMatch) return null;

  const { rule, score } = bestMatch;
  const value = resolveDataPath(rule.dataPath, userData, rule.transform);

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
    confidence: score,
    needOptionMatch: field.tagName === 'select',
    recommendedOption,
  };
}

// =================== 第二级：语义模糊匹配 ===================

function trySemanticMatch(
  searchTexts: string[],
  field: FormField,
  userData: UserDataContext
): MatchResult | null {
  // 基于上下文 + 字段类型的模糊推断
  const context = searchTexts.join(' ');

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
          const kwChars = kw.toLowerCase().split('');
          for (const text of searchTexts) {
            // 字符重叠率匹配
            const overlap = kwChars.filter((c) => text.includes(c)).length / kwChars.length;
            if (overlap >= 0.6 && text.length <= kw.length * 2) {
              const value = resolveDataPath(rule.dataPath, userData, rule.transform);
              if (value) {
                return {
                  fieldId: field.id,
                  label: field.label,
                  value,
                  matchedBy: 'semantic',
                  matchedRule: rule,
                  confidence: overlap * 0.7, // 语义匹配置信度较低
                  needOptionMatch: field.tagName === 'select',
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
    .replace(/请输入|请选择|请填写|可选|选填|必填/g, '') // 去掉提示文字
    .trim()
    .toLowerCase();
}
