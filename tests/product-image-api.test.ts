import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { uploadProductImage } from "../service/productImageService";

test("image upload sends multipart bytes to BE and preserves the file on one token renewal", async () => {
  const seen: Array<{ path: string; type: string; auth: string; body: string }> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    seen.push({ path: request.url ?? "", type: request.headers["content-type"] ?? "", auth: request.headers.authorization ?? "", body: Buffer.concat(chunks).toString() });
    response.setHeader("Content-Type", "application/json");
    if (seen.length === 1) {
      response.writeHead(401).end(JSON.stringify({ title: "Expired token", status: 401 }));
      return;
    }
    response.writeHead(201).end(JSON.stringify({ code: 0, message: "response success", data: { id: "photo-id", imageUrl: "https://storage.example/photo.png", sortOrder: 0 } }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  let token = "old-token";
  try {
    const result = await uploadProductImage("product-id", new File(["PNG payload for HTTP verification"], "photo.png", { type: "image/png" }), {
      context: {
        baseUrl: `http://127.0.0.1:${address.port}`,
        getAccessToken: () => token,
        getSessionId: () => 1,
        renewAccessToken: async () => { token = "new-token"; return token; },
      },
    });
    assert.equal(result.id, "photo-id");
    assert.equal(seen.length, 2);
    assert.deepEqual(seen.map((request) => request.auth), ["Bearer old-token", "Bearer new-token"]);
    for (const request of seen) {
      assert.equal(request.path, "/api/v1/products/product-id/images");
      assert.match(request.type, /^multipart\/form-data; boundary=/);
      assert.match(request.body, /name="file"; filename="photo.png"/);
      assert.match(request.body, /Content-Type: image\/png/i);
      assert.match(request.body, /PNG payload for HTTP verification/);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
});
