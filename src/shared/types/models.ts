// ============================================================
// Resume Bridge - 网申填写智能体
// 核心数据模型定义
// ============================================================

/** 个人基础信息 */
export interface PersonalInfo {
  id: string;
  // 基本信息
  name: string;
  nameEn?: string;
  gender: '男' | '女' | '其他' | '';
  birthDate: string; // YYYY-MM-DD
  idNumber?: string; // 身份证号（加密存储）
  ethnicity?: string; // 民族
  politicalStatus?: string; // 政治面貌
  nativePlace?: string; // 籍贯
  currentCity?: string; // 现居城市

  // 联系方式
  phone: string;
  email: string;
  wechat?: string;

  // 社交账号
  linkedin?: string;
  github?: string;
  portfolio?: string; // 作品集链接
  blog?: string;

  // 求职意向
  targetCities: string[];
  targetPositions: string[];
  expectedSalary?: string;
  availableDate?: string; // 可到岗日期

  // 元数据
  createdAt: string;
  updatedAt: string;
}

/** 教育经历 */
export interface Education {
  id: string;
  type: '本科' | '硕士' | '博士' | '交换' | '其他';
  school: string;
  schoolEn?: string;
  college?: string; // 学院
  major: string;
  majorEn?: string;
  degree?: string; // 学位
  startDate: string;
  endDate: string;
  gpa?: string;
  gpaTotal?: string; // GPA满分
  ranking?: string; // 排名，如"5/120"
  trainingMode?: string; // 培养方式：全日制/非全日制

  // 语言成绩
  cet4?: string; // 四级
  cet6?: string; // 六级
  ielts?: string;
  toefl?: string;

  // 课程与荣誉
  mainCourses?: string[];
  awards?: string[];

  // 排序与管理
  isPrimary: boolean; // 是否为主学历
  order: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** 工作 / 实习 / 项目 / 科研 / 活动经历 */
export interface Experience {
  id: string;
  type: '工作' | '实习' | '项目' | '科研' | '活动' | '竞赛' | '其他';
  organization: string; // 公司/组织名称
  role: string; // 岗位/角色
  startDate: string;
  endDate: string;
  location?: string;
  description: string; // 核心描述
  bullets: string[]; // 要点列表
  techStack?: string[]; // 技术栈
  achievements?: string[]; // 成果

  // 多版本管理
  versions: ExperienceVersion[];

  // 标签管理
  abilityTags: string[]; // 能力标签
  industryTags: string[]; // 行业标签

  order: number;
  createdAt: string;
  updatedAt: string;
}

/** 经历的不同版本表述 */
export interface ExperienceVersion {
  id: string;
  name: string; // 版本名，如"产品经理版"、"开发工程师版"
  targetPosition?: string;
  description: string;
  bullets: string[];
}

/** 技能信息 */
export interface SkillInfo {
  id: string;
  category: string; // 如"编程语言"、"工具"、"证书"
  items: string[];
}

/** 附件文件 */
export interface Attachment {
  id: string;
  name: string;
  type: '简历' | '成绩单' | '证书' | '作品集' | '其他';
  fileName: string;
  fileSize: number;
  mimeType: string;
  data: string; // Base64 encoded
  isDefault: boolean; // 是否为默认文件
  targetPosition?: string; // 适用岗位
  createdAt: string;
  updatedAt: string;
}

/** 开放性问题答案素材 */
export interface QAMaterial {
  id: string;
  question: string; // 问题
  category: string; // 分类，如"职业规划"、"岗位认知"
  answer: string; // 答案
  isAIGenerated: boolean;
  targetPosition?: string;
  createdAt: string;
  updatedAt: string;
}

/** AI 模型配置 */
export interface AIModelConfig {
  id: string;
  provider: 'openai' | 'claude' | 'doubao' | 'qianwen' | 'minimax' | 'deepseek' | 'zhipu' | 'moonshot' | 'baichuan' | 'ollama' | 'custom';
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  isActive: boolean;
  createdAt: string;
}

/** 投递记录 */
export interface ApplicationRecord {
  id: string;
  company: string;
  position: string;
  url?: string;
  status: '已投递' | '简历筛选' | '笔试' | '面试' | 'Offer' | '已拒绝' | '已放弃';
  resumeVersion?: string; // 使用的简历版本
  appliedAt: string;
  notes?: string;
  timeline: { date: string; event: string }[];
  createdAt: string;
  updatedAt: string;
}

/** 填充结果 */
export interface FillResult {
  totalFields: number;
  successFields: number;
  failedFields: number;
  pendingFields: number;
  fields: FillFieldResult[];
  startTime: string;
  endTime: string;
}

/** 单个字段的填充结果 */
export interface FillFieldResult {
  fieldId: string;
  label: string;
  type: 'text' | 'select' | 'radio' | 'checkbox' | 'textarea' | 'date' | 'file' | 'unknown';
  status: 'success' | 'failed' | 'pending' | 'skipped';
  filledValue?: string;
  matchedFrom?: string; // 匹配来源：rule / semantic / llm
  confidence: number; // 匹配置信度 0-1
  matchReason?: string; // 匹配/跳过原因
  errorMessage?: string;
}

/** 用户完整数据（用于备份/恢复） */
export interface UserData {
  version: string;
  exportedAt: string;
  personalInfo: PersonalInfo;
  educations: Education[];
  experiences: Experience[];
  skills: SkillInfo[];
  attachments: Attachment[];
  qaMaterials: QAMaterial[];
  aiConfigs: AIModelConfig[];
  applicationRecords: ApplicationRecord[];
}

/** 表单字段描述（页面解析结果） */
export interface FormField {
  id: string; // 生成的唯一ID
  elementId?: string; // DOM 元素 ID
  elementName?: string; // DOM 元素 name
  tagName: string; // input/select/textarea 等
  inputType?: string; // text/email/tel/date 等
  label: string; // 提取的标签文本
  placeholder?: string;
  required: boolean;
  options?: string[]; // 下拉选项
  maxLength?: number;
  pattern?: string; // 验证正则
  xpath: string; // XPath 定位
  cssSelector: string; // CSS 选择器
  sectionContext?: string; // 所在模块的上下文
  groupKey?: string; // 重复表单块的稳定标识，如第 N 段经历
  groupIndex?: number; // 当前模块内的重复块序号
  fieldIndexInGroup?: number; // 当前重复块内的字段序号
  repeatContext?: string; // 重复块附近的补充上下文
  value?: string; // 当前值
}
