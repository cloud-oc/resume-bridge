// ============================================================
// 中文网申高频字段映射规则表
// 基于国内网申系统的高频字段沉淀
// 实现「表单字段标签」→「用户数据字段」的精准映射
// ============================================================

export interface FieldMappingRule {
  /** 字段匹配关键词列表（any match 即命中） */
  keywords: string[];
  /** 映射到用户数据的路径，如 "personalInfo.name" */
  dataPath: string;
  /** 字段类别 */
  category: 'basic' | 'education' | 'experience' | 'skill' | 'intention' | 'other';
  /** 匹配优先级，数字越大优先级越高 */
  priority: number;
  /** 值转换函数名（可选） */
  transform?: string;
}

// =================== 基础信息字段映射 ===================

const BASIC_INFO_RULES: FieldMappingRule[] = [
  // 姓名
  {
    keywords: ['姓名', '真实姓名', '名字', '中文名', '全名', '考生姓名', '申请人姓名', '您的姓名', 'name', 'full name', 'your name'],
    dataPath: 'personalInfo.name',
    category: 'basic',
    priority: 100,
  },
  {
    keywords: ['英文名', '英文姓名', '拼音', '姓名拼音', 'english name', 'name in english'],
    dataPath: 'personalInfo.nameEn',
    category: 'basic',
    priority: 90,
  },
  // 姓
  {
    keywords: ['姓氏', '姓', 'last name', 'family name', 'surname'],
    dataPath: 'personalInfo.name',
    category: 'basic',
    priority: 80,
    transform: 'extractFamilyName',
  },
  // 名
  {
    keywords: ['名', 'first name', 'given name'],
    dataPath: 'personalInfo.name',
    category: 'basic',
    priority: 80,
    transform: 'extractGivenName',
  },
  // 性别
  {
    keywords: ['性别', '男/女', '男女', 'gender', 'sex'],
    dataPath: 'personalInfo.gender',
    category: 'basic',
    priority: 100,
  },
  // 出生日期
  {
    keywords: ['出生日期', '出生年月', '生日', '出生年月日', '出生时间', 'birth date', 'date of birth', 'birthday', 'dob'],
    dataPath: 'personalInfo.birthDate',
    category: 'basic',
    priority: 100,
  },
  // 手机
  {
    keywords: ['手机', '手机号', '手机号码', '联系电话', '电话号码', '移动电话', '联系方式', '联系手机', 'phone', 'mobile', 'tel', 'telephone', 'phone number', 'cell phone'],
    dataPath: 'personalInfo.phone',
    category: 'basic',
    priority: 100,
  },
  // 邮箱
  {
    keywords: ['邮箱', '电子邮箱', '邮件', '电子邮件', 'email', 'e-mail', 'email address'],
    dataPath: 'personalInfo.email',
    category: 'basic',
    priority: 100,
  },
  // 身份证
  {
    keywords: ['身份证', '身份证号', '身份证号码', '个人证件', '证件', '证件号', '证件号码', 'id number', 'id card', 'identity', 'identification'],
    dataPath: 'personalInfo.idNumber',
    category: 'basic',
    priority: 95,
  },
  // 民族
  {
    keywords: ['民族', '族别', 'ethnicity', 'ethnic group', 'nationality'],
    dataPath: 'personalInfo.ethnicity',
    category: 'basic',
    priority: 90,
  },
  // 政治面貌
  {
    keywords: ['政治面貌', '政治身份', '党派', 'political status', 'political affiliation'],
    dataPath: 'personalInfo.politicalStatus',
    category: 'basic',
    priority: 90,
  },
  // 籍贯
  {
    keywords: ['籍贯', '户籍', '户籍所在地', '户口所在地', '原籍', 'native place', 'hometown', 'place of origin', 'birthplace'],
    dataPath: 'personalInfo.nativePlace',
    category: 'basic',
    priority: 85,
  },
  // 现居城市
  {
    keywords: ['现居城市', '居住城市', '现居住地', '当前所在地', '目前所在城市', '所在城市', '所在地区', '常住地', 'current city', 'current location', 'location', 'city'],
    dataPath: 'personalInfo.currentCity',
    category: 'basic',
    priority: 80,
  },
  // 微信
  {
    keywords: ['微信', '微信号', '微信账号', 'wechat', 'weixin'],
    dataPath: 'personalInfo.wechat',
    category: 'basic',
    priority: 85,
  },
  // LinkedIn
  {
    keywords: ['linkedin', '领英', 'linkedin链接', 'linkedin url', 'linkedin profile'],
    dataPath: 'personalInfo.linkedin',
    category: 'basic',
    priority: 80,
  },
  // GitHub
  {
    keywords: ['github', 'github链接', 'github url', 'github profile', '代码仓库'],
    dataPath: 'personalInfo.github',
    category: 'basic',
    priority: 80,
  },
  // 作品集
  {
    keywords: ['作品集', '个人作品', '作品链接', '作品url', '作品网址', '个人网站', '个人主页', '博客', 'portfolio', 'personal website', 'blog', 'website'],
    dataPath: 'personalInfo.portfolio',
    category: 'basic',
    priority: 75,
  },
];

