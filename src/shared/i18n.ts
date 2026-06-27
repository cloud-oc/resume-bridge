import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

export type Language = 'en' | 'zh' | 'ja';

type Dictionaries = Record<Language, Record<string, string>>;

const LANGUAGE_KEY = 'resumeBridgeLanguage';

export const languageOptions: { code: Language; shortLabel: string; label: string }[] = [
  { code: 'en', shortLabel: 'EN', label: 'English' },
  { code: 'zh', shortLabel: '中', label: '中文' },
  { code: 'ja', shortLabel: '日', label: '日本語' },
];

const dictionaries: Dictionaries = {
  en: {
    'app.name': 'Resume Bridge',
    'app.version': 'v1.0.0',
    'app.github': 'GitHub',
    'app.copyright': '©Cloud09',
    'app.localOnly': 'Local only',
    'app.localStorage': 'Local storage',
    'app.privacyLine': 'All data stays in your local browser storage.',
    'app.productIntro':
      'Resume Bridge is an open-source online application assistant that keeps your profile structured, scans application forms, fills matched fields, and leaves every submission under your review.',
    'app.productTagline': 'Online application assistant',
    'app.productPanel': 'Application review panel',

    'language.label': 'Language',
    'language.description': 'Switch the extension interface between English, Chinese, and Japanese.',

    'popup.status': 'Your local profile is ready. Review results before submitting.',
    'popup.openSidebar': 'Open fill panel',
    'popup.openOptions': 'Manage profile library',
    'popup.openHelp': 'Usage help',
    'popup.footerHint': 'Scan page fields first, then fill and review.',

    'sidebar.tab.fill': 'Fill',
    'sidebar.tab.result': 'Results',
    'sidebar.tab.qa': 'Q&A',
    'sidebar.tab.info': 'Profile',
    'sidebar.tab.help': 'Help',
    'sidebar.status.scanning': 'Scanning form fields...',
    'sidebar.status.noTab': 'Could not access the current tab.',
    'sidebar.status.scanFound': 'Found {count} fillable fields.',
    'sidebar.status.scanFailed': 'Scan failed. Make sure the page has fully loaded.',
    'sidebar.status.scanError': 'Scan failed. Refresh the page and try again.',
    'sidebar.status.filling': 'Starting smart fill...',
    'sidebar.status.fillDone':
      'Fill complete. Success {success}, failed {failed}, needs review {pending}.',
    'sidebar.status.unknownError': 'Unknown error',
    'sidebar.status.clearDone': 'All filled content has been cleared.',
    'sidebar.status.clearFailed': 'Clear failed. Refresh the page and try again.',
    'sidebar.status.exported': 'Data exported.',
    'sidebar.fill.loading': 'Filling...',
    'sidebar.fill.primary': 'Smart fill',
    'sidebar.fill.scanning': 'Scanning',
    'sidebar.fill.scan': 'Scan form',
    'sidebar.fill.clear': 'Clear fill',
    'sidebar.workflow.aria': 'Recommended workflow',
    'sidebar.workflow.scan.title': 'Scan fields',
    'sidebar.workflow.scan.desc': 'Confirm that the form has loaded',
    'sidebar.workflow.fill.title': 'Fill intelligently',
    'sidebar.workflow.fill.desc': 'Rules first, AI fallback when needed',
    'sidebar.workflow.review.title': 'Review manually',
    'sidebar.workflow.review.desc': 'Check required fields and long answers',
    'sidebar.scan.title': 'Found {count} form fields',
    'sidebar.scan.desc': 'Focus on required fields and hidden expanded sections.',
    'sidebar.scan.requiredCount': '{count} required',
    'sidebar.scan.required': 'Required',
    'sidebar.scan.more': '...and {count} more fields',
    'sidebar.tip.title': 'Before you start',
    'sidebar.tip.1': 'Open any company online application page.',
    'sidebar.tip.2': 'Scan fields after the page has fully loaded.',
    'sidebar.tip.3': 'Run smart fill, then review every item.',
    'sidebar.tip.4': 'Submit the application manually after checking.',
    'sidebar.tip.fullHelp': 'View full help',
    'sidebar.result.total': 'Total',
    'sidebar.result.success': 'Success',
    'sidebar.result.failed': 'Failed',
    'sidebar.result.pending': 'Review',
    'sidebar.result.empty': 'No fill results yet',
    'sidebar.result.emptyHint': 'Run smart fill first.',
    'sidebar.result.back': 'Back to fill',
    'sidebar.info.libraryTitle': 'Profile library',
    'sidebar.info.libraryDesc':
      'Maintain personal info, education, work or project experience, and AI settings.',
    'sidebar.info.openLibrary': 'Open profile library',
    'sidebar.info.quickActions': 'Quick actions',
    'sidebar.info.aiSettings': 'AI model settings',
    'sidebar.info.exportData': 'Export data',
    'sidebar.info.aboutTitle': 'About Resume Bridge',
    'sidebar.help.title': 'Usage help',
    'sidebar.help.subtitle': 'Follow this order for a stable online application fill.',
    'sidebar.help.firstTitle': 'First-time setup',
    'sidebar.help.first.1': 'Open the profile library and add name, phone, email, education, and reusable experience.',
    'sidebar.help.first.2': 'If you need open-answer drafting or AI fallback, add an API key in AI model settings.',
    'sidebar.help.first.3': 'If you already have a resume, parse it first and review every saved item.',
    'sidebar.help.fillTitle': 'When filling a form',
    'sidebar.help.fill.1': 'Open the company application page and wait for forms, steps, and dialogs to load.',
    'sidebar.help.fill.2': 'Click Scan form and confirm the field count looks right.',
    'sidebar.help.fill.3': 'Click Smart fill and wait for success, failed, and review items.',
    'sidebar.help.fill.4': 'Review dropdowns, open answers, file uploads, and privacy checkboxes.',
    'sidebar.help.fill.5': 'Submit manually only after everything looks correct.',
    'sidebar.help.faqTitle': 'Common questions',
    'sidebar.help.faq.scan.q': 'What if no fields are found?',
    'sidebar.help.faq.scan.a':
      'Refresh the page and expand all folded areas. Browser internal pages, extension stores, and protected login pages may block injection.',
    'sidebar.help.faq.review.q': 'Why review after filling?',
    'sidebar.help.faq.review.a':
      'ATS labels and dropdown values vary. Resume Bridge keeps the result visible, but final submission should stay in your hands.',
    'sidebar.help.faq.privacy.q': 'Will my data be uploaded?',
    'sidebar.help.faq.privacy.a':
      'Profile data and API keys stay in your browser. When AI features are enabled, only the needed prompt context is sent to your configured model provider.',
    'sidebar.footer.version': 'Resume Bridge v1.0.0',

    'qa.status.generating': 'Generating answer...',
    'qa.status.needModel': 'Configure an AI model first.',
    'qa.status.needProfile': 'Fill in personal info first.',
    'qa.status.done': 'Answer generated.',
    'qa.status.failed': 'Generation failed',
    'qa.status.copied': 'Copied to clipboard.',
    'qa.title': 'Open-answer drafting',
    'qa.desc': 'Enter an application question and generate an editable draft from your local profile.',
    'qa.question': 'Question',
    'qa.placeholder': 'Example: career plan / why this company / describe a teamwork experience',
    'qa.preset.career': 'Describe your career plan',
    'qa.preset.company': 'Why this company?',
    'qa.preset.strength': 'What are your strengths and weaknesses?',
    'qa.preset.challenge': 'Describe a time you solved a difficult problem',
    'qa.generate': 'Generate answer',
    'qa.generating': 'Generating...',
    'qa.result': 'Generated result',
    'qa.copy': 'Copy',

    'options.nav.personal': 'Profile',
    'options.nav.education': 'Education',
    'options.nav.experience': 'Experience',
    'options.nav.ai': 'AI models',
    'options.nav.resume': 'Resume import',
    'options.nav.backup': 'Backup',
    'options.nav.help': 'Help',
    'options.nav.subtitle': 'Application profile',
    'options.save.personal': 'Personal info saved.',
    'options.save.education': 'Education saved.',
    'options.save.experience': 'Experience saved.',
    'options.save.ai': 'AI configuration saved.',
    'options.save.export': 'Data exported.',
    'options.save.import': 'Data restored successfully.',
    'options.confirm.deleteEducation': 'Delete this education entry?',
    'options.confirm.deleteExperience': 'Delete this experience entry?',
    'options.alert.invalidBackup': 'Invalid backup file.',
    'options.confirm.import': 'Importing will overwrite all current data. Continue?',
    'options.alert.importFailed': 'Could not parse this file. Check the file format.',

    'options.personal.title': 'Personal profile',
    'options.personal.desc': 'Maintain frequently reused profile data. Review each field before submitting.',
    'options.personal.name': 'Name',
    'options.personal.namePlaceholder': 'Enter your legal name',
    'options.personal.englishName': 'English name',
    'options.personal.gender': 'Gender',
    'options.personal.select': 'Select',
    'options.personal.birthDate': 'Date of birth',
    'options.personal.phone': 'Phone',
    'options.personal.phonePlaceholder': 'Enter phone number',
    'options.personal.email': 'Email',
    'options.personal.emailPlaceholder': 'Enter email address',
    'options.personal.ethnicity': 'Ethnicity',
    'options.personal.ethnicityPlaceholder': 'Example: Han',
    'options.personal.political': 'Political status',
    'options.personal.nativePlace': 'Native place',
    'options.personal.nativePlacePlaceholder': 'Example: Guangzhou, Guangdong',
    'options.personal.currentCity': 'Current city',
    'options.personal.currentCityPlaceholder': 'Example: Beijing',
    'options.personal.social': 'Social profiles',
    'options.personal.wechat': 'WeChat',
    'options.personal.linkedinPlaceholder': 'LinkedIn profile URL',
    'options.personal.githubPlaceholder': 'GitHub profile URL',
    'options.personal.portfolio': 'Portfolio',
    'options.personal.portfolioPlaceholder': 'Portfolio URL',
    'options.personal.intent': 'Application preferences',
    'options.personal.targetCities': 'Target cities',
    'options.personal.targetCitiesPlaceholder': 'Example: Beijing, Shanghai, Shenzhen',
    'options.personal.targetPositions': 'Target roles',
    'options.personal.targetPositionsPlaceholder': 'Example: Product Manager, Data Analyst',
    'options.personal.expectedSalary': 'Expected salary',
    'options.personal.expectedSalaryPlaceholder': 'Example: 15K-25K',
    'options.personal.availableDate': 'Available date',
    'options.personal.save': 'Save personal info',

    'options.education.title': 'Education',
    'options.education.desc': 'Keep schools, majors, GPA, and study mode ready for application education sections.',
    'options.education.add': 'Add education',
    'options.education.empty': 'No education entries yet',
    'options.education.emptyHint': 'Use the button above to add one.',
    'options.education.card': 'Education #{index}',
    'options.education.delete': 'Delete',
    'options.education.type': 'Degree type',
    'options.education.school': 'School',
    'options.education.schoolPlaceholder': 'Example: Peking University',
    'options.education.college': 'College',
    'options.education.collegePlaceholder': 'Example: School of Information Science',
    'options.education.major': 'Major',
    'options.education.majorPlaceholder': 'Example: Computer Science',
    'options.education.start': 'Start date',
    'options.education.end': 'Graduation date',
    'options.education.gpaTotal': 'GPA scale',
    'options.education.ranking': 'Ranking',
    'options.education.cet4': 'CET-4 score',
    'options.education.cet6': 'CET-6 score',
    'options.education.training': 'Study mode',
    'options.education.save': 'Save this entry',

    'options.experience.title': 'Work / project experience',
    'options.experience.desc': 'Collect reusable experience material for form fields and open-answer drafts.',
    'options.experience.add': 'Add experience',
    'options.experience.empty': 'No experience entries yet',
    'options.experience.card': 'Experience #{index}',
    'options.experience.type': 'Experience type',
    'options.experience.organization': 'Company / organization',
    'options.experience.organizationPlaceholder': 'Example: ByteDance',
    'options.experience.role': 'Role',
    'options.experience.rolePlaceholder': 'Example: Product Manager Intern',
    'options.experience.location': 'Location',
    'options.experience.locationPlaceholder': 'Example: Beijing',
    'options.experience.start': 'Start date',
    'options.experience.end': 'End date',
    'options.experience.description': 'Core description',
    'options.experience.descriptionPlaceholder': 'Briefly describe your role and contribution',
    'options.experience.bullets': 'Key bullets, one per line',
    'options.experience.bulletsPlaceholder':
      'Led requirement analysis and prototyping for XXX product\nImproved XXX metric by XX%',
    'options.experience.save': 'Save this entry',

    'options.ai.title': 'AI model settings',
    'options.ai.desc':
      'Configure models for semantic matching, resume import, and open-answer drafting. API keys stay local.',
    'options.ai.add': 'Add model',
    'options.ai.newName': 'New model configuration',
    'options.ai.empty': 'No AI model configured',
    'options.ai.emptyHint': 'Add one to use smart matching and content generation.',
    'options.ai.active': 'Active',
    'options.ai.name': 'Configuration name',
    'options.ai.provider': 'Provider',
    'options.ai.model': 'Model name',
    'options.ai.modelPlaceholder': 'Example: gpt-4o-mini',
    'options.ai.apiKeyPlaceholder': 'Stored locally only',
    'options.ai.baseUrl': 'API Base URL (optional)',
    'options.ai.baseUrlPlaceholder': 'Optional custom proxy or endpoint',
    'options.ai.save': 'Save',
    'options.ai.setDefault': 'Set as default',
    'options.ai.securityTitle': 'Security notes',
    'options.ai.security.1': 'API keys are stored only in your browser local storage.',
    'options.ai.security.2': 'AI requests are sent directly to the provider you configure.',
    'options.ai.security.3': 'Resume Bridge does not collect, upload, or share your keys.',

    'options.resume.title': 'Resume import',
    'options.resume.desc': 'Extract profile, education, and experience from a resume. Review the result before saving.',
    'options.resume.loading': 'Loading resume import module...',
    'resume.title': 'Resume import',
    'resume.desc': 'Upload a resume file, inspect the extracted result, then write it into your profile library.',
    'resume.tooLarge': 'File size exceeds the 10MB limit.',
    'resume.extracting': 'Extracting text from {file}...',
    'resume.tooShort': 'The extracted text is too short. Check whether the file is valid.',
    'resume.extracted': 'Extracted {count} characters. Parsing with AI...',
    'resume.needModel': 'Configure and activate an AI model first.',
    'resume.parseFailed': 'Parse failed: {message}',
    'resume.saving': 'Parsed successfully. Saving data...',
    'resume.saved': 'Saved: {items}',
    'resume.skipped': 'Skipped: {items}',
    'resume.failed': 'Parse failed',
    'resume.choose': 'Choose resume file',
    'resume.supported': 'Supports Word (.docx), PDF, TXT, and Markdown',
    'resume.done': 'Parsing complete. Click to upload another resume.',
    'resume.retry': 'Click to choose another file.',
    'resume.step.extract': 'Extract text',
    'resume.step.parse': 'AI parse',
    'resume.step.save': 'Save data',
    'resume.preview': 'Parsed result preview',
    'resume.name': 'Name',
    'resume.phone': 'Phone',
    'resume.email': 'Email',
    'resume.education': 'Education {index}',
    'resume.experience': 'Experience {index}',

    'options.backup.title': 'Backup and restore',
    'options.backup.desc': 'Export your local profile library or restore from a backup. Importing overwrites current data.',
    'options.backup.exportTitle': 'Export data',
    'options.backup.exportDesc': 'Export personal info, experience, and AI settings as a JSON file.',
    'options.backup.exportButton': 'Export all data',
    'options.backup.importTitle': 'Import data',
    'options.backup.importDesc': 'Restore from a previous backup file. Current data will be overwritten.',
    'options.backup.importButton': 'Restore from backup',
    'options.backup.tipsTitle': 'Backup tips',
    'options.backup.tip.1': 'Export backups regularly.',
    'options.backup.tip.2': 'Export before switching browsers or devices.',
    'options.backup.tip.3': 'Backup files contain personal information. Keep them private.',

    'options.help.title': 'Usage help',
    'options.help.desc': 'A step-by-step guide from first setup to final review.',
    'options.help.aboutTitle': 'About Resume Bridge',
    'options.help.aboutDesc':
      'An open-source assistant for online application forms across internships, campus hiring, and experienced roles.',
    'options.help.githubDesc': 'Project repository, issues, and releases are available on GitHub.',
    'options.help.languageTitle': 'Interface language',
    'options.help.languageDesc': 'Choose the language used by the extension shell and help content.',
    'options.help.step1.title': '1. Build your profile library',
    'options.help.step1.desc':
      'Fill in personal info, education, work or project experience. Prioritize phone, email, role targets, and availability.',
    'options.help.step2.title': '2. Use resume import to speed up setup',
    'options.help.step2.desc':
      'Upload a PDF, Word, TXT, or Markdown resume. Review name, school, dates, and role names before saving.',
    'options.help.step3.title': '3. Configure AI only when needed',
    'options.help.step3.desc':
      'Rule matching works without AI. Open-answer drafts, resume import, and low-confidence fallback need a local model configuration.',
    'options.help.step4.title': '4. Scan after opening the application page',
    'options.help.step4.desc':
      'Wait for the page to load, expand folded sections, then scan the form. If the count looks wrong, refresh or enter the exact step first.',
    'options.help.step5.title': '5. Fill, but never auto-submit',
    'options.help.step5.desc':
      'Resume Bridge writes matched content and shows success, failed, and review states. You still control the submit button.',
    'options.help.step6.title': '6. Review before submission',
    'options.help.step6.desc':
      'Check required fields, dropdowns, open answers, uploads, privacy consent, and hidden fields before submitting.',
    'options.help.checklistTitle': 'Pre-submit checklist',
    'options.help.check.1': 'Personal info has no typos',
    'options.help.check.2': 'Phone and email are reachable',
    'options.help.check.3': 'Education and experience dates are consistent',
    'options.help.check.4': 'Target role matches the current job',
    'options.help.check.5': 'Open answers are tailored to the company and role',
    'options.help.check.6': 'Attachments, consent, and commitments are manually confirmed',
    'options.help.troubleTitle': 'Troubleshooting',
    'options.help.trouble.scan.q': 'No fields are found',
    'options.help.trouble.scan.a':
      'Refresh the page and make sure it is not a browser internal page, extension store page, or protected login page. For multi-step forms, enter the exact step first.',
    'options.help.trouble.dropdown.q': 'A dropdown was not filled correctly',
    'options.help.trouble.dropdown.a':
      'ATS options may use values different from their visible labels. Review dropdowns manually before submitting.',
    'options.help.trouble.answer.q': 'An open answer feels generic',
    'options.help.trouble.answer.a':
      'Add more specific experience bullets, then include the job description in the question, for example: answer with this JD in mind.',
    'options.help.trouble.privacy.q': 'Privacy concerns',
    'options.help.trouble.privacy.a':
      'The profile library is stored in local IndexedDB. AI features send only the needed prompt context to your configured model provider.',
  },
  zh: {
    'app.name': 'Resume Bridge',
    'app.version': 'v1.0.0',
    'app.github': 'GitHub',
    'app.copyright': '©Cloud09',
    'app.localOnly': '仅本地',
    'app.localStorage': '本地存储',
    'app.privacyLine': '所有数据仅存储在本地浏览器中。',
    'app.productIntro':
      'Resume Bridge 是开源网申填写助手，用结构化资料库连接分散的网申表单，帮助你扫描字段、匹配内容、完成填充，并把最终提交前的复核权留在你手里。',
    'app.productTagline': '网申填写助手',
    'app.productPanel': '网申填写与复核面板',

    'language.label': '语言',
    'language.description': '切换插件界面的英文、中文和日文显示。',

    'popup.status': '本地资料库已就绪，填充前请先复核结果。',
    'popup.openSidebar': '打开智能填充面板',
    'popup.openOptions': '管理个人资料库',
    'popup.openHelp': '使用帮助',
    'popup.footerHint': '先扫描页面字段，再执行填充和复核。',

    'sidebar.tab.fill': '填充',
    'sidebar.tab.result': '结果',
    'sidebar.tab.qa': '问答',
    'sidebar.tab.info': '资料',
    'sidebar.tab.help': '帮助',
    'sidebar.status.scanning': '正在扫描页面表单...',
    'sidebar.status.noTab': '无法获取当前标签页。',
    'sidebar.status.scanFound': '发现 {count} 个可填充字段。',
    'sidebar.status.scanFailed': '扫描失败，请确认页面已完全加载。',
    'sidebar.status.scanError': '扫描出错，请刷新页面重试。',
    'sidebar.status.filling': '正在启动智能填充...',
    'sidebar.status.fillDone': '填充完成。成功 {success} 项，失败 {failed} 项，待确认 {pending} 项。',
    'sidebar.status.unknownError': '未知错误',
    'sidebar.status.clearDone': '已清空所有填充内容。',
    'sidebar.status.clearFailed': '清空失败，请刷新页面重试。',
    'sidebar.status.exported': '数据已导出。',
    'sidebar.fill.loading': '填充中...',
    'sidebar.fill.primary': '一键智能填充',
    'sidebar.fill.scanning': '扫描中',
    'sidebar.fill.scan': '扫描表单',
    'sidebar.fill.clear': '清空填充',
    'sidebar.workflow.aria': '推荐使用流程',
    'sidebar.workflow.scan.title': '扫描字段',
    'sidebar.workflow.scan.desc': '确认页面表单已经加载完成',
    'sidebar.workflow.fill.title': '智能填充',
    'sidebar.workflow.fill.desc': '优先规则匹配，必要时 AI 兜底',
    'sidebar.workflow.review.title': '人工复核',
    'sidebar.workflow.review.desc': '检查必填项、下拉框和长文本',
    'sidebar.scan.title': '发现 {count} 个表单字段',
    'sidebar.scan.desc': '请重点核对必填字段和当前页面隐藏展开项。',
    'sidebar.scan.requiredCount': '{count} 必填',
    'sidebar.scan.required': '必填',
    'sidebar.scan.more': '...还有 {count} 个字段',
    'sidebar.tip.title': '开始前确认',
    'sidebar.tip.1': '打开任意企业的网申页面。',
    'sidebar.tip.2': '先扫描字段，确认页面已加载完成。',
    'sidebar.tip.3': '执行智能填充后逐项复核。',
    'sidebar.tip.4': '确认无误后再提交网申。',
    'sidebar.tip.fullHelp': '查看完整帮助',
    'sidebar.result.total': '总字段',
    'sidebar.result.success': '成功',
    'sidebar.result.failed': '失败',
    'sidebar.result.pending': '待确认',
    'sidebar.result.empty': '暂无填充结果',
    'sidebar.result.emptyHint': '请先执行一键填充操作。',
    'sidebar.result.back': '回到填充',
    'sidebar.info.libraryTitle': '个人资料库',
    'sidebar.info.libraryDesc': '在资料库中维护基础信息、教育经历、工作项目和 AI 配置。',
    'sidebar.info.openLibrary': '打开资料库',
    'sidebar.info.quickActions': '快捷操作',
    'sidebar.info.aiSettings': 'AI 模型配置',
    'sidebar.info.exportData': '导出数据',
    'sidebar.info.aboutTitle': '关于 Resume Bridge',
    'sidebar.help.title': '使用帮助',
    'sidebar.help.subtitle': '按这个顺序走，通常就能稳定完成一次网申填写。',
    'sidebar.help.firstTitle': '第一次使用',
    'sidebar.help.first.1': '进入资料库，先补齐姓名、手机、邮箱、教育经历和常用经历。',
    'sidebar.help.first.2': '需要开放题生成或 AI 兜底匹配时，在 AI 模型配置里添加 API Key，并设为默认。',
    'sidebar.help.first.3': '如果已有简历，可以先用简历解析导入，再回到资料库检查每一项。',
    'sidebar.help.fillTitle': '填表时怎么做',
    'sidebar.help.fill.1': '打开企业网申页面，等页面、分步表单和弹窗都加载完成。',
    'sidebar.help.fill.2': '点击“扫描表单”，先看发现的字段数量是否符合当前页面。',
    'sidebar.help.fill.3': '点击“一键智能填充”，等待结果页展示成功、失败和待确认项。',
    'sidebar.help.fill.4': '逐项复核页面内容，尤其是下拉框、开放题、附件上传和隐私确认框。',
    'sidebar.help.fill.5': '确认无误后再由你手动提交。',
    'sidebar.help.faqTitle': '常见问题',
    'sidebar.help.faq.scan.q': '扫描不到字段怎么办？',
    'sidebar.help.faq.scan.a': '先刷新页面并展开当前步骤的所有折叠区域；如果是浏览器内部页、扩展商店页或登录保护页，扩展可能无法注入页面助手。',
    'sidebar.help.faq.review.q': '填充后为什么还要复核？',
    'sidebar.help.faq.review.a': '不同 ATS 的字段命名和下拉选项差异很大。Resume Bridge 会保留可见结果，但最终提交前仍建议你确认每个关键字段。',
    'sidebar.help.faq.privacy.q': '我的数据会上传吗？',
    'sidebar.help.faq.privacy.a': '资料库和 API Key 存在本地浏览器。只有当你启用 AI 功能时，相关问题和资料摘要会直接发送给你配置的模型服务。',
    'sidebar.footer.version': 'Resume Bridge v1.0.0',

    'qa.status.generating': '正在生成回答...',
    'qa.status.needModel': '请先配置 AI 模型。',
    'qa.status.needProfile': '请先填写个人信息。',
    'qa.status.done': '回答已生成。',
    'qa.status.failed': '生成失败',
    'qa.status.copied': '已复制到剪贴板。',
    'qa.title': '开放性问题回答',
    'qa.desc': '输入网申开放题，基于本地资料生成可编辑的初稿。',
    'qa.question': '问题',
    'qa.placeholder': '例如：请简述您的职业规划 / 为什么选择我们公司 / 描述一次 teamwork 经历',
    'qa.preset.career': '请简述您的职业规划',
    'qa.preset.company': '为什么选择本公司',
    'qa.preset.strength': '你的优缺点是什么',
    'qa.preset.challenge': '描述一次解决困难的经历',
    'qa.generate': '生成回答',
    'qa.generating': '生成中...',
    'qa.result': '生成结果',
    'qa.copy': '复制',
  },
  ja: {
    'app.name': 'Resume Bridge',
    'app.version': 'v1.0.0',
    'app.github': 'GitHub',
    'app.copyright': '©Cloud09',
    'app.localOnly': 'ローカルのみ',
    'app.localStorage': 'ローカル保存',
    'app.privacyLine': 'すべてのデータはブラウザー内にのみ保存されます。',
    'app.productIntro':
      'Resume Bridge はオープンソースのオンライン応募フォーム支援ツールです。プロフィールを構造化し、フォームをスキャンし、対応する項目を入力し、送信前の確認はあなたに残します。',
    'app.productTagline': 'オンライン応募入力アシスタント',
    'app.productPanel': '応募入力と確認パネル',

    'language.label': '言語',
    'language.description': '拡張機能の表示言語を英語、中国語、日本語に切り替えます。',

    'popup.status': 'ローカルプロフィールは準備できています。送信前に結果を確認してください。',
    'popup.openSidebar': '入力パネルを開く',
    'popup.openOptions': 'プロフィールライブラリを管理',
    'popup.openHelp': '使い方',
    'popup.footerHint': 'まずページ項目をスキャンし、入力後に確認します。',

    'sidebar.tab.fill': '入力',
    'sidebar.tab.result': '結果',
    'sidebar.tab.qa': 'Q&A',
    'sidebar.tab.info': '資料',
    'sidebar.tab.help': 'ヘルプ',
    'sidebar.status.scanning': 'フォーム項目をスキャンしています...',
    'sidebar.status.noTab': '現在のタブにアクセスできません。',
    'sidebar.status.scanFound': '{count} 個の入力可能項目が見つかりました。',
    'sidebar.status.scanFailed': 'スキャンに失敗しました。ページが完全に読み込まれているか確認してください。',
    'sidebar.status.scanError': 'スキャン中にエラーが発生しました。ページを更新して再試行してください。',
    'sidebar.status.filling': 'スマート入力を開始しています...',
    'sidebar.status.fillDone': '入力完了。成功 {success}、失敗 {failed}、確認待ち {pending}。',
    'sidebar.status.unknownError': '不明なエラー',
    'sidebar.status.clearDone': '入力済み内容をすべてクリアしました。',
    'sidebar.status.clearFailed': 'クリアに失敗しました。ページを更新して再試行してください。',
    'sidebar.status.exported': 'データをエクスポートしました。',
    'sidebar.fill.loading': '入力中...',
    'sidebar.fill.primary': 'スマート入力',
    'sidebar.fill.scanning': 'スキャン中',
    'sidebar.fill.scan': 'フォームをスキャン',
    'sidebar.fill.clear': '入力をクリア',
    'sidebar.workflow.aria': '推奨フロー',
    'sidebar.workflow.scan.title': '項目をスキャン',
    'sidebar.workflow.scan.desc': 'フォームの読み込みを確認',
    'sidebar.workflow.fill.title': 'スマート入力',
    'sidebar.workflow.fill.desc': 'ルール優先、必要に応じて AI 補完',
    'sidebar.workflow.review.title': '手動確認',
    'sidebar.workflow.review.desc': '必須項目と長文回答を確認',
    'sidebar.scan.title': '{count} 個のフォーム項目を発見',
    'sidebar.scan.desc': '必須項目と展開済みの隠れたセクションを重点的に確認してください。',
    'sidebar.scan.requiredCount': '必須 {count}',
    'sidebar.scan.required': '必須',
    'sidebar.scan.more': '...さらに {count} 個の項目',
    'sidebar.tip.title': '始める前に',
    'sidebar.tip.1': '企業のオンライン応募ページを開きます。',
    'sidebar.tip.2': 'ページ読み込み後に項目をスキャンします。',
    'sidebar.tip.3': 'スマート入力後、各項目を確認します。',
    'sidebar.tip.4': '問題がなければ手動で応募を送信します。',
    'sidebar.tip.fullHelp': '詳しいヘルプを見る',
    'sidebar.result.total': '合計',
    'sidebar.result.success': '成功',
    'sidebar.result.failed': '失敗',
    'sidebar.result.pending': '確認',
    'sidebar.result.empty': '入力結果はまだありません',
    'sidebar.result.emptyHint': '先にスマート入力を実行してください。',
    'sidebar.result.back': '入力へ戻る',
    'sidebar.info.libraryTitle': 'プロフィールライブラリ',
    'sidebar.info.libraryDesc': '個人情報、学歴、職務・プロジェクト経験、AI 設定を管理します。',
    'sidebar.info.openLibrary': 'ライブラリを開く',
    'sidebar.info.quickActions': 'クイック操作',
    'sidebar.info.aiSettings': 'AI モデル設定',
    'sidebar.info.exportData': 'データをエクスポート',
    'sidebar.info.aboutTitle': 'Resume Bridge について',
    'sidebar.help.title': '使い方',
    'sidebar.help.subtitle': 'この順番で進めると、安定してオンライン応募フォームを入力できます。',
    'sidebar.help.firstTitle': '初回設定',
    'sidebar.help.first.1': 'ライブラリで氏名、電話、メール、学歴、よく使う経験を入力します。',
    'sidebar.help.first.2': '自由回答や AI 補完が必要な場合は、AI モデル設定で API Key を追加します。',
    'sidebar.help.first.3': '履歴書がある場合は先にインポートし、保存内容を確認します。',
    'sidebar.help.fillTitle': 'フォーム入力時',
    'sidebar.help.fill.1': '企業の応募ページを開き、フォームやステップ、ダイアログの読み込みを待ちます。',
    'sidebar.help.fill.2': 'フォームをスキャンし、項目数が妥当か確認します。',
    'sidebar.help.fill.3': 'スマート入力を実行し、成功・失敗・確認待ちの結果を確認します。',
    'sidebar.help.fill.4': 'プルダウン、自由回答、ファイル添付、同意チェックを確認します。',
    'sidebar.help.fill.5': '問題がないことを確認してから手動で送信します。',
    'sidebar.help.faqTitle': 'よくある質問',
    'sidebar.help.faq.scan.q': '項目が見つからない場合は？',
    'sidebar.help.faq.scan.a': 'ページを更新し、折りたたみ領域をすべて展開してください。ブラウザー内部ページ、拡張ストア、保護されたログインページでは注入できない場合があります。',
    'sidebar.help.faq.review.q': '入力後に確認が必要な理由は？',
    'sidebar.help.faq.review.a': 'ATS ごとに項目名や選択肢の値が異なります。結果は可視化されますが、最終送信前の確認は必ず行ってください。',
    'sidebar.help.faq.privacy.q': 'データはアップロードされますか？',
    'sidebar.help.faq.privacy.a': 'プロフィールと API Key はブラウザー内に保存されます。AI 機能使用時のみ、必要な文脈が設定済みのモデル提供元へ送信されます。',
    'sidebar.footer.version': 'Resume Bridge v1.0.0',

    'qa.status.generating': '回答を生成しています...',
    'qa.status.needModel': '先に AI モデルを設定してください。',
    'qa.status.needProfile': '先に個人情報を入力してください。',
    'qa.status.done': '回答を生成しました。',
    'qa.status.failed': '生成に失敗しました',
    'qa.status.copied': 'クリップボードにコピーしました。',
    'qa.title': '自由回答ドラフト',
    'qa.desc': '応募フォームの質問を入力し、ローカル資料から編集可能な下書きを生成します。',
    'qa.question': '質問',
    'qa.placeholder': '例：キャリアプラン / 志望理由 / チームワーク経験',
    'qa.preset.career': 'キャリアプランを説明してください',
    'qa.preset.company': 'なぜこの会社を選びましたか？',
    'qa.preset.strength': '長所と短所は何ですか？',
    'qa.preset.challenge': '困難を解決した経験を説明してください',
    'qa.generate': '回答を生成',
    'qa.generating': '生成中...',
    'qa.result': '生成結果',
    'qa.copy': 'コピー',
  },
};

