// ============================================================
// 填充编排器
// 协调 扫描→匹配→填充→校验 的完整流程
// ============================================================

import type { FormField, FillResult, FillFieldResult, AIModelConfig } from '@/shared/types/models';
import { matchAllFields, type UserDataContext, type MatchResult } from './matchingEngine';
import { llmPlanFieldMatches, type LLMFieldPlan } from './llmService';
import {
  personalInfoDB,
  educationDB,
  experienceDB,
  skillDB,
  aiConfigDB,
} from '@/core/storage/db';

/** 填充进度回调 */
export type FillProgressCallback = (step: string, progress: number) => void;

/**
 * 执行完整的一键填充流程
 */
export async function executeFullFill(
  tabId: number,
  onProgress?: FillProgressCallback
): Promise<FillResult> {
  const startTime = new Date().toISOString();

  try {
    // ===== Step 1：加载用户数据 =====
    onProgress?.('正在加载用户数据...', 10);

    const userData = await loadUserData();
    if (!userData.personalInfo.name) {
      throw new Error('请先在「个人信息管理」中填写基本信息');
    }

    await ensureContentScriptReady(tabId);

    // ===== Step 2：扫描页面表单 =====
    onProgress?.('正在扫描页面表单...', 25);

    const fields = await scanPageFields(tabId);
    if (fields.length === 0) {
      throw new Error('当前页面未发现可填充的表单字段');
    }

    onProgress?.(`发现 ${fields.length} 个字段，开始匹配...`, 40);

    // ===== Step 3：执行字段匹配 =====
    const matchResults = matchAllFields(fields, userData);

    // 有 AI 配置时，使用整页上下文进行批量规划和纠错。
    const aiConfig = await aiConfigDB.getActive();
    if (aiConfig) {
      onProgress?.('正在使用 AI 规划字段匹配...', 55);
      await llmPlanMatches(matchResults, fields, aiConfig, userData);
    }

    // ===== Step 4：过滤有效匹配并执行填充 =====
    onProgress?.('正在填充表单...', 70);

    const fillData = matchResults
      .filter((match) => {
        const field = fields.find((f) => f.id === match.fieldId);
        return shouldAutoFill(match, field);
      })
      .map((m) => ({
        fieldId: m.fieldId,
        value: m.value,
        type: getFieldType(fields.find((f) => f.id === m.fieldId)),
        reviewRequired: m.reviewRequired,
        aiGenerated: m.aiGenerated,
        aiSource: m.aiSource,
        confidence: m.confidence,
        matchedFrom: m.matchedBy,
        matchReason: m.reason,
      }));

    const fillResults = await executePageFill(tabId, fillData);

    // ===== Step 5：生成结果统计 =====
    onProgress?.('填充完成，正在校验...', 90);

    const endTime = new Date().toISOString();

    // 合并匹配和填充结果
    const fieldResults: FillFieldResult[] = matchResults.map((match) => {
      const fillResult = fillResults.find((r) => r.fieldId === match.fieldId);
      const field = fields.find((f) => f.id === match.fieldId);

      if (fillResult) {
        const status = fillResult.status === 'failed'
          ? fillResult.status
          : match.reviewRequired
            ? ('pending' as const)
            : fillResult.status;
        return {
          ...fillResult,
          status,
          matchedFrom: match.matchedBy,
          confidence: match.confidence,
          matchReason: match.reason,
          reviewRequired: match.reviewRequired,
          aiGenerated: match.aiGenerated,
          aiSource: match.aiSource,
          errorMessage: fillResult.status === 'failed'
            ? fillResult.errorMessage
            : match.reviewRequired
              ? getReviewReason(match)
              : fillResult.errorMessage,
        };
      }

      return {
        fieldId: match.fieldId,
        label: field?.label || match.label,
        type: (getFieldType(field) as FillFieldResult['type']) || 'unknown',
        status: match.value ? ('pending' as const) : ('skipped' as const),
        filledValue: match.value || undefined,
        matchedFrom: match.matchedBy,
        confidence: match.confidence,
        matchReason: match.reason,
        reviewRequired: match.reviewRequired,
        aiGenerated: match.aiGenerated,
        aiSource: match.aiSource,
        errorMessage: match.value
          ? getPendingReason(match, field)
          : '未找到可靠匹配的用户数据',
      };
    });

    const result: FillResult = {
      totalFields: fields.length,
      successFields: fieldResults.filter((r) => r.status === 'success').length,
      failedFields: fieldResults.filter((r) => r.status === 'failed').length,
      pendingFields: fieldResults.filter((r) => r.status === 'pending' || r.status === 'skipped').length,
      fields: fieldResults,
      startTime,
      endTime,
    };

    onProgress?.(`✅ 完成！成功 ${result.successFields}/${result.totalFields}`, 100);

    return result;
  } catch (error) {
    throw error;
  }
}