// =================== 求职意向字段映射 ===================

const INTENTION_RULES: FieldMappingRule[] = [
  {
    keywords: ['意向城市', '期望城市', '期望工作城市', '工作城市', '工作地点', '期望工作地', '意向工作地', 'preferred city', 'work location', 'desired location'],
    dataPath: 'personalInfo.targetCities',
    category: 'intention',
    priority: 85,
    transform: 'joinArray',
  },
  {
    keywords: ['意向岗位', '期望岗位', '应聘岗位', '申请岗位', '意向职位', '期望职位', '目标岗位', 'preferred position', 'desired position', 'target position', 'applied position'],
    dataPath: 'personalInfo.targetPositions',
    category: 'intention',
    priority: 85,
    transform: 'joinArray',
  },
  {
    keywords: ['期望薪资', '期望薪酬', '薪资期望', '薪资要求', '期望月薪', '薪资范围', 'expected salary', 'salary expectation', 'desired salary'],
    dataPath: 'personalInfo.expectedSalary',
    category: 'intention',
    priority: 80,
  },
  {
    keywords: ['到岗时间', '最早到岗', '可到岗', '入职时间', '可入职时间', '到岗日期', 'available date', 'start date', 'availability'],
    dataPath: 'personalInfo.availableDate',
    category: 'intention',
    priority: 80,
  },
];

// =================== 教育经历字段映射 ===================

const EDUCATION_RULES: FieldMappingRule[] = [
  {
    keywords: ['学校', '毕业院校', '院校', '所学学校', '就读学校', '本科学校', '硕士学校', '毕业学校', '大学', '所在学校', 'school', 'university', 'college', 'institution'],
    dataPath: 'education.school',
    category: 'education',
    priority: 100,
  },
  {
    keywords: ['学院', '院系', '所在学院', '所属学院', 'faculty', 'department', 'school/college'],
    dataPath: 'education.college',
    category: 'education',
    priority: 90,
  },
  {
    keywords: ['专业', '所学专业', '主修专业', '就读专业', '专业名称', '专业方向', 'major', 'field of study', 'discipline', 'specialization'],
    dataPath: 'education.major',
    category: 'education',
    priority: 100,
  },
  {
    keywords: ['学历', '最高学历', '学历层次', '学位', '学历学位', '学位类别', 'degree', 'education level', 'qualification'],
    dataPath: 'education.type',
    category: 'education',
    priority: 95,
  },
  {
    keywords: ['入学时间', '入学日期', '开始时间', '就读开始', 'start date', 'enrollment date', 'from'],
    dataPath: 'education.startDate',
    category: 'education',
    priority: 85,
  },
  {
    keywords: ['毕业时间', '毕业日期', '预计毕业', '结束时间', '毕业年月', 'graduation date', 'end date', 'expected graduation', 'to'],
    dataPath: 'education.endDate',
    category: 'education',
    priority: 85,
  },
  {
    keywords: ['gpa', '绩点', '平均绩点', '平均成绩', '学分绩', '学业成绩', '成绩绩点', 'grade point average'],
    dataPath: 'education.gpa',
    category: 'education',
    priority: 95,
  },
  {
    keywords: ['gpa满分', '绩点满分', '满分绩点', 'gpa total', 'gpa scale', 'out of'],
    dataPath: 'education.gpaTotal',
    category: 'education',
    priority: 85,
  },
  {
    keywords: ['排名', '专业排名', '年级排名', '全班排名', '成绩排名', '名次', 'ranking', 'rank', 'class rank'],
    dataPath: 'education.ranking',
    category: 'education',
    priority: 90,
  },
  {
    keywords: ['四级', 'cet4', 'cet-4', '英语四级', '大学英语四级', '四级成绩', '四级分数'],
    dataPath: 'education.cet4',
    category: 'education',
    priority: 90,
  },
  {
    keywords: ['六级', 'cet6', 'cet-6', '英语六级', '大学英语六级', '六级成绩', '六级分数'],
    dataPath: 'education.cet6',
    category: 'education',
    priority: 90,
  },
  {
    keywords: ['雅思', 'ielts', '雅思成绩', '雅思分数'],
    dataPath: 'education.ielts',
    category: 'education',
    priority: 85,
  },
  {
    keywords: ['托福', 'toefl', '托福成绩', '托福分数'],
    dataPath: 'education.toefl',
    category: 'education',
    priority: 85,
  },
  {
    keywords: ['培养方式', '学习方式', '学制', '全日制', 'training mode', 'study mode'],
    dataPath: 'education.trainingMode',
    category: 'education',
    priority: 80,
  },
  {
    keywords: ['主修课程', '核心课程', '主要课程', '专业课程', '相关课程', 'courses', 'major courses', 'relevant courses'],
    dataPath: 'education.mainCourses',
    category: 'education',
    priority: 75,
    transform: 'joinArray',
  },
  {
    keywords: ['在校获奖', '校内荣誉', '获奖情况', '荣誉称号', '奖项', '所获奖项', '获奖经历', 'awards', 'honors', 'achievements'],
    dataPath: 'education.awards',
    category: 'education',
    priority: 80,
    transform: 'joinArray',
  },
];

