export default async () => {
  const tabs = await new Promise((resolve) => {
    chrome.tabs.query({currentWindow: true, active: true}, (result) => {
      if (chrome.runtime.lastError) {
        resolve([])
        return
      }
      resolve(result || [])
    })
  })
  return tabs[0]
}
