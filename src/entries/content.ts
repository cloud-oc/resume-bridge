// ============================================================
// Content Script V2 - 增强版页面注入脚本
// 新增：ATS 自动检测、SPA 动态表单适配、增强 label 提取、
//       React/Vue 输入事件模拟、填充动画效果
// ============================================================

import type { FormField, FillFieldResult } from '@/shared/types/models';

// =================== ATS 检测（内联版） ===================

interface DetectedATS {
  name: string;
  formSelector: string;
  labelStrategy: 'ant' | 'element' | 'moka' | 'standard';
  loadDelay: number;
}

const DEFAULT_FORM_SELECTOR =
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea, [contenteditable="true"]';
const MAX_SCAN_FIELDS = 180;

function hasDomSignal(selectors: string[]): boolean {
  return selectors.some((selector) => Boolean(document.querySelector(selector)));
}

function detectCurrentATS(): DetectedATS | null {
  const url = window.location.href;
  const host = window.location.hostname;

  // 北森
  if (/\.italent\.cn|\.beisen\.com|italentx\.|career\.beisen/.test(url) ||
      hasDomSignal(['.italent-form', '[class*="italent"]', '[class*="beisen"]'])) {
    return {
      name: '北森 iTalentX',
      formSelector: 'input, select, textarea, .ant-input, .ant-select .ant-select-selection-search-input, [contenteditable="true"]',
      labelStrategy: 'ant',
      loadDelay: 2000,
    };
  }

  // Moka
  if (/\.mokahr\.com|\.moka\.com|career\.moka/.test(url)) {
    return {
      name: 'Moka',
      formSelector: 'input, select, textarea, .moka-input, .moka-select, [contenteditable="true"]',
      labelStrategy: 'moka',
      loadDelay: 1500,
    };
  }

  // 智联
  if (host.endsWith('zhaopin.com')) {
    return { name: '智联招聘', formSelector: '', labelStrategy: 'standard', loadDelay: 1000 };
  }

  // 牛客
  if (host.endsWith('nowcoder.com')) {
    return { name: '牛客网', formSelector: '', labelStrategy: 'standard', loadDelay: 1000 };
  }

  // Greenhouse
  if (/greenhouse\.io/.test(url)) {
    return {
      name: 'Greenhouse',
      formSelector: '#application-form input, #application-form select, #application-form textarea',
      labelStrategy: 'standard',
      loadDelay: 500,
    };
  }

  // Element UI / Ant Design 检测
  if (document.querySelector('.ant-form, .ant-input, [class*="ant-"]')) {
    return { name: 'Ant Design SPA', formSelector: '', labelStrategy: 'ant', loadDelay: 1500 };
  }

  if (document.querySelector('.el-form, .el-input, [class*="el-"]')) {
    return { name: 'Element UI SPA', formSelector: '', labelStrategy: 'element', loadDelay: 1500 };
  }

  return null;
}

function isLikelyApplicationPage(): boolean {
  if (detectCurrentATS()) return true;

  const url = window.location.href.toLowerCase();
  if (/apply|application|career|job|jobs|recruit|resume|candidate|talent|zhaopin|campus|hire|ats/.test(url)) {
    return true;
  }

  return Boolean(document.querySelector('form, input, select, textarea, [contenteditable="true"]'));
}

// =================== 工具函数 ===================

let fieldCounter = 0;
function genId(): string {
  return `ca_${Date.now()}_${++fieldCounter}`;
}

function getXPath(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body) {
    let index = 1;
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (sibling.tagName === current.tagName) index++;
      sibling = sibling.previousElementSibling;
    }
    parts.unshift(`${current.tagName.toLowerCase()}[${index}]`);
    current = current.parentElement;
  }
  return '//' + parts.join('/');
}

function getCssSelector(element: Element): string {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const path: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }
    if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).slice(0, 2)
        .filter(c => !c.startsWith('data-v-') && c.length < 30) // 过滤 Vue scoped 类名
        .map(c => CSS.escape(c)).join('.');
      if (classes) selector += `.${classes}`;
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(' > ');
}

function isVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  );
}

