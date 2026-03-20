import config from "../config";
import getActiveTab from "../libs/getActiveTab";

const DRAFT_KEY_PREFIX = "popupDraft";
const selectElm = document.querySelector("#projectSelect");
const imageListDiv = document.querySelector("#imageList");
const statusMessageElm = document.querySelector("#statusMessage");
const dontUseImageCheckbox = document.querySelector("#dontUseImageCheckBox");
const titleElm = document.querySelector("#pageTitle");
const textElm = document.querySelector("#scrapboxText");
const formElm = document.querySelector("#converterForm");

let draftKey = "";
let restoredDraft = null;
let restoredTitle = false;
let restoredText = false;
let restoredProjectName = "";
let isComposing = false;
let userEditedTitle = false;
let userEditedText = false;

const showStatusMessage = (message) => {
  statusMessageElm.textContent = message || "";
};

const setImageListDisabled = (disabled) => {
  if (disabled) {
    imageListDiv.classList.add("disabled");
  } else {
    imageListDiv.classList.remove("disabled");
  }
};

const normalizePageUrl = (rawUrl) => {
  if (!rawUrl) return "";
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.toString();
  } catch (e) {
    return rawUrl;
  }
};

const buildDraftKey = (tab) => {
  if (!(tab && tab.id)) return "";
  return `${DRAFT_KEY_PREFIX}:${tab.id}:${normalizePageUrl(tab.url || "")}`;
};

const storageGet = (key) =>
  new Promise((resolve) => {
    chrome.storage.local.get(key, (items) => {
      if (chrome.runtime.lastError) {
        resolve({});
        return;
      }
      resolve(items || {});
    });
  });

const storageSet = (items) =>
  new Promise((resolve) => {
    chrome.storage.local.set(items, () => {
      resolve();
    });
  });

const storageRemove = (key) =>
  new Promise((resolve) => {
    if (!key) {
      resolve();
      return;
    }
    chrome.storage.local.remove(key, () => resolve());
  });

const getSelectedImageUrl = () => {
  const selectedImageElm = imageListDiv.querySelector(".selected");
  if (!selectedImageElm || dontUseImageCheckbox.checked) return null;
  return selectedImageElm.src;
};

const collectDraft = () => {
  return {
    projectName: selectElm.value || "",
    imageUrl: getSelectedImageUrl() || "",
    text: textElm.value || "",
    title: titleElm.value || "",
    dontUseImage: !!dontUseImageCheckbox.checked,
  };
};

const saveDraft = async () => {
  if (!draftKey) return;
  await storageSet({ [draftKey]: collectDraft() });
};

const selectImageByUrl = (imageUrl) => {
  const images = Array.from(imageListDiv.querySelectorAll("img"));
  if (images.length === 0) return;

  const selected =
    (imageUrl && images.find((img) => img.src === imageUrl)) || images[0];
  if (!selected) return;

  const current = imageListDiv.querySelector(".selected");
  if (current) current.classList.remove("selected");
  selected.classList.add("selected");
};

const submitCreatePage = () => {
  showStatusMessage("");

  chrome.runtime.sendMessage(
    chrome.runtime.id,
    {
      target: "main",
      action: "createScrapboxPage",
      projectName: selectElm.value,
      imageUrl: getSelectedImageUrl(),
      text: textElm.value,
      title: titleElm.value,
    },
    (result) => {
      if (chrome.runtime.lastError) {
        showStatusMessage("ページ作成に失敗しました。");
        return;
      }
      if (result && result.ok) {
        storageRemove(draftKey);
        window.close();
        return;
      }
      showStatusMessage(
        (result && result.error) ||
          "画像のアップロードに失敗したため、ページは作成されませんでした。",
      );
    },
  );
};

formElm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (isComposing) return;
  submitCreatePage();
});

formElm.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.isComposing || isComposing)) {
    e.preventDefault();
    e.stopPropagation();
  }
});

