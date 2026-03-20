import config from "./config";
import uploadGyazo from "./libs/uploadGyazo";
import uploadScrapboxFile from "./libs/uploadScrapboxFile";
import createScrapboxPage from "./libs/createScrapboxPage";
import MessageListener from "./libs/MessageListener";
import { request as getImagesOnPage } from "./libs/getImagesOnPage";
import { request as getPageTitle } from "./libs/getPageTitle";
import getActiveTab from "./libs/getActiveTab";

const openComposerInTab = () => {
  const url = chrome.runtime.getURL("/popup/popup.html");
  chrome.tabs.create({ url });
};

const openComposerFromAction = async () => {
  const browserApi =
    typeof globalThis !== "undefined" && globalThis.browser
      ? globalThis.browser
      : null;

  try {
    if (
      browserApi &&
      browserApi.sidebarAction &&
      browserApi.sidebarAction.open
    ) {
      await browserApi.sidebarAction.open();
      return;
    }
  } catch (e) {}

  try {
    if (chrome.sidebarAction && chrome.sidebarAction.open) {
      await new Promise((resolve, reject) => {
        chrome.sidebarAction.open(() => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
      return;
    }
  } catch (e) {}

  openComposerInTab();
};

const resolveMimeType = (srcUrl, contentType) => {
  if (contentType) return contentType.split(";")[0];
  if (/svg($|[?#])/i.test(srcUrl)) return "image/svg+xml";
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

const fetchImageSource = async (srcUrl) => {
  const response = await fetch(srcUrl);
  const buffer = await response.arrayBuffer();
  const mimeType = resolveMimeType(
    srcUrl,
    response.headers.get("content-type"),
  );
  return { buffer, mimeType };
};

const toDataUrl = (buffer, mimeType) => {
  return `data:${mimeType};base64,${toBase64(buffer)}`;
};

const isSvgImage = (imageUrl, mimeType = "") => {
  return (
    /^data:image\/svg\+xml/i.test(imageUrl) ||
    /^image\/svg\+xml/i.test(mimeType) ||
    /\.svg($|[?#])/i.test(imageUrl)
  );
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
    try {
      let { text, title, imageUrl, projectName } = message;
      const originalTitle = await getPageTitle();
      const tab = await getActiveTab();
      const body = [`[${originalTitle} ${tab.url}]`];
      if (imageUrl) {
        try {
          let responseURL;
          if (/^https?/.test(imageUrl)) {
            const imageSource = await fetchImageSource(imageUrl);
            if (isSvgImage(imageUrl, imageSource.mimeType)) {
              responseURL = await uploadScrapboxFile({
                projectName,
                sourceUrl: imageUrl,
                mimeType: imageSource.mimeType,
                arrayBuffer: imageSource.buffer,
              });
            } else {
              const gyazoImage = toDataUrl(
                imageSource.buffer,
                imageSource.mimeType,
              );
              responseURL = await uploadGyazo(gyazoImage, tab);
            }
          } else if (isSvgImage(imageUrl)) {
            responseURL = await uploadScrapboxFile({
              projectName,
              sourceUrl: imageUrl,
              mimeType: "image/svg+xml",
              dataUrl: imageUrl,
            });
          } else {
            responseURL = await uploadGyazo(imageUrl, tab);
          }
          body.push(`[${responseURL}]`);
        } catch (e) {
          sendResponse({
            ok: false,
            error:
              "画像のアップロードに失敗したため、ページは作成しませんでした。SVG画像の場合はScrapboxへのアップロードも試行しました。",
          });
          return;
        }
      }
      body.push(text);
      await createScrapboxPage({
        title,
        projectName,
        body: body.join("\n"),
      });
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({
        ok: false,
        error: "ページ作成に失敗しました。",
      });
    }
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

if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(() => {
    openComposerFromAction();
  });
}
