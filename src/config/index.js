const DEFAULT_HOST = "https://scrapbox.io";
const ApiEndpoints = {
  getProjects: "/api/projects",
};

const storageGet = (key) =>
  new Promise((resolve) => {
    chrome.storage.sync.get(key, (items) => {
      if (chrome.runtime.lastError) {
        resolve({});
        return;
      }
      resolve(items || {});
    });
  });

const storageSet = (items) =>
  new Promise((resolve) => {
    chrome.storage.sync.set(items, () => {
      if (chrome.runtime.lastError) {
        resolve(items);
        return;
      }
      resolve(items);
    });
  });

export default {
  get apiEndpoints() {
    return ApiEndpoints;
  },
  get apiHost() {
    return DEFAULT_HOST;
  },
  async projectName(name) {
    if (!name) return (await storageGet("projectName")).projectName;
    await storageSet({ projectName: name });
    return name;
  },
  getApiUrl(name) {
    return this.apiHost + this.apiEndpoints[name];
  },
};