function shouldSkipField(element: HTMLElement): boolean {
  const inputType = (element as HTMLInputElement).type?.toLowerCase();
  if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(inputType)) return true;
  if ((element as HTMLInputElement).readOnly || (element as HTMLInputElement).disabled) return true;
  if (element.closest('remove-web-limits-iqxin')) return true;
  if (isCustomSelectSearchInput(element)) return true;

  const joinedAttrs = [
    element.getAttribute('name'),
    element.id,
    element.className && typeof element.className === 'string' ? element.className : '',
    element.getAttribute('aria-label'),
    element.getAttribute('placeholder'),
    element.getAttribute('role'),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /search|captcha|verify|verification|otp|sms|code|password|comment|filter|keyword|query|newsletter|subscribe/.test(joinedAttrs);
}

function isCustomSelectSearchInput(element: HTMLElement): boolean {
  const inputType = (element as HTMLInputElement).type?.toLowerCase();
  const role = element.getAttribute('role')?.toLowerCase();
  const className = typeof element.className === 'string' ? element.className.toLowerCase() : '';

  if (className.includes('__select__selector__search__input')) return true;
  if (className.includes('select') && className.includes('search')) return true;

  return (
    inputType === 'search' &&
    role === 'combobox' &&
    Boolean(element.closest('.ud__select, .ant-select, .el-select, [class*="select"], [class*="Select"]'))
  );
}

function getSelectOptions(element: HTMLSelectElement): string[] {
  return Array.from(element.options)
    .map((opt) => opt.text.trim())
    .filter((t) => t && t !== '请选择' && t !== '-- 请选择 --' && t !== 'Select');
}

// =================== 增强版 Label 提取 ===================

function cleanShortText(text?: string | null, maxLength = 80): string {
  if (!text) return '';
  return cleanLabel(text).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function getNearestAttribute(element: HTMLElement, attr: string, maxDepth = 12): string {
  let current: HTMLElement | null = element;
  for (let i = 0; i <= maxDepth && current; i++) {
    const value = current.getAttribute(attr);
    if (value?.trim()) return value.trim();
    current = current.parentElement;
  }
  return '';
}

function getStableFieldLabel(element: HTMLElement): string {
  const label =
    getNearestAttribute(element, 'data-form-field-i18n-name') ||
    getNearestAttribute(element, 'data-form-field-label') ||
    getNearestAttribute(element, 'data-field-label') ||
    getNearestAttribute(element, 'data-label');

  return cleanShortText(label);
}

function getStableFieldName(element: HTMLElement): string {
  return (
    getNearestAttribute(element, 'data-form-field-name') ||
    getNearestAttribute(element, 'data-field-name') ||
    element.getAttribute('name') ||
    ''
  );
}

function getStableFieldId(element: HTMLElement): string {
  return (
    getNearestAttribute(element, 'data-form-field-id') ||
    getNearestAttribute(element, 'data-field-id') ||
    element.id ||
    ''
  );
}

function getTextWithoutControls(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('input, select, textarea, option, script, style, svg').forEach((node) => node.remove());
  return cleanShortText(clone.textContent, 120);
}

function countFillableControls(container: Element): number {
  return container.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea, [contenteditable="true"]'
  ).length;
}

function isScopedFieldContainer(container: Element): boolean {
  const className = typeof (container as HTMLElement).className === 'string'
    ? (container as HTMLElement).className.toLowerCase()
    : '';
  if (/formily-item|form-item|form__item|field-item|field__item|ant-form-item|el-form-item/.test(className)) {
    return true;
  }
  return countFillableControls(container) <= 3;
}

function getFieldItem(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>(
    '.ud-formily-item[data-form-field-id], .ant-form-item, .el-form-item, .form-item, .form-field, [class*="form-item"][data-form-field-id], [class*="field-item"][data-form-field-id]'
  );
}

function augmentRangeLabel(element: HTMLElement, label: string): string {
  const rangeWrapper = element.closest(
    '.throne-biz-date-range-picker-wrapper, [class*="date-range"], [class*="DateRange"], [class*="range-picker"], [class*="RangePicker"]'
  );
  if (!rangeWrapper || !/起止|时间|日期|date|time|from|to/i.test(label)) return label;

  const inputs = Array.from(
    rangeWrapper.querySelectorAll<HTMLInputElement>('input:not([type="hidden"])')
  ).filter((input) => isVisible(input));
  const index = inputs.indexOf(element as HTMLInputElement);
  if (index === 0) return `${label} 开始`;
  if (index === inputs.length - 1 && inputs.length > 1) return `${label} 结束`;
  return label;
}

