import assert from "node:assert/strict";
const base = "http://127.0.0.1:8787",
  origin = "http://localhost:5173";
let cookie = "";
async function request(path, { method = "GET", json, form, auth = true } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      Origin: origin,
      ...(json ? { "Content-Type": "application/json" } : {}),
      ...(auth && cookie ? { Cookie: cookie } : {}),
    },
    body: json ? JSON.stringify(json) : form,
  });
  return r;
}
const password = "a test password long enough",
  email = `test-${Date.now()}@example.invalid`;
let r = await request("/register", {
  method: "POST",
  json: { name: "Cloud tester", email, password, acceptedTerms: "on" },
});
assert.equal(r.status, 200, await r.clone().text());
cookie = r.headers.get("set-cookie").split(";")[0];
const user = (await r.json()).user;
assert.equal(user.name, "Cloud tester");
r = await request("/me");
assert.equal((await r.json()).user.id, user.id);
r = await request("/profile", {
  method: "PATCH",
  json: { name: "A different persona", bio: "A test bio." },
});
assert.equal((await r.json()).user.bio, "A test bio.");
const form = new FormData();
form.set(
  "media",
  new Blob(
    [
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5qoAAAAASUVORK5CYII=",
        "base64",
      ),
    ],
    { type: "image/png" },
  ),
  "test.png",
);
form.set("title", "Private until checked");
form.set("rights", "on");
r = await request("/uploads", { method: "POST", form });
assert.equal(r.status, 201, await r.clone().text());
const media = await r.json();
assert.equal(media.safety, "unavailable");
assert.equal(media.status, "pending");
r = await request("/media/" + media.id, { auth: false });
assert.equal(r.status, 404);
r = await request("/media/" + media.id);
assert.equal(r.status, 200);
assert.equal(r.headers.get("Content-Type"), "image/png");
r = await request("/feed");
assert.equal(
  (await r.json()).items.some((x) => x.id === media.id),
  false,
);
r = await fetch(base + "/cdn-cgi/local/scheduled");
assert.equal(r.status, 200);
r = await request("/feed");
assert.equal(
  (await r.json()).items.some((x) => x.id === media.id),
  false,
);
r = await request("/uploads");
assert.equal((await r.json()).items[0].status, "pending");
r = await request("/account/export");
assert.equal((await r.json()).user.email, email);
r = await request("/account", { method: "DELETE", json: { password } });
assert.equal(r.status, 200, await r.clone().text());
r = await request("/me");
assert.equal((await r.json()).user, null);
r = await request("/media/" + media.id);
assert.equal(r.status, 404);
console.log(
  "PASS real local D1/R2: registration, session, profile, private upload, failed-closed moderation, cron, export and deletion",
);