// =================== 工作/项目经历字段映射 ===================

const EXPERIENCE_RULES: FieldMappingRule[] = [
  {
    keywords: ['公司', '公司名称', '实习公司', '单位', '单位名称', '企业名称', '组织', '工作单位', '实习单位', 'company', 'company name', 'organization', 'employer'],
    dataPath: 'experience.organization',
    category: 'experience',
    priority: 100,
  },
  {
    keywords: ['岗位', '职位', '岗位名称', '实习岗位', '职位名称', '担任职务', '角色', '任职岗位', 'position', 'title', 'role', 'job title'],
    dataPath: 'experience.role',
    category: 'experience',
    priority: 100,
  },
  {
    keywords: ['实习开始', '工作开始', '开始时间', '起始时间', '入职时间', 'start date', 'from', 'begin date'],
    dataPath: 'experience.startDate',
    category: 'experience',
    priority: 80,
  },
  {
    keywords: ['实习结束', '工作结束', '结束时间', '离职时间', 'end date', 'to', 'finish date'],
    dataPath: 'experience.endDate',
    category: 'experience',
    priority: 80,
  },
  {
    keywords: ['工作地点', '实习地点', '办公地点', '工作城市', 'work location', 'office location'],
    dataPath: 'experience.location',
    category: 'experience',
    priority: 75,
  },
  {
    keywords: ['工作内容', '工作描述', '职责描述', '主要职责', '岗位职责', '工作职责', '实习内容', '核心职责', 'job description', 'responsibilities', 'description', 'duties'],
    dataPath: 'experience.description',
    category: 'experience',
    priority: 90,
  },
  {
    keywords: ['工作成果', '工作业绩', '主要成果', '项目成果', '取得成绩', 'achievements', 'accomplishments', 'results'],
    dataPath: 'experience.achievements',
    category: 'experience',
    priority: 85,
    transform: 'joinArray',
  },
  {
    keywords: ['技术栈', '使用技术', '技术工具', '技术关键词', '关键技能', 'tech stack', 'technologies', 'skills used', 'tools'],
    dataPath: 'experience.techStack',
    category: 'experience',
    priority: 75,
    transform: 'joinArray',
  },
];

// =================== 其他常见字段映射 ===================

const OTHER_RULES: FieldMappingRule[] = [
  // 自我评价/自我介绍
  {
    keywords: ['自我评价', '自我介绍', '个人简介', '个人介绍', '自述', '个人概述', '自我描述', 'self introduction', 'about me', 'self assessment', 'summary', 'personal statement'],
    dataPath: 'special.selfIntroduction',
    category: 'other',
    priority: 70,
  },
  // 职业规划
  {
    keywords: ['职业规划', '职业发展', '个人规划', '发展计划', '未来规划', 'career plan', 'career goal'],
    dataPath: 'special.careerPlan',
    category: 'other',
    priority: 60,
  },
  // 兴趣爱好
  {
    keywords: ['兴趣爱好', '爱好', '个人爱好', '特长', '兴趣特长', 'hobbies', 'interests', 'hobby'],
    dataPath: 'special.hobbies',
    category: 'other',
    priority: 60,
  },
  // 技能/证书
  {
    keywords: ['专业技能', '个人技能', '技能特长', '核心技能', '专业能力', '资质证书', '专业证书', '所获证书', 'skills', 'certifications', 'certificates', 'qualifications'],
    dataPath: 'skills',
    category: 'skill',
    priority: 75,
    transform: 'formatSkills',
  },
  // 推荐人
  {
    keywords: ['推荐人', '推荐人姓名', '引荐人', 'reference', 'referral', 'referee'],
    dataPath: 'special.reference',
    category: 'other',
    priority: 50,
  },
];

// =================== 导出完整规则库 ===================

export const ALL_FIELD_RULES: FieldMappingRule[] = [
  ...BASIC_INFO_RULES,
  ...INTENTION_RULES,
  ...EDUCATION_RULES,
  ...EXPERIENCE_RULES,
  ...OTHER_RULES,
];

/** 按类别获取规则 */
export function getRulesByCategory(category: FieldMappingRule['category']): FieldMappingRule[] {
  return ALL_FIELD_RULES.filter((r) => r.category === category);
}

/** 获取规则统计 */
export function getRulesStats() {
  const totalKeywords = ALL_FIELD_RULES.reduce((sum, r) => sum + r.keywords.length, 0);
  return {
    totalRules: ALL_FIELD_RULES.length,
    totalKeywords,
    byCategory: {
      basic: getRulesByCategory('basic').length,
      education: getRulesByCategory('education').length,
      experience: getRulesByCategory('experience').length,
      intention: getRulesByCategory('intention').length,
      skill: getRulesByCategory('skill').length,
      other: getRulesByCategory('other').length,
    },
  };
}