// =================== 内部函数 ===================

/** 加载所有用户数据 */
async function loadUserData(): Promise<UserDataContext> {
  const [personalInfo, educations, experiences, skills] = await Promise.all([
    personalInfoDB.get(),
    educationDB.getAll(),
    experienceDB.getAll(),
    skillDB.getAll(),
  ]);

  const emptyInfo = {
    id: '', name: '', gender: '' as const, birthDate: '', phone: '', email: '',
    targetCities: [], targetPositions: [], createdAt: '', updatedAt: '',
  };

  return {
    personalInfo: personalInfo || emptyInfo,
    educations: educations.sort((a, b) => a.order - b.order),
    experiences: experiences.sort((a, b) => a.order - b.order),
    skills,
  };
}

/** 扫描页面表单字段 */
function scanPageFields(tabId: number): Promise<FormField[]> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('页面响应超时，请确认网申页面已加载完成'));
    }, 8000);

    chrome.tabs.sendMessage(tabId, { type: 'SCAN_FORM_FIELDS' }, (response) => {
      window.clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error('无法连接到页面，请刷新后重试'));
        return;
      }
      if (response?.success) {
        resolve(response.fields);
      } else {
        reject(new Error('页面扫描失败'));
      }
    });
  });
}

/** 执行页面填充 */
function executePageFill(
  tabId: number,
  data: {
    fieldId: string;
    value: string;
    type?: string;
    reviewRequired?: boolean;
    aiGenerated?: boolean;
    aiSource?: 'profile' | 'rewritten' | 'generated' | 'empty' | 'unknown';
    confidence?: number;
    matchedFrom?: string;
    matchReason?: string;
  }[]
): Promise<FillFieldResult[]> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error('填充响应超时，请刷新页面后重试'));
    }, 10000);

    chrome.tabs.sendMessage(tabId, { type: 'EXECUTE_FILL', data }, (response) => {
      window.clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        reject(new Error('填充执行失败'));
        return;
      }
      if (response?.success) {
        resolve(response.results);
      } else {
        reject(new Error('填充执行失败'));
      }
    });
  });
}

export async function ensureContentScriptReady(tabId: number): Promise<void> {
  const existing = await pingContentScript(tabId);
  if (existing) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch {
    throw new Error('无法在当前页面启用填充助手，请确认不是浏览器内部页面或商店页面');
  }

  const ready = await pingContentScript(tabId);
  if (!ready) {
    throw new Error('页面助手启动失败，请刷新网申页面后重试');
  }
}

function pingContentScript(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(false), 500);
    chrome.tabs.sendMessage(tabId, { type: 'RESUME_BRIDGE_PING' }, (response) => {
      window.clearTimeout(timeout);
      const lastError = chrome.runtime.lastError;
      resolve(Boolean(response?.success) && !lastError);
    });
  });
}

