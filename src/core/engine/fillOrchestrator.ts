// ============================================================
// 填充编排器
// 协调 扫描→匹配→填充→校验 的完整流程
// ============================================================

import type { FormField, FillResult, FillFieldResult, AIModelConfig } from '@/shared/types/models';
import { matchAllFields, type UserDataContext, type MatchResult } from './matchingEngine';
import { llmMatchField } from './llmService';
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

    // 对未匹配到的字段，尝试 LLM 兜底
    const aiConfig = await aiConfigDB.getActive();
    if (aiConfig) {
      onProgress?.('正在使用 AI 进行智能匹配...', 55);
      await llmFallbackMatch(matchResults, fields, aiConfig, userData);
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
        return {
          ...fillResult,
          matchedFrom: match.matchedBy,
          confidence: match.confidence,
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
  data: { fieldId: string; value: string; type?: string }[]
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
      resolve(Boolean(response?.success) && !chrome.runtime.lastError);
    });
  });
}

/** LLM 兜底匹配 */
async function llmFallbackMatch(
  matchResults: MatchResult[],
  fields: FormField[],
  aiConfig: AIModelConfig,
  userData: UserDataContext
): Promise<void> {
  // 汇总用户数据为文本
  const userSummary = generateUserDataSummary(userData);

  const fieldById = new Map(fields.map((field) => [field.id, field]));

  // 对更像真实网申字段、且规则无法可靠处理的字段调用 LLM，控制等待时间和成本。
  const unmatchedResults = matchResults
    .filter((m) => shouldAskLLM(m, fieldById.get(m.fieldId)))
    .slice(0, 12);

  // 最多并发 3 个 LLM 请求，避免扩展侧边栏长时间卡顿。
  const batchSize = 3;
  for (let i = 0; i < unmatchedResults.length; i += batchSize) {
    const batch = unmatchedResults.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (matchResult) => {
        const field = fieldById.get(matchResult.fieldId);
        if (!field) return;

        try {
          const llmResult = await llmMatchField(
            aiConfig,
            field.label,
            [
              field.sectionContext || '',
              field.placeholder ? `placeholder: ${field.placeholder}` : '',
              field.elementName ? `name: ${field.elementName}` : '',
              field.elementId ? `id: ${field.elementId}` : '',
              matchResult.value ? `current rule candidate: ${matchResult.value}` : '',
            ].filter(Boolean).join('\n'),
            userSummary
          );

          if (llmResult.value && llmResult.confidence >= Math.max(0.58, matchResult.confidence - 0.08)) {
            matchResult.value = llmResult.value;
            matchResult.matchedBy = 'llm';
            matchResult.confidence = llmResult.confidence;
            matchResult.reason = llmResult.reason || 'LLM fallback matched this field';
          } else if (!llmResult.value && matchResult.confidence < 0.72) {
            matchResult.value = '';
            matchResult.matchedBy = 'none';
            matchResult.confidence = 0;
            matchResult.reason = llmResult.reason || 'LLM could not verify this ambiguous field';
          }
        } catch {
          // LLM 调用失败，静默跳过
        }
      })
    );
  }
}

function shouldAskLLM(match: MatchResult, field?: FormField): boolean {
  if (!isLLMFallbackCandidate(field)) return false;
  if (match.matchedBy === 'none' && match.confidence === 0) return false;
  if (match.matchedBy === 'semantic' && match.confidence < 0.7) return true;
  if (match.matchedBy === 'rule' && match.confidence < 0.72) return true;
  return isHighRiskField(field) && match.confidence < 0.86;
}

function isLLMFallbackCandidate(field?: FormField): boolean {
  if (!field) return false;
  if (field.inputType && ['password', 'file', 'checkbox', 'radio'].includes(field.inputType)) return false;

  const text = `${field.label} ${field.sectionContext || ''} ${field.placeholder || ''} ${field.elementName || ''} ${field.elementId || ''}`.toLowerCase();
  if (/验证码|校验码|密码|搜索|筛选|评论|备注|captcha|verify|password|search|filter/.test(text)) {
    return false;
  }

  return /姓名|电话|手机|邮箱|学校|学院|学历|专业|岗位|职位|城市|地址|公司|经历|项目|技能|证书|薪资|到岗|自我|规划|优势|意向|证件|身份证|链接|网站|github|name|phone|mobile|email|school|college|degree|major|position|city|company|experience|skill|salary|available|summary|identity|identification|link|website/.test(text);
}

function shouldAutoFill(match: MatchResult, field?: FormField): boolean {
  if (!field || !match.value) return false;
  if (!isValueCompatibleWithField(field, match.value)) {
    match.reason = match.reason || 'Matched value failed field format checks';
    return false;
  }

  if (match.matchedBy === 'llm') return match.confidence >= 0.62;
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
  if (match.confidence < 0.62) return '置信度较低，已留待确认';
  if (isHighRiskField(field)) return '字段容易误填，已留待确认';
  return '匹配到数据但未达到自动填充阈值';
}

function isHighRiskField(field?: FormField): boolean {
  if (!field) return true;
  const text = normalizeText(`${field.label} ${field.sectionContext || ''} ${field.placeholder || ''} ${field.elementName || ''} ${field.elementId || ''}`);
  return /描述|说明|内容|经历|项目|证书|竞赛|获奖|奖项|语言|渠道|证件|身份证|url|链接|网站|id/.test(text);
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
  educations.forEach((edu) => {
    parts.push(`\n教育经历：${edu.school} ${edu.major} ${edu.type}`);
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
  experiences.forEach((exp) => {
    parts.push(`\n${exp.type}经历：${exp.organization} - ${exp.role}`);
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