function getNearbySelectedValue(element: HTMLElement): string {
  const fieldItem = getFieldItem(element);
  let previous = fieldItem?.previousElementSibling;
  for (let i = 0; i < 3 && previous; i++) {
    const selected = previous.querySelector(
      '.ud__select__selector__selectItem, .ant-select-selection-item, .el-select__selected-item, [class*="selectItem"], [class*="selection-item"]'
    );
    const text = cleanShortText(selected?.textContent, 40);
    if (text) return text;

    const textOnly = getTextWithoutControls(previous);
    const socialValue = textOnly.replace(/^社交平台/, '').trim();
    if (socialValue && socialValue.length <= 40) return socialValue;

    previous = previous.previousElementSibling;
  }

  const group = element.closest('[class*="array-card"], [class*="array"], [class*="row"], [class*="group"]');
  if (group) {
    const selectedItems = Array.from(
      group.querySelectorAll('.ud__select__selector__selectItem, .ant-select-selection-item, .el-select__selected-item')
    )
      .map((node) => cleanShortText(node.textContent, 40))
      .filter(Boolean);
    const first = selectedItems.find((text) => !/请选择|select/i.test(text));
    if (first) return first;
  }

  return '';
}

function augmentGenericLabel(element: HTMLElement, label: string): string {
  const normalized = label.toLowerCase().replace(/\s+/g, '');
  if (/^(url\/id|url|id|链接|网址)$/.test(normalized)) {
    const selected = getNearbySelectedValue(element);
    if (selected) return `${selected} ${label}`;
  }
  return label;
}

