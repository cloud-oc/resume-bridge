import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const outfile = '/tmp/resume-bridge-field-matching-test.mjs';

await build({
  entryPoints: ['src/core/engine/matchingEngine.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  alias: {
    '@': './src',
  },
});

const orchestratorOutfile = '/tmp/resume-bridge-fill-orchestrator-test.mjs';

await build({
  entryPoints: ['src/core/engine/fillOrchestrator.ts'],
  outfile: orchestratorOutfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  alias: {
    '@': './src',
  },
  external: ['chrome'],
  define: {
    chrome: 'globalThis.chrome',
  },
});

globalThis.chrome = {
  tabs: { sendMessage() {} },
  scripting: { executeScript() {} },
  runtime: {},
};
globalThis.indexedDB = {};

const { matchSingleField, matchAllFields } = await import(pathToFileURL(outfile).href);
const { __fillOrchestratorTestUtils } = await import(pathToFileURL(orchestratorOutfile).href);

const now = '2026-06-30T00:00:00.000Z';
const userData = {
  personalInfo: {
    id: 'p1',
    name: '朱凌云',
    gender: '男',
    birthDate: '2002-01-02',
    idNumber: '360102200201020011',
    phone: '17770282104',
    email: 'cloud09@example.com',
    github: 'https://github.com/cloud-oc',
    portfolio: 'http://cloud09.space/',
    targetCities: ['上海', '深圳', '杭州'],
    targetPositions: ['产品经理'],
    createdAt: now,
    updatedAt: now,
  },
  educations: [
    {
      id: 'e1',
      type: '本科',
      school: '南昌大学',
      college: '新闻与传播学院',
      major: '数字媒体技术',
      degree: '学士',
      startDate: '2022-09-01',
      endDate: '2026-06-01',
      isPrimary: true,
      order: 0,
      tags: [],
      createdAt: now,
      updatedAt: now,
    },
  ],
  experiences: [
    {
      id: 'x1',
      type: '实习',
      organization: '烽炊网络',
      role: '产品运营实习生',
      startDate: '2026-04-01',
      endDate: '2026-05-01',
      description: '负责网申流程分析和内容运营。',
      bullets: ['沉淀字段规则', '优化信息架构'],
      versions: [],
      abilityTags: [],
      industryTags: [],
      order: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'x2',
      type: '实习',
      organization: '云桥科技',
      role: '增长产品实习生',
      startDate: '2025-07-01',
      endDate: '2025-09-01',
      description: '负责增长实验设计和漏斗数据分析。',
      bullets: ['搭建 A/B 测试看板', '定位注册转化瓶颈'],
      versions: [],
      abilityTags: [],
      industryTags: [],
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'x3',
      type: '项目',
      organization: 'Resume Bridge',
      role: '产品与前端负责人',
      startDate: '2026-01-01',
      endDate: '',
      description: '设计并实现网申智能填充浏览器插件。',
      bullets: ['完成字段匹配引擎', '支持多语言插件外壳'],
      techStack: ['React', 'TypeScript'],
      versions: [],
      abilityTags: [],
      industryTags: [],
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
  ],
  skills: [],
};

function field(overrides) {
  return {
    id: overrides.id || `f_${Math.random()}`,
    tagName: 'input',
    label: overrides.label || '未知字段',
    required: false,
    xpath: '//input',
    cssSelector: 'input',
    ...overrides,
  };
}

function match(overrides) {
  return matchSingleField(field(overrides), userData);
}

const email = match({
  label: '邮箱',
  elementName: 'email',
  elementId: 'email',
  sectionContext: '基本信息',
});
assert.equal(email.value, 'cloud09@example.com');
assert.equal(email.matchedRule?.dataPath, 'personalInfo.email');
assert.ok(__fillOrchestratorTestUtils.shouldAutoFill(email, field({ label: '邮箱', elementName: 'email' })));

const idNumber = match({
  label: '个人证件',
  elementName: 'identification',
  elementId: 'identification',
  sectionContext: '基本信息',
});
assert.equal(idNumber.value, '360102200201020011');
assert.equal(idNumber.matchedRule?.dataPath, 'personalInfo.idNumber');
assert.ok(__fillOrchestratorTestUtils.shouldAutoFill(idNumber, field({ label: '个人证件', elementName: 'identification' })));

const school = match({
  label: '学校名称',
  elementName: 'school',
  elementId: 'school',
  sectionContext: '教育经历',
});
assert.equal(school.value, '南昌大学');
assert.equal(school.matchedRule?.dataPath, 'education.school');

const major = match({
  label: '专业',
  elementName: 'field_of_study',
  elementId: 'field_of_study',
  sectionContext: '教育经历',
});
assert.equal(major.value, '数字媒体技术');
assert.equal(major.matchedRule?.dataPath, 'education.major');

const company = match({
  label: '公司名称',
  elementName: 'company',
  elementId: 'company',
  sectionContext: '实习经历',
});
assert.equal(company.value, '烽炊网络');
assert.equal(company.matchedRule?.dataPath, 'experience.organization');

const role = match({
  label: '职位名称',
  elementName: 'title',
  elementId: 'title',
  sectionContext: '实习经历',
});
assert.equal(role.value, '产品运营实习生');
assert.equal(role.matchedRule?.dataPath, 'experience.role');

const repeatedFields = [
  field({
    id: 'intern_0_company',
    label: '公司名称',
    elementName: 'company',
    elementId: 'company',
    sectionContext: '实习经历',
    groupKey: '实习经历::0',
    groupIndex: 0,
  }),
  field({
    id: 'intern_0_desc',
    label: '描述',
    elementName: 'desc',
    elementId: 'desc',
    sectionContext: '实习经历',
    tagName: 'textarea',
    groupKey: '实习经历::0',
    groupIndex: 0,
  }),
  field({
    id: 'intern_1_company',
    label: '公司名称',
    elementName: 'company',
    elementId: 'company',
    sectionContext: '实习经历',
    groupKey: '实习经历::1',
    groupIndex: 1,
  }),
  field({
    id: 'intern_1_desc',
    label: '描述',
    elementName: 'desc',
    elementId: 'desc',
    sectionContext: '实习经历',
    tagName: 'textarea',
    groupKey: '实习经历::1',
    groupIndex: 1,
  }),
  field({
    id: 'project_0_name',
    label: '项目名称',
    elementName: 'projectName',
    elementId: 'projectName',
    sectionContext: '项目经历',
    groupKey: '项目经历::0',
    groupIndex: 0,
  }),
  field({
    id: 'project_0_desc',
    label: '描述',
    elementName: 'desc',
    elementId: 'desc',
    sectionContext: '项目经历',
    tagName: 'textarea',
    groupKey: '项目经历::0',
    groupIndex: 0,
  }),
  field({
    id: 'intern_2_desc',
    label: '描述',
    elementName: 'desc',
    elementId: 'desc',
    sectionContext: '实习经历',
    tagName: 'textarea',
    groupKey: '实习经历::2',
    groupIndex: 2,
  }),
];

const repeatedMatches = matchAllFields(repeatedFields, userData);
const repeatedById = new Map(repeatedMatches.map((item) => [item.fieldId, item]));

assert.equal(repeatedById.get('intern_0_company')?.value, '烽炊网络');
assert.match(repeatedById.get('intern_0_desc')?.value || '', /网申流程分析/);
assert.match(repeatedById.get('intern_0_desc')?.value || '', /沉淀字段规则/);
assert.equal(repeatedById.get('intern_1_company')?.value, '云桥科技');
assert.match(repeatedById.get('intern_1_desc')?.value || '', /增长实验设计/);
assert.doesNotMatch(repeatedById.get('intern_1_desc')?.value || '', /网申流程分析/);
assert.equal(repeatedById.get('project_0_name')?.value, 'Resume Bridge');
assert.match(repeatedById.get('project_0_desc')?.value || '', /浏览器插件/);
assert.match(repeatedById.get('project_0_desc')?.value || '', /React、TypeScript/);
assert.equal(repeatedById.get('intern_2_desc')?.value, '');
assert.equal(repeatedById.get('intern_2_desc')?.matchedBy, 'none');

const ambiguousDescription = match({
  label: '描述',
  elementName: 'desc',
  elementId: 'desc',
  sectionContext: '证书',
  tagName: 'textarea',
});
assert.notEqual(ambiguousDescription.value, '朱凌云');
assert.notEqual(ambiguousDescription.matchedRule?.dataPath, 'personalInfo.name');
assert.equal(__fillOrchestratorTestUtils.shouldAutoFill(ambiguousDescription, field({
  label: '描述',
  elementName: 'desc',
  sectionContext: '证书',
  tagName: 'textarea',
})), false);

const genericUnknown = match({
  label: '未知字段',
  sectionContext: '教育经历',
});
assert.equal(genericUnknown.value, '');
assert.equal(genericUnknown.matchedBy, 'none');
assert.equal(__fillOrchestratorTestUtils.shouldAskLLM(genericUnknown, field({
  label: '未知字段',
  sectionContext: '教育经历',
})), false);

const githubLink = match({
  label: 'Github URL / ID',
  elementName: 'link',
  elementId: 'link',
  sectionContext: '社交账号',
});
assert.equal(githubLink.value, 'https://github.com/cloud-oc');
assert.equal(githubLink.matchedRule?.dataPath, 'personalInfo.github');

const portfolioLink = match({
  label: '个人网站 URL / ID',
  elementName: 'link',
  elementId: 'link',
  sectionContext: '社交账号',
});
assert.equal(portfolioLink.value, 'http://cloud09.space/');
assert.equal(portfolioLink.matchedRule?.dataPath, 'personalInfo.portfolio');

const workLink = match({
  label: '作品链接',
  elementName: 'link',
  elementId: 'link',
  sectionContext: '作品',
});
assert.equal(workLink.value, 'http://cloud09.space/');
assert.equal(workLink.matchedRule?.dataPath, 'personalInfo.portfolio');

const genericUrlId = match({
  label: 'URL / ID',
  elementName: 'link',
  elementId: 'link',
  sectionContext: '社交账号',
});
assert.equal(genericUrlId.value, '');
assert.equal(genericUrlId.matchedBy, 'none');
assert.equal(__fillOrchestratorTestUtils.shouldAskLLM(genericUrlId, field({
  label: 'URL / ID',
  elementName: 'link',
  elementId: 'link',
  sectionContext: '社交账号',
})), false);

console.log('field matching checks passed');
