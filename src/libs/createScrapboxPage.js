export default async ({title, body, projectName}) => {
  const projectUrl = 'https://scrapbox.io/' + projectName
  chrome.tabs.create({
    url: projectUrl + '/' + encodeURIComponent(title) + '?body=' + encodeURIComponent(body)
  })
}