dictionaries.zh = { ...dictionaries.en, ...dictionaries.zh };
dictionaries.ja = { ...dictionaries.en, ...dictionaries.ja };

let currentLanguage: Language = 'en';
const subscribers = new Set<() => void>();
let initialized = false;

function getChromeStorage() {
  return globalThis.chrome?.storage?.local;
}

function normalizeLanguage(value: unknown): Language {
  return value === 'zh' || value === 'ja' || value === 'en' ? value : 'en';
}

function notify() {
  subscribers.forEach((subscriber) => subscriber());
}

function readFallbackLanguage(): Language {
  try {
    return normalizeLanguage(globalThis.localStorage?.getItem(LANGUAGE_KEY));
  } catch {
    return 'en';
  }
}

function writeFallbackLanguage(language: Language) {
  try {
    globalThis.localStorage?.setItem(LANGUAGE_KEY, language);
  } catch {
    // Ignore preview storage failures.
  }
}

async function readStoredLanguage(): Promise<Language> {
  const storage = getChromeStorage();
  if (!storage) return readFallbackLanguage();

  return new Promise((resolve) => {
    storage.get(LANGUAGE_KEY, (result) => {
      if (globalThis.chrome?.runtime?.lastError) {
        resolve(readFallbackLanguage());
        return;
      }
      resolve(normalizeLanguage(result?.[LANGUAGE_KEY]));
    });
  });
}

async function writeStoredLanguage(language: Language): Promise<void> {
  writeFallbackLanguage(language);
  const storage = getChromeStorage();
  if (!storage) return;

  await new Promise<void>((resolve) => {
    storage.set({ [LANGUAGE_KEY]: language }, () => resolve());
  });
}

function subscribe(callback: () => void) {
  subscribers.add(callback);
  if (!initialized) {
    initialized = true;
    void readStoredLanguage().then((language) => {
      currentLanguage = language;
      notify();
    });
  }

  return () => subscribers.delete(callback);
}

function getSnapshot() {
  return currentLanguage;
}

export function translate(language: Language, key: string, values?: Record<string, string | number>) {
  const template = dictionaries[language][key] ?? dictionaries.en[key] ?? key;
  if (!values) return template;

  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  );
}

export function useLanguage() {
  const language = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setLanguage = useCallback(async (nextLanguage: Language) => {
    currentLanguage = nextLanguage;
    notify();
    await writeStoredLanguage(nextLanguage);
  }, []);

  const t = useCallback(
    (key: string, values?: Record<string, string | number>) => translate(language, key, values),
    [language]
  );

  return useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
}
