// ============================================================
// LLM API 调用服务
// 支持 OpenAI / Claude / 通义千问 / 豆包 / MiniMax / DeepSeek
//       智谱GLM / 月之暗面Kimi / 百川 / Ollama / 自定义
// API Key 仅存储在本地，直接调用厂商官方 API
// ============================================================

import type { AIModelConfig, FormField } from '@/shared/types/models';

/** LLM 调用参数 */
interface LLMRequest {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

/** LLM 响应 */
interface LLMResponse {
  content: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export type LLMFieldPlanSource = 'profile' | 'rewritten' | 'generated' | 'empty' | 'unknown';

export interface LLMFieldPlanningInput {
  field: FormField;
  currentCandidate?: {
    value: string;
    matchedBy: string;
    confidence: number;
    reason?: string;
  };
}

export interface LLMFieldPlan {
  fieldId: string;
  value: string;
  confidence: number;
  shouldFill: boolean;
  reviewRequired: boolean;
  aiGenerated: boolean;
  source: LLMFieldPlanSource;
  reason?: string;
}

/** 获取 API base URL */
function getBaseUrl(config: AIModelConfig): string {
  if (config.baseUrl) return config.baseUrl.replace(/\/$/, '');

  switch (config.provider) {
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'claude':
      return 'https://api.anthropic.com/v1';
    case 'doubao':
      return 'https://ark.cn-beijing.volces.com/api/v3';
    case 'qianwen':
      return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    case 'minimax':
      return 'https://api.minimax.chat/v1';
    case 'deepseek':
      return 'https://api.deepseek.com/v1';
    case 'zhipu':
      return 'https://open.bigmodel.cn/api/paas/v4';
    case 'moonshot':
      return 'https://api.moonshot.cn/v1';
    case 'baichuan':
      return 'https://api.baichuan-ai.com/v1';
    case 'ollama':
      return 'http://localhost:11434/v1';
    case 'custom':
      return config.baseUrl || 'https://api.openai.com/v1';
    default:
      return 'https://api.openai.com/v1';
  }
}

/** 调用 LLM API（OpenAI 兼容格式） */
export async function callLLM(
  config: AIModelConfig,
  request: LLMRequest
): Promise<LLMResponse> {
  const baseUrl = getBaseUrl(config);

  // Claude 使用不同的 API 格式
  if (config.provider === 'claude') {
    return callClaudeAPI(config, request);
  }

  // OpenAI 兼容格式（适用于 OpenAI / 通义千问 / 豆包 / Ollama / 自定义）
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey || ''}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.maxTokens ?? 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
        }
      : undefined,
  };
}

/** 调用 Claude API */
async function callClaudeAPI(
  config: AIModelConfig,
  request: LLMRequest
): Promise<LLMResponse> {
  const baseUrl = getBaseUrl(config);
  const systemMessage = request.messages.find((m) => m.role === 'system')?.content;
  const otherMessages = request.messages.filter((m) => m.role !== 'system');

  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: request.maxTokens ?? 1000,
      system: systemMessage,
      messages: otherMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API 调用失败 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    content: data.content?.[0]?.text || '',
    usage: data.usage
      ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
        }
      : undefined,
  };
}

// =================== 高层接口 ===================

/**
 * 使用 LLM 批量规划字段填充。
 * 这一步会把规则/语义匹配结果作为候选，让模型结合整页字段上下文进行确认、纠错或留空。
 */