function findLabel(element: HTMLElement, ats: DetectedATS | null): string {
  const stableLabel = getStableFieldLabel(element);
  if (stableLabel) {
    return augmentGenericLabel(element, augmentRangeLabel(element, stableLabel));
  }

  // ===== ATS 专用 label 策略 =====

  const udFormItem = getFieldItem(element);
  if (udFormItem) {
    const label = udFormItem.querySelector(
      '.ud-formily-item-label label, .ud-formily-item-label-content label, [class*="formily-item-label"] label'
    );
    const text = cleanShortText(label?.textContent);
    if (text) return augmentGenericLabel(element, augmentRangeLabel(element, text));
  }

  // Ant Design 系统（北森等）
  if (ats?.labelStrategy === 'ant') {
    const formItem = element.closest('.ant-form-item, .ant-row');
    if (formItem) {
      const label = formItem.querySelector('.ant-form-item-label label, .ant-form-item-label > span');
      if (label?.textContent?.trim()) {
        return augmentGenericLabel(element, augmentRangeLabel(element, cleanLabel(label.textContent.trim())));
      }
    }
  }

  // Element UI 系统
  if (ats?.labelStrategy === 'element') {
    const formItem = element.closest('.el-form-item');
    if (formItem) {
      const label = formItem.querySelector('.el-form-item__label');
      if (label?.textContent?.trim()) {
        return augmentGenericLabel(element, augmentRangeLabel(element, cleanLabel(label.textContent.trim())));
      }
    }
  }

  // Moka 系统
  if (ats?.labelStrategy === 'moka') {
    const formItem = element.closest('.form-field, .field-group, [class*="form-item"]');
    if (formItem) {
      const label = formItem.querySelector('.field-label, .form-label, label');
      if (label?.textContent?.trim()) {
        return augmentGenericLabel(element, augmentRangeLabel(element, cleanLabel(label.textContent.trim())));
      }
    }
  }

  // ===== 通用 label 提取策略 =====

  // 1. 通过 for 属性关联的 label
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label?.textContent) return augmentGenericLabel(element, augmentRangeLabel(element, cleanLabel(label.textContent.trim())));
  }

  // 2. 包裹在 form-item / form-group 容器中的 label
  const formItemSelectors = [
    '.form-item', '.form-field',
    '[class*="form-item"]', '[class*="form-group"]', '[class*="field-wrap"]',
    '.ant-form-item', '.el-form-item', '.ud-formily-item', '[class*="formily-item"]',
    'tr', // 表格布局
  ];
  for (const sel of formItemSelectors) {
    const container = element.closest(sel);
    if (container) {
      if (!isScopedFieldContainer(container)) continue;
      const label = container.querySelector(
        ':scope > label, :scope [class*="label"] label, :scope .label, :scope [class*="label"]:not(input):not(select):not(textarea)'
      );
      if (label && label !== element) {
        const text = getTextWithoutControls(label);
        if (text.length > 0 && text.length < 50) {
          return augmentGenericLabel(element, augmentRangeLabel(element, text));
        }
      }
    }
  }

  // 3. 父级 label 包裹
  const parentLabel = element.closest('label');
  if (parentLabel?.textContent) {
    const text = cleanLabel(parentLabel.textContent.trim());
    const val = (element as HTMLInputElement).value || '';
    const cleaned = text.replace(val, '').trim();
    if (cleaned) return augmentGenericLabel(element, augmentRangeLabel(element, cleaned));
  }

  // 4. 前一个兄弟
  let prev = element.previousElementSibling;
  while (prev) {
    if (['SPAN', 'DIV', 'LABEL', 'P', 'TD', 'TH', 'DT', 'STRONG', 'EM' ].includes(prev.tagName)) {
      const text = prev.textContent?.trim();
      if (text && text.length > 0 && text.length < 50 && !prev.querySelector('input, select, textarea')) {
        return augmentGenericLabel(element, augmentRangeLabel(element, cleanLabel(text)));
      }
    }
    prev = prev.previousElementSibling;
  }

  // 5. aria-label, title, placeholder
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return augmentGenericLabel(element, augmentRangeLabel(element, cleanLabel(ariaLabel)));

  const title = element.getAttribute('title');
  if (title && title.length < 50) return augmentGenericLabel(element, augmentRangeLabel(element, cleanLabel(title)));

  const placeholder = element.getAttribute('placeholder');
  if (placeholder && placeholder.length < 40 && !placeholder.includes('输入') && placeholder !== '请选择') {
    return augmentGenericLabel(element, augmentRangeLabel(element, cleanLabel(placeholder)));
  }

  // 6. name 属性的中文化映射
  const name = getStableFieldName(element);
  if (name) {
    const nameMap: Record<string, string> = {
      name: '姓名', username: '姓名', realname: '姓名', fullname: '姓名',
      phone: '手机号码', mobile: '手机号码', tel: '电话', telephone: '电话',
      email: '邮箱', mail: '邮箱',
      gender: '性别', sex: '性别',
      birthday: '出生日期', birth: '出生日期', birthdate: '出生日期',
      school: '学校', university: '学校', college: '学院',
      major: '专业', degree: '学历',
      company: '公司', organization: '公司',
      position: '岗位', title: '职位', role: '角色',
      address: '地址', city: '城市',
      idcard: '身份证号', idnumber: '身份证号',
    };
    const mapped = nameMap[name.toLowerCase().replace(/[_-]/g, '')];
    if (mapped) return augmentGenericLabel(element, augmentRangeLabel(element, mapped));
    return augmentGenericLabel(element, augmentRangeLabel(element, name));
  }

  return '未知字段';
}

/** 清理 label 文本 */
function cleanLabel(text: string): string {
  return text
    .replace(/[*：:]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\n]+|[\s\n]+$/g, '')
    .replace(/请输入|请选择|请填写|（必填）|（选填）|\(必填\)|\(选填\)|必填|选填/g, '')
    .trim();
}

// =================== 获取模块上下文 ===================

