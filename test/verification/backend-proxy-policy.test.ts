/** Regression tests for the documents same-origin BFF policy. */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBackendUrl,
  encodePathSegment,
  getPathParam,
  isSameOriginMutation,
  redactRefreshTokens,
  rewriteEditorImageUrls,
} from "../../src/lib/server/backend-proxy-policy.ts";

test("forwards only operation-specific query parameters", () => {
  const target = buildBackendUrl(
    "http://localhost:3005/api/v1",
    "/documents",
    new URL(
      "http://localhost:4002/api/v1/documents?page=2&upstream=https://evil.test",
    ),
    ["page"],
    false,
  );

  assert.equal(
    target.toString(),
    "http://localhost:3005/api/v1/documents?page=2",
  );
});

test("rejects unsafe paths and plaintext production upstreams", () => {
  const requestUrl = new URL("https://documents.example.test/api/v1/documents");
  assert.throws(() =>
    buildBackendUrl(
      "https://api.example.test/api/v1",
      "/../private",
      requestUrl,
      [],
      true,
    ),
  );
  assert.throws(() =>
    buildBackendUrl(
      "http://api.example.test/api/v1",
      "/documents",
      requestUrl,
      [],
      true,
    ),
  );
});

test("requires same-origin evidence for mutations", () => {
  const requestUrl = new URL("https://documents.example.test/api/v1/documents");
  assert.equal(
    isSameOriginMutation(
      requestUrl,
      "https://documents.example.test",
      "same-origin",
    ),
    true,
  );
  assert.equal(
    isSameOriginMutation(requestUrl, "https://evil.test", "cross-site"),
    false,
  );
  assert.equal(isSameOriginMutation(requestUrl, null, null), false);
});

test("validates document ids invitation tokens and version segments", () => {
  assert.equal(encodePathSegment("document 1"), "document%201");
  assert.equal(getPathParam({ versionNumber: "12" }, "versionNumber"), "12");
  assert.throws(() => encodePathSegment("../private"));
  assert.throws(() => getPathParam({ token: ["one", "two"] }, "token"));
});

test("redacts refresh credentials from nested login responses", () => {
  assert.deepEqual(
    redactRefreshTokens({
      data: { accessToken: "access", refreshToken: "refresh" },
    }),
    { data: { accessToken: "access", refreshToken: "" } },
  );
});

test("rewrites only Gracon editor image render URLs to same-origin paths", () => {
  assert.deepEqual(
    rewriteEditorImageUrls({
      content: {
        src: "http://localhost:3005/api/v1/editor-images/render/signed-token",
        external: "https://images.example.test/photo.png",
      },
    }),
    {
      content: {
        src: "/api/v1/editor-images/render/signed-token",
        external: "https://images.example.test/photo.png",
      },
    },
  );
});
