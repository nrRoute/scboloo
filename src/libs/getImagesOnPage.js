import getActiveTab from "./getActiveTab";

const sendGetImagesMessage = async (tabId) => {
  return await new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(
        tabId,
        {
          target: "content",
          action: "getImages",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(Array.isArray(response) ? response : []);
        },
      );
    } catch (e) {
      resolve(null);
    }
  });
};

export async function request() {
  const activeTab = await getActiveTab();
  if (!(activeTab && activeTab.id)) return [];

  const primary = await sendGetImagesMessage(activeTab.id);
  return primary !== null ? primary : [];
}

const resolveUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  try {
    return new URL(rawUrl.trim(), window.location.href).href;
  } catch (e) {
    return "";
  }
};

const addImage = (images, rawUrl) => {
  const url = resolveUrl(rawUrl);
  if (!url) return;
  if (/^javascript:/i.test(url)) return;
  images.add(url);
};

export const response = () => {
  const images = new Set();

  Array.from(document.querySelectorAll('meta[property="og:image"]')).forEach(
    (tag) => addImage(images, tag.content),
  );

  Array.from(document.querySelectorAll("img")).forEach((img) => {
    addImage(images, img.currentSrc || img.src);
  });

  return Array.from(images);
};