function getSectionContext(element: HTMLElement): string {
  let current: HTMLElement | null = element;
  for (let i = 0; i < 15 && current; i++) {
    current = current.parentElement;
    if (!current) break;

    // 匹配常见的分区容器
    const className = typeof current.className === 'string' ? current.className.toLowerCase() : '';
    const isSectionContainer =
      current.matches('fieldset, section') ||
      /section|module|block|panel|group|card|wrapper/.test(className);

    if (isSectionContainer) {
      const heading = current.querySelector(
        'legend, h1, h2, h3, h4, h5, .title, .header, [class*="title"], [class*="Title"], [class*="header"], [class*="Header"], [class*="text"], [class*="Text"]'
      );
      const text = cleanShortText(heading?.textContent, 50);
      if (text && !/添加|删除|更新|选择文件|上次上传/.test(text)) {
        return text;
      }
    }

    // 直接查找标题
    const heading = current.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4');
    if (heading?.textContent?.trim() && heading.textContent.trim().length < 50) {
      return heading.textContent.trim();
    }
  }
  return '';
}

// =================== 重复表单块上下文 ===================

interface RepeatGroupInfo {
  groupKey: string;
  groupIndex: number;
  fieldIndexInGroup: number;
  repeatContext?: string;
}

const REPEAT_GROUP_SELECTOR = [
  '[class*="array-card"]',
  '[class*="ArrayCard"]',
  '[class*="array-item"]',
  '[class*="ArrayItem"]',
  '[class*="repeat"]',
  '[class*="Repeat"]',
  '[data-formily-array-item]',
  '[data-array-item]',
].join(', ');

function getSectionContainer(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element.parentElement;
  for (let i = 0; i < 15 && current; i++) {
    const className = typeof current.className === 'string' ? current.className.toLowerCase() : '';
    const fieldCount = countFillableControls(current);
    const looksLikeSection =
      current.matches('fieldset, section, form') ||
      /section|module|block|panel|wrapper/.test(className);

    if (looksLikeSection && fieldCount >= 2) return current;
    current = current.parentElement;
  }
  return null;
}

function hasRepeatFieldShape(container: HTMLElement): boolean {
  const fieldNames = Array.from(
    container.querySelectorAll<HTMLElement>('[data-form-field-id], [data-form-field-name], input[name], textarea[name], select[name]')
  )
    .map((node) =>
      cleanShortText(
        node.getAttribute('data-form-field-id') ||
          node.getAttribute('data-form-field-name') ||
          node.getAttribute('name') ||
          '',
        40
      ).toLowerCase()
    )
    .filter(Boolean);

  const uniqueNames = new Set(fieldNames);
  const fillableCount = countFillableControls(container);
  const signatureHits = fieldNames.filter((name) =>
    /company|organization|employer|title|role|position|start|end|date|time|desc|description|school|major|degree/.test(name)
  ).length;

  return fillableCount >= 2 && uniqueNames.size >= 2 && signatureHits >= 2;
}