dontUseImageCheckbox.addEventListener("change", (e) => {
  setImageListDisabled(e.target.checked);
  saveDraft();
});

titleElm.addEventListener("compositionstart", () => {
  isComposing = true;
});
titleElm.addEventListener("compositionend", () => {
  isComposing = false;
});
textElm.addEventListener("compositionstart", () => {
  isComposing = true;
});
textElm.addEventListener("compositionend", () => {
  isComposing = false;
});

titleElm.addEventListener("input", () => {
  userEditedTitle = true;
  saveDraft();
});
textElm.addEventListener("input", () => {
  userEditedText = true;
  saveDraft();
});
selectElm.addEventListener("change", saveDraft);

const initDraft = async () => {
  const activeTab = await getActiveTab();
  draftKey = buildDraftKey(activeTab);
  if (!draftKey) return;

  const draftMap = await storageGet(draftKey);
  const draft = draftMap[draftKey];
  if (!draft || typeof draft !== "object") return;

  restoredDraft = draft;
  restoredProjectName = draft.projectName || "";
  if (typeof draft.dontUseImage === "boolean") {
    dontUseImageCheckbox.checked = draft.dontUseImage;
    setImageListDisabled(draft.dontUseImage);
  }
  if (draft.title) {
    titleElm.value = draft.title;
    restoredTitle = true;
  }
  if (draft.text) {
    textElm.value = draft.text;
    restoredText = true;
  }
};

const fetchQuotedText = () => {
  chrome.runtime.sendMessage(
    chrome.runtime.id,
    {
      target: "main",
      action: "getQuotedText",
    },
    (text) => {
      if (!userEditedText && (!restoredText || !textElm.value)) {
        textElm.value = text || "";
      }
      saveDraft();
    },
  );
};

const fetchPageTitle = () => {
  chrome.runtime.sendMessage(
    chrome.runtime.id,
    {
      target: "main",
      action: "getPageTitle",
    },
    (title) => {
      if (!userEditedTitle && (!restoredTitle || !titleElm.value)) {
        titleElm.value = title || "";
      }
      saveDraft();
    },
  );
};

const fetchImages = () => {
  chrome.runtime.sendMessage(
    chrome.runtime.id,
    {
      target: "main",
      action: "getImages",
    },
    (images) => {
      (images || []).forEach((imageUrl) => {
        const imageElm = document.createElement("img");
        imageElm.src = imageUrl;
        imageListDiv.appendChild(imageElm);
        imageElm.addEventListener("click", (e) => {
          const next = e.target;
          if (next.classList.contains("selected")) return;
          const current = imageListDiv.querySelector(".selected");
          if (current) current.classList.remove("selected");
          next.classList.add("selected");
          saveDraft();
        });
      });

      if (restoredDraft && restoredDraft.imageUrl) {
        selectImageByUrl(restoredDraft.imageUrl);
      } else {
        selectImageByUrl("");
      }
      saveDraft();
    },
  );
};

const fetchProjects = () => {
  chrome.runtime.sendMessage(
    chrome.runtime.id,
    {
      target: "main",
      action: "fetchApi",
      apiType: "getProjects",
    },
    async (res) => {
      const projects = (res && res.projects) || [];
      projects.forEach((project) => {
        const optionElm = document.createElement("option");
        optionElm.value = project.name;
        optionElm.textContent = project.displayName;
        selectElm.appendChild(optionElm);
      });

      if (
        restoredProjectName &&
        projects.some((project) => project.name === restoredProjectName)
      ) {
        selectElm.value = restoredProjectName;
      } else {
        const defaultProjectName = await config.projectName();
        selectElm.value = defaultProjectName || (projects[0] && projects[0].name) || "";
      }
      saveDraft();
    },
  );
};

const init = async () => {
  await initDraft();
  fetchQuotedText();
  fetchPageTitle();
  fetchImages();
  fetchProjects();
};

init();
