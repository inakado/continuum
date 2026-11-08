import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export function parseTeachers(text) {
  let rows;
  try { rows = JSON.parse(text); } catch { throw Error('Expected a JSON array of initial teachers'); }
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 10) throw Error('Expected 1–10 initial teachers');
  const seen = new Set();
  return rows.map(row => {
    if (!row || typeof row !== 'object' || typeof row.login !== 'string' || !/^[a-z0-9._-]{3,64}$/.test(row.login) || seen.has(row.login)) throw Error('Invalid/duplicate teacher login');
    if (typeof row.password !== 'string' || row.password.length < 16 || row.password.length > 128 || /\s/.test(row.password)) throw Error('Initial passwords must contain 16–128 non-whitespace characters');
    seen.add(row.login);
    return { login: row.login, password: row.password, firstName: row.login, lastName: '', middleName: null };
  });
}

export async function bootstrapTeachers(db, identity, rows) {
  const other = await db.user.count({ where: { login: { notIn: rows.map(row => row.login) } } });
  if (other) throw Error('Bootstrap refuses a database containing other users');
  for (const row of rows) {
    const existing = await db.user.findUnique({ where: { login: row.login }, include: { teacherProfile: true } });
    if (existing) {
      if (existing.role !== 'teacher' || !existing.teacherProfile || !await identity.verifyPassword(existing.id, row.password)) throw Error('Existing teacher does not match bootstrap credentials/profile');
    } else {
      await identity.createTeacher(row);
    }
  }
  console.log(`Initial teachers ready: ${rows.map(row => row.login).join(', ')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const require = createRequire(import.meta.url);
  const { PrismaService } = require('../dist/prisma/prisma.service.js');
  const { IdentityProvisioningService } = require('../dist/auth/identity-provisioning.service.js');
  const db = new PrismaService();
  try {
    await bootstrapTeachers(db, new IdentityProvisioningService(db), parseTeachers(readFileSync(0, 'utf8')));
  } catch (error) {
    console.error('Teacher bootstrap failed:', error?.code || error?.name || 'Error');
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
