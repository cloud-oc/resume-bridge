// ============================================================
// Background Service Worker
// 处理插件后台逻辑：右键菜单、消息路由、侧边栏管理
// ============================================================

import { enableExtensionSidebar, openExtensionSidebar } from '@/shared/browser/extensionApi';

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Resume Bridge] 插件已安装/更新');

  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'resume-bridge-fill-field',
    title: '智能填充此字段',
    contexts: ['editable'],
  });

  chrome.contextMenus.create({
    id: 'resume-bridge-fill-page',
    title: '一键填充整页',
    contexts: ['page'],
  });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const tabId = tab.id;

  ensureContentScriptReady(tabId).then(() => {
    if (info.menuItemId === 'resume-bridge-fill-field') {
      chrome.tabs.sendMessage(tabId, {
        type: 'FILL_SINGLE_FIELD',
      }, () => {
        void chrome.runtime.lastError;
      });
    } else if (info.menuItemId === 'resume-bridge-fill-page') {
      chrome.tabs.sendMessage(tabId, {
        type: 'FILL_ALL_FIELDS',
      }, () => {
        void chrome.runtime.lastError;
      });
    }
  }).catch(() => {
    openExtensionSidebar(tabId);
  });
});

// 处理来自 content script / popup / sidebar 的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'OPEN_SIDEBAR':
      // 打开侧边栏
      enableExtensionSidebar()
        .then(() => openExtensionSidebar(message.tabId))
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, message: error.message }));
      return true;

    case 'GET_ACTIVE_TAB':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        sendResponse({ tab: tabs[0] });
      });
      return true; // 异步响应

    case 'SCAN_PAGE':
      // 转发扫描请求给 content script
      if (message.tabId) {
        ensureContentScriptReady(message.tabId)
          .then(() => chrome.tabs.sendMessage(message.tabId, { type: 'SCAN_FORM_FIELDS' }, (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              sendResponse({ success: false, message: lastError.message });
              return;
            }
            sendResponse(response);
          }))
          .catch((error) => sendResponse({ success: false, message: error.message }));
        return true;
      }
      break;

    case 'FILL_FIELDS':
      // 转发填充请求给 content script
      if (message.tabId) {
        ensureContentScriptReady(message.tabId)
          .then(() => chrome.tabs.sendMessage(
            message.tabId,
            {
              type: 'EXECUTE_FILL',
              data: message.data,
            },
            (response) => {
              const lastError = chrome.runtime.lastError;
              if (lastError) {
                sendResponse({ success: false, message: lastError.message });
                return;
              }
              sendResponse(response);
            }
          ))
          .catch((error) => sendResponse({ success: false, message: error.message }));
        return true;
      }
      break;

    case 'CLEAR_FILLED':
      // 清空已填充内容
      if (message.tabId) {
        ensureContentScriptReady(message.tabId)
          .then(() => chrome.tabs.sendMessage(message.tabId, { type: 'CLEAR_ALL_FILLED' }, (response) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              sendResponse({ success: false, message: lastError.message });
              return;
            }
            sendResponse(response);
          }))
          .catch((error) => sendResponse({ success: false, message: error.message }));
        return true;
      }
      break;

    default:
      break;
  }
});

async function ensureContentScriptReady(tabId: number): Promise<void> {
  if (await pingContentScript(tabId)) return;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });

  if (!await pingContentScript(tabId)) {
    throw new Error('页面助手启动失败');
  }
}

function pingContentScript(tabId: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 500);
    chrome.tabs.sendMessage(tabId, { type: 'RESUME_BRIDGE_PING' }, (response) => {
      clearTimeout(timeout);
      const lastError = chrome.runtime.lastError;
      resolve(Boolean(response?.success) && !lastError);
    });
  });
}

// 点击插件图标时打开侧边栏
chrome.action.onClicked.addListener((tab) => {
  openExtensionSidebar(tab.id);
});

export {};
