import config from "./config";
import uploadGyazo from "./libs/uploadGyazo";
import createScrapboxPage from "./libs/createScrapboxPage";
import MessageListener from "./libs/MessageListener";
import { request as getImagesOnPage } from "./libs/getImagesOnPage";
import { request as getPageTitle } from "./libs/getPageTitle";
import getActiveTab from "./libs/getActiveTab";

const resolveMimeType = (srcUrl, contentType) => {
  if (contentType) return contentType.split(";")[0];
  if (/png($|[?#])/i.test(srcUrl)) return "image/png";
  if (/jpe?g($|[?#])/i.test(srcUrl)) return "image/jpeg";
  if (/gif($|[?#])/i.test(srcUrl)) return "image/gif";
  return "application/octet-stream";
};

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
};

const convertDataUrl = async (srcUrl) => {
  const response = await fetch(srcUrl);
  const buffer = await response.arrayBuffer();
  const mimeType = resolveMimeType(
    srcUrl,
    response.headers.get("content-type"),
  );
  return `data:${mimeType};base64,${toBase64(buffer)}`;
};

const captureVisibleTab = () =>
  new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(undefined, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(dataUrl);
    });
  });

const onMessageListener = new MessageListener("main");
onMessageListener.add("fetchApi", async (message, sender, sendResponse) => {
  try {
    const res = await fetch(config.getApiUrl(message.apiType), {
      credentials: "include",
      mode: "cors",
    });
    sendResponse(await res.json());
  } catch (e) {
    sendResponse({ projects: [] });
  }
});
onMessageListener.add(
  "createScrapboxPage",
  async (message, sender, sendResponse) => {
    let { text, title, imageUrl, projectName } = message;
    const originalTitle = await getPageTitle();
    const tab = await getActiveTab();
    const body = [`[${originalTitle} ${tab.url}]`];
    if (imageUrl) {
      if (/^https?/.test(imageUrl)) {
        imageUrl = await convertDataUrl(imageUrl);
      }
      const responseURL = await uploadGyazo(imageUrl, tab);
      body.push(`[${responseURL} ${tab.url}]`);
    }
    body.push(text);
    createScrapboxPage({
      title,
      projectName,
      body: body.join("\n"),
    });
  },
);
onMessageListener.add(
  "getQuotedText",
  async (message, sender, sendResponse) => {
    const activeTab = await getActiveTab();
    if (!(activeTab && activeTab.id)) {
      sendResponse("");
      return;
    }
    chrome.tabs.sendMessage(
      activeTab.id,
      {
        target: "content",
        action: "getQuotedText",
      },
      (response) => {
        if (chrome.runtime.lastError) {
          sendResponse("");
          return;
        }
        sendResponse(response || "");
      },
    );
  },
);

onMessageListener.add("getImages", async (message, sender, sendResponse) => {
  let capture = null;
  let pageImages = [];
  try {
    capture = await captureVisibleTab();
  } catch (e) {}
  try {
    pageImages = await getImagesOnPage();
  } catch (e) {}
  const images = [capture].concat(pageImages).filter((_) => !!_);
  sendResponse(images);
});

onMessageListener.add("getPageTitle", async (message, sender, sendResponse) => {
  const title = await getPageTitle();
  sendResponse(title);
});

chrome.runtime.onMessage.addListener(
  onMessageListener.listen.bind(onMessageListener),
);