/** LLM 批量规划匹配 */
async function llmPlanMatches(
  matchResults: MatchResult[],
  fields: FormField[],
  aiConfig: AIModelConfig,
  userData: UserDataContext
): Promise<void> {
  const userSummary = generateUserDataSummary(userData);
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const candidates = matchResults
    .filter((match) => shouldAskLLM(match, fieldById.get(match.fieldId)))
    .sort((a, b) => getLLMPriority(b, fieldById.get(b.fieldId)) - getLLMPriority(a, fieldById.get(a.fieldId)))
    .slice(0, 48);

  const batchSize = 12;
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const plans = await llmPlanFieldMatches(
      aiConfig,
      batch
        .map((match) => {
          const field = fieldById.get(match.fieldId);
          if (!field) return null;
          return {
            field,
            currentCandidate: {
              value: match.value,
              matchedBy: match.matchedBy,
              confidence: match.confidence,
              reason: match.reason,
            },
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      userSummary
    );

    applyLLMPlans(batch, plans, fieldById);
  }
}

function shouldAskLLM(match: MatchResult, field?: FormField): boolean {
  if (!isLLMPlanningCandidate(field)) return false;
  if (match.matchedBy === 'none') return hasMeaningfulFieldIdentity(field);
  if (isHighRiskField(field)) return true;
  if (match.matchedBy === 'semantic') return true;
  if (match.matchedBy === 'rule' && match.confidence < 0.92) return true;
  return Boolean(field?.options?.length);
}

function isLLMPlanningCandidate(field?: FormField): boolean {
  if (!field) return false;
  if (field.inputType && ['password', 'file', 'checkbox'].includes(field.inputType)) return false;

  const text = `${field.label} ${field.sectionContext || ''} ${field.placeholder || ''} ${field.elementName || ''} ${field.elementId || ''}`.toLowerCase();
  if (/验证码|校验码|密码|搜索|筛选|评论|备注|隐私|协议|同意|承诺|captcha|verify|password|search|filter|comment|privacy|agree|consent/.test(text)) {
    return false;
  }

  return /姓名|电话|手机|邮箱|学校|学院|学历|专业|岗位|职位|城市|地址|公司|经历|项目|技能|证书|薪资|到岗|自我|规划|优势|意向|证件|身份证|链接|网站|github|linkedin|作品|成果|职责|描述|name|phone|mobile|email|school|college|degree|major|position|city|company|experience|skill|salary|available|summary|identity|identification|link|website|portfolio|description|responsibility/.test(text);
}

function shouldAutoFill(match: MatchResult, field?: FormField): boolean {
  if (!field || !match.value) return false;
  if (!isValueCompatibleWithField(field, match.value)) {
    match.reason = match.reason || 'Matched value failed field format checks';
    return false;
  }

  if (match.matchedBy === 'llm') return match.confidence >= (match.aiGenerated ? 0.56 : 0.62);
  if (match.matchedBy === 'rule') return match.confidence >= (isHighRiskField(field) ? 0.82 : 0.74);
  if (match.matchedBy === 'semantic') return match.confidence >= 0.68 && !isHighRiskField(field);
  return false;
}

export const __fillOrchestratorTestUtils = {
  shouldAutoFill,
  isValueCompatibleWithField,
  shouldAskLLM,
};

function getPendingReason(match: MatchResult, field?: FormField): string {
  if (!field) return '匹配到数据但未执行填充';
  if (!isValueCompatibleWithField(field, match.value)) return '匹配值与字段格式不一致，已留待确认';
  if (match.reviewRequired) return getReviewReason(match);
  if (match.confidence < 0.62) return '置信度较低，已留待确认';
  if (isHighRiskField(field)) return '字段容易误填，已留待确认';
  return '匹配到数据但未达到自动填充阈值';
}

function getReviewReason(match: MatchResult): string {
  if (match.aiGenerated) return 'AI 生成或改写内容，需人工复核后再提交';
  if (match.matchedBy === 'llm') return 'AI 智能匹配结果，建议人工确认';
  return '字段容易误填，已留待确认';
}

function isHighRiskField(field?: FormField): boolean {
  if (!field) return true;
  const text = normalizeText(`${field.label} ${field.sectionContext || ''} ${field.placeholder || ''} ${field.elementName || ''} ${field.elementId || ''}`);
  return /描述|说明|内容|经历|项目|证书|竞赛|获奖|奖项|语言|渠道|证件|身份证|url|链接|网站|id/.test(text);
}

function getLLMPriority(match: MatchResult, field?: FormField): number {
  if (!field) return 0;
  let score = 0;
  if (isHighRiskField(field)) score += 80;
  if (match.matchedBy === 'none') score += 60;
  if (match.matchedBy === 'semantic') score += 45;
  if (match.matchedBy === 'rule' && match.confidence < 0.86) score += 30;
  if (field.required) score += 12;
  if (field.tagName === 'select' || field.options?.length) score += 10;
  if (typeof field.groupIndex === 'number') score += 8;
  score += Math.max(0, 1 - match.confidence) * 20;
  return score;
}

function hasMeaningfulFieldIdentity(field?: FormField): boolean {
  if (!field) return false;
  const label = normalizeText(field.label || '');
  const placeholder = normalizeText(field.placeholder || '');
  const elementName = normalizeText(field.elementName || '');
  const elementId = normalizeText(field.elementId || '');
  const section = normalizeText(field.sectionContext || '');
  if (/^(url|id|url\/id|urlid|链接|网址|link)$/.test(label) && !/github|linkedin|领英|作品集|个人网站|项目|作品|公司官网|官网|portfolio|project|demo|company/.test(section)) {
    return false;
  }
  const text = `${label} ${placeholder} ${elementName} ${elementId}`;
  if (!text.trim()) return false;
  if (/未知字段|字段|请输入|请选择|unknownfield/.test(text) && !elementName && !elementId) return false;
  return text.replace(/未知字段|字段|请输入|请选择|unknownfield/g, '').length >= 2;
}

function applyLLMPlans(
  matches: MatchResult[],
  plans: LLMFieldPlan[],
  fieldById: Map<string, FormField>
): void {
  const planById = new Map(plans.map((plan) => [plan.fieldId, plan]));

  matches.forEach((match) => {
    const plan = planById.get(match.fieldId);
    const field = fieldById.get(match.fieldId);
    if (!plan || !field) return;

    if (!plan.value || !plan.shouldFill) {
      if (match.confidence < 0.8 || isHighRiskField(field)) {
        match.value = '';
        match.matchedBy = 'none';
        match.confidence = 0;
        match.reviewRequired = false;
        match.aiGenerated = false;
        match.aiSource = 'empty';
        match.reason = plan.reason || 'AI judged this field has no reliable profile data';
      }
      return;
    }

    if (!isValueCompatibleWithField(field, plan.value)) {
      if (match.confidence < 0.82 || isHighRiskField(field)) {
        match.value = '';
        match.matchedBy = 'none';
        match.confidence = 0;
        match.reviewRequired = false;
        match.aiGenerated = false;
        match.aiSource = 'empty';
        match.reason = plan.reason || 'AI value failed field format checks';
      }
      return;
    }

    const shouldReplace =
      plan.confidence >= Math.max(0.56, match.confidence - 0.12) ||
      isHighRiskField(field) ||
      match.matchedBy === 'none';

    if (!shouldReplace) return;

    match.value = plan.value;
    match.matchedBy = 'llm';
    match.confidence = plan.confidence;
    match.reviewRequired = plan.reviewRequired;
    match.aiGenerated = plan.aiGenerated;
    match.aiSource = plan.source;
    match.reason = plan.reason || 'AI planned this field from full form context';
  });
}

function isValueCompatibleWithField(field: FormField, value: string): boolean {
  const label = normalizeText(`${field.label} ${field.placeholder || ''} ${field.elementName || ''} ${field.elementId || ''}`);
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (/邮箱|email|mail/.test(label)) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (/手机|手机号|手机号码|电话|phone|mobile|tel/.test(label)) return /(?:\+?\d[\d\s-]{7,}\d)/.test(trimmed);
  if (/身份证|证件号|证件号码|idnumber|identification|identity/.test(label)) {
    return /^[0-9A-Za-z]{6,24}$/.test(trimmed) && /\d/.test(trimmed);
  }
  if (/github/.test(label)) return /github\.com|^[A-Za-z0-9_.-]+$/.test(trimmed);
  if (/个人网站|作品集|博客|链接|url|website|portfolio|blog/.test(label)) {
    return /^(https?:\/\/|www\.|[A-Za-z0-9_.-]+\.[A-Za-z]{2,})/.test(trimmed);
  }
  if (/日期|时间|date|入学|毕业|开始|结束|起止|到岗/.test(label)) {
    return /\d{4}([./年-]\d{1,2})?([./月-]\d{1,2})?|至今|现在|present|current/i.test(trimmed);
  }

  return true;
}

function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/[_-]+/g, '')
    .toLowerCase();
}

