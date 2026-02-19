const results = [];

const check = async (name, url, options = {}) => {
  const { validate, ...fetchOptions } = options;
  try {
    const res = await fetch(url, fetchOptions);
    const text = await res.text();
    const ok = typeof validate === "function" ? Boolean(validate(res, text)) : res.ok;
    results.push({ name, ok, status: res.status, body: text.slice(0, 300) });
  } catch (error) {
    results.push({ name, ok: false, status: "ERR", body: String(error) });
  }
};

await check("api:health", "http://localhost:3000/health");
await check("api:ready", "http://localhost:3000/ready");
await check("api:enqueue", "http://localhost:3000/debug/enqueue-ping", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ from: "smoke" }),
});
await check("web:login", "http://localhost:3001/login", {
  validate: (res) => {
    const contentType = res.headers.get("content-type") || "";
    return res.status !== 404 && contentType.includes("text/html");
  },
});

for (const item of results) {
  const status = item.ok ? "OK" : "FAIL";
  console.log(`${status} ${item.name} (${item.status})`);
  if (!item.ok) {
    console.log(`  ${item.body}`);
  }
}

const failed = results.some((item) => !item.ok);
if (failed) {
  process.exit(1);
}
