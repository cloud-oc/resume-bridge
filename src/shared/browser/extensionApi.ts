type BrowserWithSidebar = typeof chrome & {
  sidebarAction?: {
    open?: () => Promise<void> | void;
  };
};

export async function openExtensionSidebar(tabId?: number): Promise<void> {
  if (tabId && chrome.sidePanel?.open) {
    await chrome.sidePanel.open({ tabId });
    return;
  }

  const browserApi = chrome as BrowserWithSidebar;
  if (browserApi.sidebarAction?.open) {
    await browserApi.sidebarAction.open();
    return;
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL('pages/sidebar.html') });
}

export async function enableExtensionSidebar(): Promise<void> {
  if (chrome.sidePanel?.setOptions) {
    await chrome.sidePanel.setOptions({ enabled: true });
  }
}
