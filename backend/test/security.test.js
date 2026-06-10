const assert = require("node:assert/strict");
const http = require("node:http");
const test = require("node:test");

const createRateLimiter = require("../middleware/rateLimit");
const { buildCorsOptions, securityHeaders } = require("../middleware/security");
const { getAuditAction, getAuditModule, sanitizeAuditValue } = require("../utils/audit");
const requirePermission = require("../middleware/requirePermission");

test("CORS accepts the configured frontend and rejects unknown origins", () => {
  const previousFrontendUrl = process.env.FRONTEND_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.FRONTEND_URL = "https://app.example.com/";
  process.env.NODE_ENV = "production";

  const options = buildCorsOptions();
  options.origin("https://app.example.com", (error, allowed) => {
    assert.equal(error, null);
    assert.equal(allowed, true);
  });
  options.origin("https://evil.example.com", (error) => {
    assert.equal(error.status, 403);
  });

  if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
  else process.env.FRONTEND_URL = previousFrontendUrl;

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
});

test("security headers deny framing and MIME sniffing", () => {
  const headers = {};
  const response = { setHeader: (name, value) => { headers[name] = value; } };
  let continued = false;

  securityHeaders({}, response, () => { continued = true; });

  assert.equal(continued, true);
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.match(headers["Content-Security-Policy"], /default-src 'none'/);
});

test("rate limiter blocks requests after the configured maximum", () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2, message: "Bloqueado" });
  const request = { ip: "127.0.0.1" };
  const response = {
    headers: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let calls = 0;

  limiter(request, response, () => { calls += 1; });
  limiter(request, response, () => { calls += 1; });
  limiter(request, response, () => { calls += 1; });

  assert.equal(calls, 2);
  assert.equal(response.statusCode, 429);
  assert.equal(response.body.msg, "Bloqueado");
});

test("public registration is unavailable and API responses include security headers", async () => {
  const app = require("../app");
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-powered-by"), null);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("audit data removes secrets and classifies requests", () => {
  const sanitized = sanitizeAuditValue({
    email: "admin@example.com",
    password: "hidden",
    nested: { token: "hidden", status: "active" },
  });

  assert.deepEqual(sanitized, {
    email: "admin@example.com",
    nested: { status: "active" },
  });
  assert.equal(getAuditAction("POST"), "create");
  assert.equal(getAuditAction("DELETE"), "delete");
  assert.equal(getAuditModule("/api/incidents/123/status"), "incidents");
});

test("audit access requires AUDIT_VIEW instead of SETTINGS_MANAGE", () => {
  const middleware = requirePermission("AUDIT_VIEW");
  const buildResponse = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  });

  const settingsResponse = buildResponse();
  middleware(
    { user: { permissions: ["SETTINGS_MANAGE"] } },
    settingsResponse,
    () => assert.fail("SETTINGS_MANAGE must not grant audit access")
  );
  assert.equal(settingsResponse.statusCode, 403);

  const auditResponse = buildResponse();
  let continued = false;
  middleware(
    { user: { permissions: ["AUDIT_VIEW"] } },
    auditResponse,
    () => { continued = true; }
  );
  assert.equal(continued, true);
});
