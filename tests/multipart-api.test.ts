import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { requestApi } from "../configs/api";

test("multipart sends file bytes and a matching boundary through the shared HTTP client, including a single auth replay", async () => {
  const requests: { type: string; body: Buffer; authorization?: string }[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({ type: request.headers["content-type"] ?? "", body: Buffer.concat(chunks), authorization: request.headers.authorization });
    response.setHeader("Content-Type", "application/json");
    response.statusCode = requests.length === 1 ? 401 : 201;
    response.end(JSON.stringify(requests.length === 1 ? { title: "Unauthorized" } : { code: 0, message: "response success", data: { id: "image" } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    let token = "test-before-renewal";
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 1]);
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "image/png" }), "sample.png");
    const result = await requestApi<{ id: string }>("POST", "/api/v1/products/product/images", form, {
      context: { baseUrl: `http://127.0.0.1:${address.port}`, getAccessToken: () => token,
        getSessionId: () => 7, renewAccessToken: async () => { token = "test-after-renewal"; return token; } },
      config: { headers: { "Content-Type": "application/json", Authorization: "untrusted" } },
    });
    assert.equal(result.data.id, "image");
    assert.equal(requests.length, 2);
    for (const [index, request] of requests.entries()) {
      const boundary = /boundary=([^;]+)/.exec(request.type)?.[1];
      assert.ok(boundary, "transport supplies a multipart boundary");
      assert.match(request.type, /^multipart\/form-data;/);
      assert.ok(request.body.includes(Buffer.from(`--${boundary}`)));
      assert.ok(request.body.includes(Buffer.from('name="file"; filename="sample.png"')));
      assert.ok(request.body.includes(Buffer.from(bytes)), "binary bytes survive both requests");
      assert.equal(request.authorization, index === 0 ? "Bearer test-before-renewal" : "Bearer test-after-renewal");
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
