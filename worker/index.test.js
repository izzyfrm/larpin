import { test } from "node:test";
import assert from "node:assert/strict";
import worker, {
  eligible,
  sniffMedia,
  passwordHash,
  moderateVideo,
} from "./index.js";
test("review hold cannot publish early, failed, missing or manual-required checks", () => {
  const now = 1000000;
  assert.equal(
    eligible(
      { status: "pending", safety: "passed", created_at: now - 119999 },
      now,
    ),
    false,
  );
  assert.equal(
    eligible(
      { status: "pending", safety: "passed", created_at: now - 120000 },
      now,
    ),
    true,
  );
  for (const safety of [
    "failed",
    "unavailable",
    "unchecked",
    "manual_required",
  ])
    assert.equal(
      eligible({ status: "pending", safety, created_at: 0 }, now),
      false,
    );
  assert.equal(
    eligible({ status: "rejected", safety: "passed", created_at: 0 }, now),
    false,
  );
});
test("recognizes media signatures and rejects disguised HTML/SVG", () => {
  assert.equal(sniffMedia(new Uint8Array([255, 216, 255, 0])), "image/jpeg");
  assert.equal(
    sniffMedia(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])),
    "image/png",
  );
  assert.equal(
    sniffMedia(new TextEncoder().encode("RIFF0000WEBP")),
    "image/webp",
  );
  assert.equal(
    sniffMedia(new TextEncoder().encode("0000ftypmp42")),
    "video/mp4",
  );
  for (const s of [
    "<html>bad</html>",
    '<svg onload="alert(1)"></svg>',
    "not an image",
  ])
    assert.equal(sniffMedia(new TextEncoder().encode(s)), null);
});
test("password hashing is deterministic, salted and not plaintext", async () => {
  const salt = "0123456789abcdef0123456789abcdef";
  const a = await passwordHash("correct horse battery staple", salt);
  assert.equal(a.length, 64);
  assert.equal(a, await passwordHash("correct horse battery staple", salt));
  assert.notEqual(
    a,
    await passwordHash(
      "correct horse battery staple",
      "abcdef0123456789abcdef0123456789",
    ),
  );
});
test("CORS blocks unrelated origins and accepts configured preflight", async () => {
  const env = { SITE_ORIGIN: "https://larpin.example" };
  const denied = await worker.fetch(
    new Request("https://api.example/health", {
      headers: { Origin: "https://evil.example" },
    }),
    env,
  );
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("Access-Control-Allow-Origin"), null);
  const ok = await worker.fetch(
    new Request("https://api.example/health", {
      headers: { Origin: env.SITE_ORIGIN },
    }),
    env,
  );
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).ok, true);
  const preflight = await worker.fetch(
    new Request("https://api.example/uploads", {
      method: "OPTIONS",
      headers: { Origin: env.SITE_ORIGIN },
    }),
    env,
  );
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("Access-Control-Allow-Credentials"),
    "true",
  );
});
test("missing operator contact keeps registration closed", async () => {
  const r = await worker.fetch(
    new Request("https://api.example/register", {
      method: "POST",
      headers: {
        Origin: "https://larpin.example",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
    { SITE_ORIGIN: "https://larpin.example" },
  );
  assert.equal(r.status, 503);
});
test("video provider is conservative and receives the complete video, not an image sample", async () => {
  const categories = Object.fromEntries(
    [
      "sexual",
      "sexualMinors",
      "graphicViolence",
      "hate",
      "harassment",
      "selfHarm",
      "dangerousActs",
      "adultThemes",
      "privateInformation",
    ].map((x) => [x, false]),
  );
  const env = { VIDEO_MODERATION_API_KEY: "test-only" },
    bytes = new TextEncoder().encode("complete test video");
  const send = async (url, options) => {
    assert.match(url, /generativelanguage.googleapis.com/);
    const request = JSON.parse(options.body);
    assert.equal(request.contents[0].parts[0].inlineData.mimeType, "video/mp4");
    assert.equal(
      atob(request.contents[0].parts[0].inlineData.data),
      "complete test video",
    );
    return Response.json({
      candidates: [
        {
          finishReason: "STOP",
          content: {
            parts: [
              { text: JSON.stringify({ reviewedVideo: true, categories }) },
            ],
          },
        },
      ],
    });
  };
  assert.equal(await moderateVideo(env, bytes, "video/mp4", send), "passed");
  categories.sexual = true;
  assert.equal(await moderateVideo(env, bytes, "video/mp4", send), "failed");
  assert.equal(
    await moderateVideo({}, bytes, "video/mp4", send),
    "manual_required",
  );
  assert.equal(
    await moderateVideo(
      env,
      bytes,
      "video/mp4",
      async () => new Response("", { status: 429 }),
    ),
    "unavailable",
  );
  assert.equal(
    await moderateVideo(env, bytes, "video/mp4", async () =>
      Response.json({ candidates: [{ finishReason: "SAFETY" }] }),
    ),
    "failed",
  );
  assert.equal(
    await moderateVideo(env, bytes, "video/mp4", async () =>
      Response.json({
        candidates: [
          {
            finishReason: "STOP",
            content: {
              parts: [{ text: '{"reviewedVideo":true,"categories":{}}' }],
            },
          },
        ],
      }),
    ),
    "unavailable",
  );
});