export async function llmPlanFieldMatches(
  config: AIModelConfig,
  inputs: LLMFieldPlanningInput[],
  userDataSummary: string
): Promise<LLMFieldPlan[]> {
  if (!inputs.length) return [];

  const fieldPayload = inputs.map(({ field, currentCandidate }, index) => ({
    index,
    fieldId: field.id,
    label: field.label,
    tagName: field.tagName,
    inputType: field.inputType || '',
    placeholder: field.placeholder || '',
    elementName: field.elementName || '',
    elementId: field.elementId || '',
    sectionContext: field.sectionContext || '',
    repeatContext: field.repeatContext || '',
    groupIndex: typeof field.groupIndex === 'number' ? field.groupIndex : null,
    fieldIndexInGroup: typeof field.fieldIndexInGroup === 'number' ? field.fieldIndexInGroup : null,
    required: field.required,
    options: field.options?.slice(0, 30) || [],
    currentCandidate: currentCandidate
      ? {
          value: currentCandidate.value || '',
          matchedBy: currentCandidate.matchedBy,
          confidence: Number(currentCandidate.confidence.toFixed(2)),
          reason: currentCandidate.reason || '',
        }
      : null,
  }));

  const prompt = `你是 Resume Bridge 的网申表单智能填充规划器。你的任务不是盲目填满页面，而是根据候选人的结构化资料，判断每个表单字段应该填什么、是否应该填、是否需要人工复核。

候选人资料：
${userDataSummary}

表单字段（JSON）：
${JSON.stringify(fieldPayload, null, 2)}

决策规则：
1. 优先使用候选人资料中的真实事实；没有对应事实时必须留空。
2. currentCandidate 是规则/语义引擎给出的候选值，你需要检查它是否和字段含义一致；如果不一致，返回空值或纠正为更合适的资料。
3. 重复模块必须按 groupIndex / repeatContext 对应不同的教育或经历，不能把同一段实习/项目描述重复填到所有经历里。
4. 如果字段是经历描述、职责、成果，只能使用对应那段经历的描述、要点、成果和技术栈，不要混入其他经历。
5. 如果字段是开放性问题、自我介绍、职业规划、优势等，可以基于真实资料生成草稿；这类内容必须标记 source="generated"、aiGenerated=true、reviewRequired=true。
6. 如果只是把资料改写、压缩、整理成字段需要的表达，标记 source="rewritten"、aiGenerated=true、reviewRequired=true。
7. 如果是姓名、邮箱、手机、学校、专业、公司、岗位、日期、链接等直接事实，标记 source="profile"、aiGenerated=false；低把握时 reviewRequired=true。
8. 验证码、密码、搜索、筛选、隐私同意、承诺勾选、文件上传、无法判断的字段必须留空。
9. 对下拉框字段，value 必须尽量使用 options 中的原文；没有可靠选项时留空。
10. 返回严格 JSON，不要 Markdown。格式如下：
{
  "fields": [
    {
      "fieldId": "字段 ID",
      "value": "要填入的内容；没有可靠内容则空字符串",
      "confidence": 0到1的小数,
      "shouldFill": true或false,
      "reviewRequired": true或false,
      "aiGenerated": true或false,
      "source": "profile|rewritten|generated|empty|unknown",
      "reason": "一句很短的中文原因"
    }
  ]
}`;

  try {
    const response = await callLLM(config, {
      messages: [
        {
          role: 'system',
          content:
            '你是谨慎的网申表单填充规划器。只返回 JSON。没有可靠依据就留空。AI 生成或改写内容必须标记为需要人工复核。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.12,
      maxTokens: Math.min(4200, Math.max(1200, inputs.length * 180)),
    });

    return normalizeLLMFieldPlans(response.content, new Set(inputs.map(({ field }) => field.id)));
  } catch (error) {
    console.error('[Resume Bridge] LLM 批量规划失败:', error);
    return [];
  }
}

/**
 * 使用 LLM 进行字段智能匹配
 */
export async function llmMatchField(
  config: AIModelConfig,
  fieldLabel: string,
  fieldContext: string,
  userDataSummary: string
): Promise<{ value: string; confidence: number; reason?: string }> {
  const prompt = `你是一个网申表单智能填充助手。
  
用户的个人信息如下：
${userDataSummary}

当前需要填写的表单字段是：
- 字段标签：${fieldLabel}
- 字段上下文：${fieldContext}

请根据用户的个人信息，判断这个字段最合适的填写内容。
注意：
1. 只能使用用户信息中已经存在的事实，不要编造
2. 如果字段标签或上下文不明确，返回空字符串
3. 如果用户信息中没有对应内容，返回空字符串
4. 确保内容格式正确（如日期、电话号码、邮箱、证件号等）
5. 返回 JSON，不要返回 Markdown：
{"value":"要填写的内容或空字符串","confidence":0到1之间的小数,"reason":"一句很短的原因"}`;

  try {
    const response = await callLLM(config, {
      messages: [
        { role: 'system', content: '你是谨慎的网申智能填充助手。只能返回 JSON；不确定时 value 为空字符串。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 300,
    });

    const value = response.content.trim();
    try {
      const parsed = JSON.parse(value) as { value?: unknown; confidence?: unknown; reason?: unknown };
      const parsedValue = typeof parsed.value === 'string' ? parsed.value.trim() : '';
      const parsedConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);
      return {
        value: parsedValue,
        confidence: parsedValue ? Math.max(0, Math.min(0.82, Number.isFinite(parsedConfidence) ? parsedConfidence : 0.62)) : 0,
        reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : undefined,
      };
    } catch {
      // 兼容旧模型或用户自定义模型返回纯文本的情况。
    }

    return {
      value,
      confidence: value ? 0.62 : 0,
      reason: 'LLM returned plain text',
    };
  } catch (error) {
    console.error('[Resume Bridge] LLM 匹配失败:', error);
    return { value: '', confidence: 0 };
  }
}

function normalizeLLMFieldPlans(content: string, allowedIds: Set<string>): LLMFieldPlan[] {
  const parsed = parseLLMJson(content);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { fields?: unknown }).fields)
      ? (parsed as { fields: unknown[] }).fields
      : [];

  return rows
    .map((item): LLMFieldPlan | null => {
      if (!item || typeof item !== 'object') return null;
      const raw = item as Record<string, unknown>;
      const fieldId = typeof raw.fieldId === 'string' ? raw.fieldId : '';
      if (!fieldId || !allowedIds.has(fieldId)) return null;

      const value = typeof raw.value === 'string' ? raw.value.trim() : '';
      const source = normalizePlanSource(raw.source);
      const parsedConfidence = typeof raw.confidence === 'number' ? raw.confidence : Number(raw.confidence);
      const confidence = clampConfidence(Number.isFinite(parsedConfidence) ? parsedConfidence : value ? 0.68 : 0, source);
      const aiGenerated = Boolean(raw.aiGenerated) || source === 'generated' || source === 'rewritten';
      const shouldFill = Boolean(raw.shouldFill) && Boolean(value);
      const reviewRequired = Boolean(raw.reviewRequired) || aiGenerated || confidence < 0.78;
      const reason = typeof raw.reason === 'string' ? raw.reason.slice(0, 140) : undefined;

      return {
        fieldId,
        value,
        confidence: value ? confidence : 0,
        shouldFill,
        reviewRequired: value ? reviewRequired : false,
        aiGenerated: value ? aiGenerated : false,
        source: value ? source : 'empty',
        reason,
      };
    })
    .filter((item): item is LLMFieldPlan => Boolean(item));
}

function parseLLMJson(content: string): unknown {
  let jsonStr = content.trim();
  jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

  try {
    return JSON.parse(jsonStr);
  } catch {
    const firstObject = jsonStr.indexOf('{');
    const lastObject = jsonStr.lastIndexOf('}');
    if (firstObject >= 0 && lastObject > firstObject) {
      return JSON.parse(jsonStr.slice(firstObject, lastObject + 1));
    }

    const firstArray = jsonStr.indexOf('[');
    const lastArray = jsonStr.lastIndexOf(']');
    if (firstArray >= 0 && lastArray > firstArray) {
      return JSON.parse(jsonStr.slice(firstArray, lastArray + 1));
    }
  }

  return null;
}

function normalizePlanSource(source: unknown): LLMFieldPlanSource {
  if (source === 'profile' || source === 'rewritten' || source === 'generated' || source === 'empty' || source === 'unknown') {
    return source;
  }
  return 'unknown';
}

function clampConfidence(confidence: number, source: LLMFieldPlanSource): number {
  const upperBound = source === 'profile' ? 0.92 : source === 'rewritten' ? 0.84 : source === 'generated' ? 0.78 : 0.72;
  return Math.max(0, Math.min(upperBound, confidence));
}

/**
 * 使用 LLM 生成开放性问题答案
 */
export async function llmGenerateAnswer(
  config: AIModelConfig,
  question: string,
  userDataSummary: string,
  jobDescription?: string
): Promise<string> {
  const prompt = `你是一个资深的求职申请辅导专家。

用户的个人信息和经历：
${userDataSummary}

${jobDescription ? `目标岗位的招聘描述：\n${jobDescription}\n` : ''}

请帮用户回答以下网申开放性问题：
"${question}"

要求：
1. 回答要个性化，基于用户的真实经历，避免通用模板化内容
2. 400字以内，结构清晰
3. 突出与岗位的匹配度
4. 语气真诚、自信、专业
5. 直接给出答案文本，不要加引号或额外说明`;

  try {
    const response = await callLLM(config, {
      messages: [
        { role: 'system', content: '你是求职申请辅导专家，帮助候选人撰写个性化的网申回答。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      maxTokens: 1000,
    });

    return response.content.trim();
  } catch (error) {
    console.error('[Resume Bridge] LLM 生成失败:', error);
    throw error;
  }
}

/**
 * 使用 LLM 解析简历文本为结构化数据
 */
export async function llmParseResume(
  config: AIModelConfig,
  resumeText: string
): Promise<Record<string, unknown>> {
  const prompt = `请将以下简历文本解析为 JSON 结构化数据。

简历文本：
${resumeText.substring(0, 5000)}

请按以下 JSON 格式输出（只输出 JSON，不要有其他文字）：
{
  "name": "姓名",
  "gender": "男/女",
  "phone": "手机号",
  "email": "邮箱",
  "linkedin": "LinkedIn/领英主页 URL",
  "github": "GitHub 主页 URL",
  "portfolio": "个人网站/作品集 URL",
  "birthDate": "YYYY-MM-DD",
  "nativePlace": "籍贯",
  "politicalStatus": "政治面貌",
  "educations": [
    {
      "type": "本科/硕士/博士",
      "school": "学校名称",
      "college": "学院",
      "major": "专业",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM",
      "gpa": "绩点",
      "ranking": "排名"
    }
  ],
  "experiences": [
    {
      "type": "工作/实习/项目/科研/活动",
      "organization": "公司/组织",
      "role": "岗位/角色",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM",
      "url": "项目/公司/作品链接",
      "description": "描述",
      "bullets": ["要点1", "要点2"]
    }
  ],
  "skills": ["技能1", "技能2"]
}

注意：
1. 只输出合法的 JSON，不要有任何前缀后缀
2. 无法提取的字段留空字符串
3. 日期统一为 YYYY-MM 格式
4. 如果文本中出现 PDF_HIDDEN_LINKS，请识别链接类型：GitHub/LinkedIn/个人网站/作品集写入个人信息；项目、作品、Demo、公司官网写入对应 experiences.url；不确定归属时不要编造`;

  try {
    const response = await callLLM(config, {
      messages: [
        { role: 'system', content: '你是简历解析专家，将简历文本转换为结构化 JSON 数据。只输出 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 2000,
    });

    // 提取 JSON
    let jsonStr = response.content.trim();
    // 去掉可能的 markdown 代码块
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('[Resume Bridge] 简历解析失败:', error);
    throw error;
  }
}
