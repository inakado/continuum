const apiUrl = process.env.API_URL || 'http://localhost:3000';
const origin = process.env.AUTH_SMOKE_ORIGIN || 'http://localhost:3001';
const username = process.env.AUTH_SMOKE_LOGIN || 'teacher1';
const password = process.env.AUTH_SMOKE_PASSWORD || 'Pass123!';
const protectedPath = process.env.AUTH_SMOKE_PROTECTED_PATH || '/teacher/me';

const expectStatus = async (response, expected, step) => {
  if (response.status !== expected) {
    const body = await response.text();
    throw new Error(`${step}: got ${response.status}, expected ${expected}; ${body.slice(0, 300)}`);
  }
  console.log(`OK   ${step} (${response.status})`);
};

const signIn = await fetch(`${apiUrl}/auth/sign-in/username`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin },
  body: JSON.stringify({ username, password }),
});
await expectStatus(signIn, 200, 'username sign-in');

const cookies = signIn.headers
  .getSetCookie()
  .map((value) => value.split(';', 1)[0])
  .join('; ');
if (!cookies) throw new Error('username sign-in: session cookie is missing');

const session = await fetch(`${apiUrl}/auth/get-session`, { headers: { cookie: cookies } });
await expectStatus(session, 200, 'session');

const protectedRoute = await fetch(`${apiUrl}${protectedPath}`, { headers: { cookie: cookies } });
await expectStatus(protectedRoute, 200, 'role-protected route');

const foreignSignOut = await fetch(`${apiUrl}/auth/sign-out`, {
  method: 'POST',
  headers: { cookie: cookies, origin: 'https://evil.example' },
});
await expectStatus(foreignSignOut, 403, 'foreign-origin sign-out');

const signOut = await fetch(`${apiUrl}/auth/sign-out`, {
  method: 'POST',
  headers: { cookie: cookies, origin },
});
await expectStatus(signOut, 200, 'sign-out');

const protectedAfterSignOut = await fetch(`${apiUrl}${protectedPath}`, {
  headers: { cookie: cookies },
});
await expectStatus(protectedAfterSignOut, 401, 'protected route after sign-out');

console.log('Better Auth smoke passed.');