function findRepeatGroupElement(element: HTMLElement): HTMLElement | null {
  const explicitGroup = element.closest<HTMLElement>(REPEAT_GROUP_SELECTOR);
  const explicitGroupFieldCount = explicitGroup ? countFillableControls(explicitGroup) : 0;
  const explicitGroupClass = typeof explicitGroup?.className === 'string' ? explicitGroup.className.toLowerCase() : '';
  if (
    explicitGroup &&
    explicitGroupFieldCount >= 2 &&
    (explicitGroupFieldCount <= 12 || /array-card|array-item|repeat/.test(explicitGroupClass))
  ) {
    return explicitGroup;
  }

  const fieldItem = getFieldItem(element);
  let current = fieldItem?.parentElement || element.parentElement;
  const sectionContainer = getSectionContainer(element);

  for (let i = 0; i < 8 && current && current !== sectionContainer; i += 1) {
    const fillableCount = countFillableControls(current);
    if (fillableCount >= 2 && fillableCount <= 12 && hasRepeatFieldShape(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return null;
}

function getDirectRepeatGroups(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(REPEAT_GROUP_SELECTOR))
    .filter((candidate) => countFillableControls(candidate) >= 2);

  const directGroups = candidates.filter((candidate) =>
    !candidates.some((other) => other !== candidate && candidate.contains(other))
  );

  return directGroups.length ? directGroups : Array.from(container.children)
    .filter((child): child is HTMLElement => child instanceof HTMLElement && hasRepeatFieldShape(child));
}

function inferRepeatGroupInfo(element: HTMLElement, sectionContext: string): RepeatGroupInfo | undefined {
  const groupElement = findRepeatGroupElement(element);
  if (!groupElement) return undefined;

  const sectionContainer = getSectionContainer(groupElement) || groupElement.parentElement;
  const siblingGroups = sectionContainer
    ? getDirectRepeatGroups(sectionContainer).filter((group) => group.parentElement === groupElement.parentElement || sectionContainer.contains(group))
    : [];
  const fallbackSiblings = Array.from(groupElement.parentElement?.children || [])
    .filter((child): child is HTMLElement => child instanceof HTMLElement && hasRepeatFieldShape(child));
  const groups = siblingGroups.length > 1 ? siblingGroups : fallbackSiblings;
  const groupIndex = Math.max(0, groups.indexOf(groupElement));

  const fieldsInGroup = Array.from(
    groupElement.querySelectorAll<HTMLElement>(DEFAULT_FORM_SELECTOR)
  ).filter((candidate) => isVisible(candidate) && !shouldSkipField(candidate));
  const fieldIndexInGroup = Math.max(0, fieldsInGroup.indexOf(element));
  const sectionKey = cleanShortText(sectionContext || getSectionContext(groupElement) || 'form', 40);
  const groupKey = `${sectionKey || 'form'}::${groupIndex >= 0 ? groupIndex : 0}`;
  const repeatContext = getTextWithoutControls(groupElement)
    .replace(sectionKey, '')
    .trim()
    .slice(0, 120);

  return {
    groupKey,
    groupIndex: groupIndex >= 0 ? groupIndex : 0,
    fieldIndexInGroup,
    repeatContext: repeatContext || undefined,
  };
}

// =================== 核心功能：扫描表单字段 ===================

function scanFormFields(): FormField[] {
  if (!isLikelyApplicationPage()) return [];

  const ats = detectCurrentATS();
  const fields: FormField[] = [];
  const processedElements = new Set<HTMLElement>();

  if (ats) {
    console.log(`[Resume Bridge] 检测到 ATS 系统：${ats.name}`);
  }

  // 通用选择器 + ATS 专用选择器
  const selector = ats?.formSelector || DEFAULT_FORM_SELECTOR;

  const elements = document.querySelectorAll<HTMLElement>(selector);

  elements.forEach((el) => {
    if (fields.length >= MAX_SCAN_FIELDS) return;
    if (processedElements.has(el)) return;

    // 跳过隐藏、搜索框、导航元素等无关元素
    if (!isVisible(el)) return;
    if (shouldSkipField(el)) return;
    const inputType = (el as HTMLInputElement).type?.toLowerCase();

    const label = findLabel(el, ats);
    const stableFieldId = getStableFieldId(el);
    const stableFieldName = getStableFieldName(el);

    const sectionContext = getSectionContext(el);
    const repeatGroup = inferRepeatGroupInfo(el, sectionContext);

    const field: FormField = {
      id: genId(),
      elementId: el.id || stableFieldId || undefined,
      elementName: stableFieldName || el.getAttribute('name') || undefined,
      tagName: el.tagName.toLowerCase(),
      inputType: inputType || undefined,
      label,
      placeholder: el.getAttribute('placeholder') || undefined,
      required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
      maxLength: (el as HTMLInputElement).maxLength > 0 ? (el as HTMLInputElement).maxLength : undefined,
      pattern: el.getAttribute('pattern') || undefined,
      xpath: getXPath(el),
      cssSelector: getCssSelector(el),
      sectionContext,
      groupKey: repeatGroup?.groupKey,
      groupIndex: repeatGroup?.groupIndex,
      fieldIndexInGroup: repeatGroup?.fieldIndexInGroup,
      repeatContext: repeatGroup?.repeatContext,
      value: (el as HTMLInputElement).value || undefined,
    };

    // 获取下拉选项
    if (el.tagName === 'SELECT') {
      field.options = getSelectOptions(el as HTMLSelectElement);
    }

    // 对于 Ant Design / Element UI 的自定义下拉，尝试提取选项
    if (el.closest('.ant-select, .el-select')) {
      field.tagName = 'select';
      // 选项需要通过触发展开来获取，暂时标记
      field.options = [];
    }

    fields.push(field);
    el.setAttribute('data-ca-field-id', field.id);
    processedElements.add(el);
  });

  return fields;
}

// =================== 核心功能：增强版填充 ===================

function executeFill(fieldsToFill: { fieldId: string; value: string; type?: string }[]): FillFieldResult[] {
  const ats = detectCurrentATS();
  const results: FillFieldResult[] = [];

  fieldsToFill.forEach(({ fieldId, value, type }) => {
    const element = document.querySelector<HTMLElement>(`[data-ca-field-id="${fieldId}"]`);

    if (!element) {
      results.push({
        fieldId,
        label: '未找到元素',
        type: (type as FillFieldResult['type']) || 'unknown',
        status: 'failed',
        errorMessage: '页面元素未找到，可能已重新加载',
        confidence: 0,
      });
      return;
    }

    try {
      const tagName = element.tagName.toLowerCase();
      const inputType = (element as HTMLInputElement).type?.toLowerCase();

      if (tagName === 'select') {
        fillSelect(element as HTMLSelectElement, value);
      } else if (tagName === 'textarea' || (tagName === 'input' && !['radio', 'checkbox'].includes(inputType))) {
        fillTextInput(element as HTMLInputElement, value);
      } else if (inputType === 'radio') {
        fillRadio(element as HTMLInputElement, value, ats);
      } else if (inputType === 'checkbox') {
        fillCheckbox(element as HTMLInputElement, value);
      } else if (element.getAttribute('contenteditable') === 'true') {
        element.innerHTML = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // 成功高亮（带动画）
      applySuccessHighlight(element);

      results.push({
        fieldId,
        label: findLabel(element, ats),
        type: (type as FillFieldResult['type']) || 'text',
        status: 'success',
        filledValue: value,
        confidence: 1,
      });
    } catch (error) {
      applyErrorHighlight(element);
      results.push({
        fieldId,
        label: findLabel(element, ats),
        type: (type as FillFieldResult['type']) || 'unknown',
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : '填充失败',
        confidence: 0,
      });
    }
  });

  return results;
}

// =================== 填充辅助函数 ===================

/** 填充文本输入（模拟真人输入，兼容 React/Vue） */
function fillTextInput(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // React 使用内部属性追踪值，需要特殊处理
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  )?.set;
  const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value'
  )?.set;

  input.focus();
  input.dispatchEvent(new Event('focus', { bubbles: true }));

  // 使用 native setter 绕过 React 的受控组件机制
  if (input.tagName === 'TEXTAREA' && nativeTextareaValueSetter) {
    nativeTextareaValueSetter.call(input, value);
  } else if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  // 触发完整的事件链
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  // React 17+ 使用 InputEvent
  input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

/** 填充下拉选择框 */
function fillSelect(select: HTMLSelectElement, value: string): void {
  const option = Array.from(select.options).find(
    (opt) =>
      opt.value === value ||
      opt.text.trim() === value ||
      opt.text.trim().includes(value) ||
      value.includes(opt.text.trim())
  );

  if (option) {
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // 模糊匹配：找最相似的选项
    let bestMatch: HTMLOptionElement | null = null;
    let bestScore = 0;
    Array.from(select.options).forEach((opt) => {
      if (!opt.value || opt.value === '-1') return;
      const optText = opt.text.trim().toLowerCase();
      const valText = value.toLowerCase();
      const overlap = [...valText].filter(c => optText.includes(c)).length / valText.length;
      if (overlap > bestScore && overlap >= 0.5) {
        bestScore = overlap;
        bestMatch = opt;
      }
    });
    if (bestMatch) {
      select.value = (bestMatch as HTMLOptionElement).value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

/** 填充单选框 */
function fillRadio(radio: HTMLInputElement, value: string, ats: DetectedATS | null): void {
  // 找到同名的所有 radio
  const name = radio.getAttribute('name');
  if (!name) {
    if (radio.value === value) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  const radios = document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`);
  radios.forEach((r) => {
    const label = findLabel(r, ats);
    if (r.value === value || label === value || label.includes(value) || value.includes(label)) {
      r.checked = true;
      r.dispatchEvent(new Event('change', { bubbles: true }));
      r.dispatchEvent(new Event('click', { bubbles: true }));
    }
  });
}

/** 填充复选框 */
function fillCheckbox(checkbox: HTMLInputElement, value: string): void {
  const shouldCheck = value === 'true' || value === '1' || value === 'yes' || value === checkbox.value;
  if (checkbox.checked !== shouldCheck) {
    checkbox.checked = shouldCheck;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    checkbox.dispatchEvent(new Event('click', { bubbles: true }));
  }
}

// =================== 高亮效果 ===================

/** 注入高亮 CSS（首次调用时执行） */
let highlightCSSInjected = false;
function injectHighlightCSS(): void {
  if (highlightCSSInjected) return;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes ca-fill-success {
      0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
      50% { box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.3); }
      100% { box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2); }
    }
    @keyframes ca-fill-error {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
      50% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.3); }
      100% { box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2); }
    }
    [data-ca-filled="success"] {
      outline: 2px solid #22c55e !important;
      outline-offset: 2px !important;
      animation: ca-fill-success 0.6s ease forwards !important;
    }
    [data-ca-filled="error"] {
      outline: 2px solid #ef4444 !important;
      outline-offset: 2px !important;
      animation: ca-fill-error 0.6s ease forwards !important;
    }
    [data-ca-filled="pending"] {
      outline: 2px solid #f59e0b !important;
      outline-offset: 2px !important;
    }
  `;
  document.head.appendChild(style);
  highlightCSSInjected = true;
}

function applySuccessHighlight(element: HTMLElement): void {
  injectHighlightCSS();
  element.setAttribute('data-ca-filled', 'success');
}

function applyErrorHighlight(element: HTMLElement): void {
  injectHighlightCSS();
  element.setAttribute('data-ca-filled', 'error');
}

// =================== 清空填充 ===================

function clearAllFilled(): void {
  const filledElements = document.querySelectorAll<HTMLElement>('[data-ca-filled]');
  filledElements.forEach((el) => {
    el.removeAttribute('data-ca-filled');
    el.style.outline = '';
    el.style.outlineOffset = '';
    el.style.boxShadow = '';

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
        'value'
      )?.set;
      if (nativeSetter) nativeSetter.call(el, '');
      else (el as HTMLInputElement).value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.tagName === 'SELECT') {
      (el as HTMLSelectElement).selectedIndex = 0;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  // 移除所有 data-ca-field-id
  document.querySelectorAll('[data-ca-field-id]').forEach((el) => {
    el.removeAttribute('data-ca-field-id');
  });
}

// =================== 消息监听 ===================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'RESUME_BRIDGE_PING': {
      sendResponse({ success: true });
      break;
    }

    case 'SCAN_FORM_FIELDS': {
      const ats = detectCurrentATS();
      const atsName = ats?.name || '通用页面';
      const fields = scanFormFields();
      console.log(`[Resume Bridge] [${atsName}] 扫描到 ${fields.length} 个表单字段`);
      sendResponse({ success: true, fields, atsName });
      break;
    }

    case 'EXECUTE_FILL': {
      const results = executeFill(message.data);
      const success = results.filter((r) => r.status === 'success').length;
      console.log(`[Resume Bridge] 填充完成：${success}/${results.length} 成功`);
      sendResponse({ success: true, results });
      break;
    }

    case 'CLEAR_ALL_FILLED': {
      clearAllFilled();
      console.log('[Resume Bridge] 已清空所有填充内容');
      sendResponse({ success: true });
      break;
    }

    case 'FILL_SINGLE_FIELD': {
      sendResponse({ success: false, message: '单字段填充功能开发中' });
      break;
    }

    case 'FILL_ALL_FIELDS': {
      chrome.runtime.sendMessage({ type: 'TRIGGER_FILL_FROM_CONTEXT_MENU' });
      sendResponse({ success: true });
      break;
    }

    case 'DETECT_ATS': {
      const detectedAts = detectCurrentATS();
      sendResponse({ success: true, ats: detectedAts });
      break;
    }

    default:
      break;
  }
});

// 初始化时只做轻量标记，具体扫描由用户动作触发。
const initialATS = detectCurrentATS();
if (initialATS) {
  console.debug(`[Resume Bridge] 检测到 ATS 系统：${initialATS.name}`);
}
