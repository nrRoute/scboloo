const SCRAPBOX_ORIGIN = "https://scrapbox.io";

const SVG_MIME_TYPE = "image/svg+xml";

const asUint8ArrayFromDataUrl = (dataUrl) => {
  const [meta, body] = dataUrl.split(",", 2);
  const isBase64 = /;base64/i.test(meta || "");
  if (isBase64) {
    const bin = atob(body || "");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  const decoded = decodeURIComponent(body || "");
  return new TextEncoder().encode(decoded);
};

const extensionFromMime = (mimeType) => {
  if (/svg/i.test(mimeType)) return "svg";
  if (/png/i.test(mimeType)) return "png";
  if (/jpe?g/i.test(mimeType)) return "jpg";
  if (/gif/i.test(mimeType)) return "gif";
  return "bin";
};

const fileNameFromUrl = (sourceUrl) => {
  if (!sourceUrl || !/^https?:/i.test(sourceUrl)) return "";
  try {
    const pathname = new URL(sourceUrl).pathname;
    const base = decodeURIComponent(pathname.split("/").pop() || "");
    return base.replace(/[\\/:*?"<>|]/g, "_");
  } catch (e) {
    return "";
  }
};

const buildFileName = ({ sourceUrl, mimeType }) => {
  const fromUrl = fileNameFromUrl(sourceUrl);
  if (fromUrl) {
    if (/\.[a-z0-9]+$/i.test(fromUrl)) return fromUrl;
    return `${fromUrl}.${extensionFromMime(mimeType)}`;
  }
  return `scboloo-upload.${extensionFromMime(mimeType)}`;
};

const extractFileUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/https:\/\/scrapbox\.io\/files\/[^\s"'`]+/);
    return match ? match[0] : "";
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = extractFileUrl(item);
      if (url) return url;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const v of Object.values(value)) {
      const url = extractFileUrl(v);
      if (url) return url;
    }
  }
  return "";
};

const parseUploadResponse = async (response) => {
  if (response.redirected && /https:\/\/scrapbox\.io\/files\//.test(response.url)) {
    return response.url;
  }

  const text = await response.text();
  const urlFromText = extractFileUrl(text);
  if (urlFromText) return urlFromText;

  try {
    const json = JSON.parse(text);
    return extractFileUrl(json);
  } catch (e) {
    return "";
  }
};

const uploadToEndpoint = async ({ endpoint, blob, fileName, projectName }) => {
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("project", projectName);
  formData.append("projectName", projectName);

  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    mode: "cors",
    body: formData,
  });

  if (!response.ok) return "";
  return await parseUploadResponse(response);
};

const endpointCandidates = (projectName) => {
  const p = encodeURIComponent(projectName);
  return [
    `${SCRAPBOX_ORIGIN}/api/upload/${p}`,
    `${SCRAPBOX_ORIGIN}/api/upload/${p}/file`,
    `${SCRAPBOX_ORIGIN}/api/upload?project=${p}`,
    `${SCRAPBOX_ORIGIN}/api/pages/${p}/upload`,
    `${SCRAPBOX_ORIGIN}/api/page/${p}/upload`,
  ];
};

export default async ({ projectName, sourceUrl, mimeType, dataUrl, arrayBuffer }) => {
  if (!projectName) throw new Error("projectName is required");

  const normalizedMimeType = mimeType || SVG_MIME_TYPE;
  const bytes =
    arrayBuffer instanceof ArrayBuffer
      ? new Uint8Array(arrayBuffer)
      : asUint8ArrayFromDataUrl(dataUrl || "");
  const blob = new Blob([bytes], { type: normalizedMimeType });
  const fileName = buildFileName({ sourceUrl, mimeType: normalizedMimeType });

  for (const endpoint of endpointCandidates(projectName)) {
    try {
      const uploadedUrl = await uploadToEndpoint({
        endpoint,
        blob,
        fileName,
        projectName,
      });
      if (uploadedUrl) return uploadedUrl;
    } catch (e) {}
  }

  throw new Error("failed to upload file to scrapbox");
};