/** 生成用户数据文本摘要（用于 LLM 上下文） */
function generateUserDataSummary(userData: UserDataContext): string {
  const { personalInfo, educations, experiences } = userData;
  const parts: string[] = [];

  // 基础信息
  parts.push(`姓名：${personalInfo.name}`);
  if (personalInfo.gender) parts.push(`性别：${personalInfo.gender}`);
  if (personalInfo.phone) parts.push(`手机：${personalInfo.phone}`);
  if (personalInfo.email) parts.push(`邮箱：${personalInfo.email}`);
  if (personalInfo.currentCity) parts.push(`现居：${personalInfo.currentCity}`);
  if (personalInfo.targetPositions.length) parts.push(`意向岗位：${personalInfo.targetPositions.join('、')}`);

  // 教育经历
  educations.forEach((edu, index) => {
    parts.push(`\n教育经历 #${index + 1}：${edu.school} ${edu.major} ${edu.type}`);
    if (edu.degree) parts.push(`  学位：${edu.degree}`);
    if (edu.startDate || edu.endDate) parts.push(`  时间：${edu.startDate || '未填写'} - ${edu.endDate || '至今'}`);
    if (edu.gpa) parts.push(`  GPA：${edu.gpa}${edu.gpaTotal ? '/' + edu.gpaTotal : ''}`);
    if (edu.ranking) parts.push(`  排名：${edu.ranking}`);
    if (edu.mainCourses?.length) parts.push(`  主修课程：${edu.mainCourses.filter(Boolean).join('、')}`);
    if (edu.awards?.length) parts.push(`  奖项荣誉：${edu.awards.filter(Boolean).join('、')}`);
    if (edu.cet4) parts.push(`  四级：${edu.cet4}`);
    if (edu.cet6) parts.push(`  六级：${edu.cet6}`);
  });

  // 经历
  experiences.forEach((exp, index) => {
    parts.push(`\n${exp.type}经历 #${index + 1}：${exp.organization} - ${exp.role}`);
    if (exp.startDate || exp.endDate) parts.push(`  时间：${exp.startDate || '未填写'} - ${exp.endDate || '至今'}`);
    if (exp.location) parts.push(`  地点：${exp.location}`);
    if (exp.url) parts.push(`  链接：${exp.url}`);
    if (exp.description) parts.push(`  描述：${exp.description}`);
    if (exp.bullets.length) parts.push(`  要点：${exp.bullets.filter(Boolean).join('；')}`);
    if (exp.techStack?.length) parts.push(`  技术/工具：${exp.techStack.filter(Boolean).join('、')}`);
    if (exp.achievements?.length) parts.push(`  成果：${exp.achievements.filter(Boolean).join('；')}`);
  });

  return parts.join('\n');
}

/** 获取字段类型字符串 */
function getFieldType(field?: FormField): string {
  if (!field) return 'unknown';
  if (field.tagName === 'select') return 'select';
  if (field.tagName === 'textarea') return 'textarea';
  return field.inputType || 'text';
}

export { generateUserDataSummary };
