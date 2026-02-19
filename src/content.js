import MessageListener from "./libs/MessageListener";
import { response as getImagesOnPage } from "./libs/getImagesOnPage";
import { response as getPageTitle } from "./libs/getPageTitle";

const onMessageListener = new MessageListener("content");

onMessageListener.add("getImages", async (message, sender, sendResponse) => {
  sendResponse(getImagesOnPage());
});

onMessageListener.add("getPageTitle", async (message, sender, sendResponse) => {
  sendResponse(getPageTitle());
});

onMessageListener.add(
  "getQuotedText",
  async (message, sender, sendResponse) => {
    const text = window.getSelection().toString() || "";
    sendResponse(text ? `> ${text}` : "");
  },
);

chrome.runtime.onMessage.addListener(
  onMessageListener.listen.bind(onMessageListener),
);
