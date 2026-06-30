import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';

const outfile = '/tmp/resume-bridge-parser-test.mjs';

await build({
  entryPoints: ['src/core/engine/resumeParser.ts'],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['mammoth'],
  alias: {
    '@': './src',
  },
});

const { normalizeParsedResumeData } = await import(pathToFileURL(outfile).href);

const snakeCaseResult = normalizeParsedResumeData({
  resume_data: {
    basic_info: {
      full_name: '张三',
      phone_number: '13800138000',
      email_address: 'zhangsan@example.com',
    },
    education_experiences: [
      {
        university_name: '清华大学',
        field_of_study: '计算机科学与技术',
        degree: '本科',
        date_range: '2020.09 - 2024.06',
      },
    ],
    project_experiences: [
      {
        project_name: '网申自动填充平台',
        job_title: '前端开发',
        date_range: '2023.01 - 2023.06',
        responsibilities: ['负责表单识别', '优化字段匹配'],
      },
    ],
  },
});

assert.equal(snakeCaseResult.personalInfo?.name, '张三');
assert.equal(snakeCaseResult.personalInfo?.phone, '13800138000');
assert.equal(snakeCaseResult.educations?.[0]?.school, '清华大学');
assert.equal(snakeCaseResult.educations?.[0]?.major, '计算机科学与技术');
assert.equal(snakeCaseResult.experiences?.[0]?.organization, '网申自动填充平台');
assert.equal(snakeCaseResult.experiences?.[0]?.type, '项目');

const chineseResult = normalizeParsedResumeData({
  基础信息: {
    姓名: '李四',
    联系电话: '13900139000',
    邮箱: 'lisi@example.com',
  },
  教育背景: [
    {
      学校名称: '北京大学',
      专业: '软件工程',
      起止时间: '2021年09月 - 至今',
    },
  ],
  工作经历: [
    {
      公司: '云桥科技',
      职位: '产品经理',
      工作内容: '负责网申流程分析；沉淀字段规则',
    },
  ],
});

assert.equal(chineseResult.personalInfo?.name, '李四');
assert.equal(chineseResult.educations?.[0]?.school, '北京大学');
assert.equal(chineseResult.experiences?.[0]?.organization, '云桥科技');
assert.deepEqual(chineseResult.experiences?.[0]?.bullets, ['负责网申流程分析', '沉淀字段规则']);

const fallbackResult = normalizeParsedResumeData({}, `
王五
手机：13700137000
邮箱：wangwu@example.com

教育经历
复旦大学 软件工程 本科 2019.09 - 2023.06

项目经历
Resume Bridge 项目 前端开发 2023.03 - 2023.09
- 负责简历资料库与智能填充链路
- 优化不同网申表单字段匹配
`);

assert.equal(fallbackResult.personalInfo?.name, '王五');
assert.equal(fallbackResult.personalInfo?.phone, '13700137000');
assert.equal(fallbackResult.educations?.[0]?.school, '复旦大学 软件工程 本科');
assert.ok(fallbackResult.experiences?.[0]?.bullets?.some((item) => item.includes('智能填充')));

const hiddenLinkResult = normalizeParsedResumeData({
  basic_info: {
    full_name: '赵六',
    email: 'zhaoliu@example.com',
  },
  project_experiences: [
    {
      project_name: 'Resume Bridge',
      role: '产品负责人',
      description: '设计网申智能填充插件',
    },
  ],
}, `
赵六
邮箱：zhaoliu@example.com
PDF_HIDDEN_LINKS: https://github.com/cloud-oc | category=github | label=GitHub
PDF_HIDDEN_LINKS: https://www.linkedin.com/in/cloud09 | category=linkedin | label=LinkedIn
PDF_HIDDEN_LINKS: https://cloud09.space | category=portfolio | label=Portfolio
PDF_HIDDEN_LINKS: https://resume-bridge-demo.vercel.app | category=project | label=Resume Bridge Demo
`);

assert.equal(hiddenLinkResult.personalInfo?.github, 'https://github.com/cloud-oc');
assert.equal(hiddenLinkResult.personalInfo?.linkedin, 'https://www.linkedin.com/in/cloud09');
assert.equal(hiddenLinkResult.personalInfo?.portfolio, 'https://cloud09.space');
assert.equal(hiddenLinkResult.experiences?.[0]?.url, 'https://resume-bridge-demo.vercel.app');

console.log('resume parser checks passed');
