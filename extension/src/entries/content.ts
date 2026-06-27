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

function detectCurrentATS(): DetectedATS | null {
  const url = window.location.href;
  const html = document.body?.innerHTML?.substring(0, 3000) || '';

  // 北森
  if (/\.italent\.cn|\.beisen\.com|italentx\.|career\.beisen/.test(url) ||
      /italent|beisen/.test(html.toLowerCase())) {
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
  if (/\.zhaopin\.com/.test(url)) {
    return { name: '智联招聘', formSelector: '', labelStrategy: 'standard', loadDelay: 1000 };
  }

  // 牛客
  if (/\.nowcoder\.com/.test(url)) {
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
  if (!element.offsetParent && element.tagName !== 'BODY') {
    const style = window.getComputedStyle(element);
    if (style.position !== 'fixed' && style.position !== 'sticky') return false;
  }
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetWidth > 0 &&
    element.offsetHeight > 0
  );
}

function getSelectOptions(element: HTMLSelectElement): string[] {
  return Array.from(element.options)
    .map((opt) => opt.text.trim())
    .filter((t) => t && t !== '请选择' && t !== '-- 请选择 --' && t !== 'Select');
}

// =================== 增强版 Label 提取 ===================

function findLabel(element: HTMLElement, ats: DetectedATS | null): string {
  // ===== ATS 专用 label 策略 =====

  // Ant Design 系统（北森等）
  if (ats?.labelStrategy === 'ant') {
    const formItem = element.closest('.ant-form-item, .ant-row');
    if (formItem) {
      const label = formItem.querySelector('.ant-form-item-label label, .ant-form-item-label > span');
      if (label?.textContent?.trim()) {
        return cleanLabel(label.textContent.trim());
      }
    }
  }

  // Element UI 系统
  if (ats?.labelStrategy === 'element') {
    const formItem = element.closest('.el-form-item');
    if (formItem) {
      const label = formItem.querySelector('.el-form-item__label');
      if (label?.textContent?.trim()) {
        return cleanLabel(label.textContent.trim());
      }
    }
  }

  // Moka 系统
  if (ats?.labelStrategy === 'moka') {
    const formItem = element.closest('.form-field, .field-group, [class*="form-item"]');
    if (formItem) {
      const label = formItem.querySelector('.field-label, .form-label, label');
      if (label?.textContent?.trim()) {
        return cleanLabel(label.textContent.trim());
      }
    }
  }

  // ===== 通用 label 提取策略 =====

  // 1. 通过 for 属性关联的 label
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label?.textContent) return cleanLabel(label.textContent.trim());
  }

  // 2. 包裹在 form-item / form-group 容器中的 label
  const formItemSelectors = [
    '.form-item', '.form-group', '.form-field',
    '[class*="form-item"]', '[class*="form-group"]', '[class*="field-wrap"]',
    '.ant-form-item', '.el-form-item',
    'tr', // 表格布局
  ];
  for (const sel of formItemSelectors) {
    const container = element.closest(sel);
    if (container) {
      const label = container.querySelector('label, .label, [class*="label"]:not(input):not(select):not(textarea)');
      if (label && label !== element && label.textContent?.trim()) {
        const text = cleanLabel(label.textContent.trim());
        if (text.length > 0 && text.length < 50) return text;
      }
    }
  }

  // 3. 父级 label 包裹
  const parentLabel = element.closest('label');
  if (parentLabel?.textContent) {
    const text = cleanLabel(parentLabel.textContent.trim());
    const val = (element as HTMLInputElement).value || '';
    const cleaned = text.replace(val, '').trim();
    if (cleaned) return cleaned;
  }

  // 4. 前一个兄弟
  let prev = element.previousElementSibling;
  while (prev) {
    if (['SPAN', 'DIV', 'LABEL', 'P', 'TD', 'TH', 'DT', 'STRONG', 'EM' ].includes(prev.tagName)) {
      const text = prev.textContent?.trim();
      if (text && text.length > 0 && text.length < 50 && !prev.querySelector('input, select, textarea')) {
        return cleanLabel(text);
      }
    }
    prev = prev.previousElementSibling;
  }

  // 5. aria-label, title, placeholder
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return cleanLabel(ariaLabel);

  const title = element.getAttribute('title');
  if (title && title.length < 50) return cleanLabel(title);

  const placeholder = element.getAttribute('placeholder');
  if (placeholder && placeholder.length < 40 && !placeholder.includes('输入') && placeholder !== '请选择') {
    return cleanLabel(placeholder);
  }

  // 6. name 属性的中文化映射
  const name = element.getAttribute('name') || '';
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
    if (mapped) return mapped;
    return name;
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
    const sectionSelectors = 'fieldset, section, [class*="section"], [class*="module"], [class*="block"], [class*="panel"], [class*="group"]';
    if (current.matches(sectionSelectors)) {
      const heading = current.querySelector('legend, h1, h2, h3, h4, h5, .title, .header, [class*="title"], [class*="header"]');
      if (heading?.textContent?.trim() && heading.textContent.trim().length < 50) {
        return heading.textContent.trim();
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

// =================== 核心功能：扫描表单字段 ===================

function scanFormFields(): FormField[] {
  const ats = detectCurrentATS();
  const fields: FormField[] = [];
  const processedElements = new Set<HTMLElement>();

  if (ats) {
    console.log(`[Resume Bridge] 检测到 ATS 系统：${ats.name}`);
  }

  // 通用选择器 + ATS 专用选择器
  const defaultSelector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea, [contenteditable="true"]';
  const selector = ats?.formSelector || defaultSelector;

  const elements = document.querySelectorAll<HTMLElement>(selector);

  elements.forEach((el) => {
    if (processedElements.has(el)) return;

    // 跳过隐藏、搜索框、导航元素等无关元素
    if (!isVisible(el)) return;
    const inputType = (el as HTMLInputElement).type?.toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(inputType)) return;

    const name = (el.getAttribute('name') || '').toLowerCase();
    const id = (el.id || '').toLowerCase();
    const classList = el.className?.toLowerCase?.() || '';
    if (name.includes('search') || id.includes('search') || classList.includes('search')) return;
    if (name.includes('captcha') || id.includes('captcha') || name.includes('verify')) return;

    const label = findLabel(el, ats);

    const field: FormField = {
      id: genId(),
      elementId: el.id || undefined,
      elementName: el.getAttribute('name') || undefined,
      tagName: el.tagName.toLowerCase(),
      inputType: inputType || undefined,
      label,
      placeholder: el.getAttribute('placeholder') || undefined,
      required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
      maxLength: (el as HTMLInputElement).maxLength > 0 ? (el as HTMLInputElement).maxLength : undefined,
      pattern: el.getAttribute('pattern') || undefined,
      xpath: getXPath(el),
      cssSelector: getCssSelector(el),
      sectionContext: getSectionContext(el),
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

// 初始化
console.log('[Resume Bridge] 内容脚本已加载 v2');
const initialATS = detectCurrentATS();
if (initialATS) {
  console.log(`[Resume Bridge] 检测到 ATS 系统：${initialATS.name}`);
}
