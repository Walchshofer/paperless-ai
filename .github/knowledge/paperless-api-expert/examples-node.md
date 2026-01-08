# Examples (Node.js / axios)

## Client setup
```js
import axios from "axios";

export function createPaperlessClient({ baseUrl, token, apiVersion }) {
  if (!baseUrl.endsWith("/api/")) throw new Error("Base URL must end with /api/");
  if (baseUrl.includes("/api/api/")) throw new Error("Base URL must not contain /api/api/");

  return axios.create({
    baseURL: baseUrl,
    headers: {
      Authorization: `Token ${token}`,
      Accept: `application/json; version=${apiVersion}`,
    },
    timeout: 30000,
  });
}
```

## List documents with pagination
```js
export async function listAllDocuments(client, params = {}) {
  let url = "documents/";
  const out = [];
  while (url) {
    const res = await client.get(url, { params: Object.assign({ page_size: 25 }, params) });
    out = out.concat(res.data?.results ?? []);
    url = res.data?.next ? res.data.next.replace(client.defaults.baseURL, "") : null;
  }
  return out;
}
```

## Upload document (multipart)
```js
import FormData from "form-data";
import fs from "node:fs";

export async function uploadDocument(client, filePath, meta = {}) {
  const form = new FormData();
  form.append("document", fs.createReadStream(filePath));
  if (meta.title) form.append("title", meta.title);
  if (meta.created) form.append("created", meta.created);
  if (meta.correspondent) form.append("correspondent", String(meta.correspondent));
  if (meta.document_type) form.append("document_type", String(meta.document_type));
  if (meta.storage_path) form.append("storage_path", String(meta.storage_path));
  if (Array.isArray(meta.tags)) meta.tags.forEach(t => form.append("tags", String(t)));

  const res = await client.post("documents/post_document/", form, {
    headers: Object.assign({}, form.getHeaders()),
  });
  return res.data; // typically { task_id: "a1b2c3d4-e5f6-7890-1234-567890abcdef" }
}
```

## Bulk edit (one call)
```js
export async function bulkEdit(client, documentIds, method, parameters = {}) {
  const payload = { documents: documentIds, method, parameters };
  const res = await client.post("documents/bulk_edit/", payload);
  return res.data; // inspect data.details[]
}
```

## Download binary
```js
export async function downloadDocument(client, docId) {
  const res = await client.get(`documents/${docId}/download/`, { responseType: "arraybuffer" });
  return res.data;
}
```