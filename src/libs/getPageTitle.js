import getActiveTab from "./getActiveTab";

export const request = () =>
  new Promise(async (resolve) => {
    const activeTab = await getActiveTab();
    if (!(activeTab && activeTab.id)) {
      resolve("");
      return;
    }
    chrome.tabs.sendMessage(
      activeTab.id,
      {
        target: "content",
        action: "getPageTitle",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve(activeTab.title || "");
          return;
        }
        resolve(
          (typeof response === "string" && response) || activeTab.title || "",
        );
      },
    );
  });

export const response = () => document.title;
