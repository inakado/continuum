import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const args = process.argv.slice(2);
const getArg = (key) => {
  const name = `--${key}`;
  const inline = args.find((value) => value.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const resolveDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD || '';
  if (!host || !database || !user) return '';
  const auth = password ? `:${encodeURIComponent(password)}` : '';
  return `postgresql://${encodeURIComponent(user)}${auth}@${host}:${port}/${database}`;
};

const login = (getArg('login') || process.env.ADMIN_LOGIN || '').trim().toLowerCase();
const password = getArg('password') || process.env.ADMIN_PASSWORD || '';
const name = (getArg('name') || process.env.ADMIN_NAME || login).trim();

if (!/^[a-z0-9._-]{3,64}$/.test(login)) {
  throw new Error('Admin login must be 3-64 characters and contain only a-z, 0-9, dot, underscore or hyphen.');
}
if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
  throw new Error('Admin password must be at least 8 characters and contain letters and digits.');
}

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) throw new Error('DATABASE_URL or POSTGRES_* env vars must be set.');

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

try {
  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    if (existing.role !== Role.admin) {
      throw new Error(`Login ${login} already belongs to a non-admin user.`);
    }
    console.log(`Admin ${login} already exists.`);
    process.exitCode = 0;
  } else {
    const adminCount = await prisma.user.count({ where: { role: Role.admin } });
    if (adminCount > 0) {
      throw new Error('An admin already exists. Bootstrap can only create the first admin.');
    }

    const passwordHash = await argon2.hash(password);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          login,
          displayLogin: login,
          email: `${login}@users.continuum.invalid`,
          name: name || login,
          role: Role.admin,
          isActive: true,
        },
        select: { id: true },
      });
      await tx.account.create({
        data: {
          accountId: user.id,
          providerId: 'credential',
          userId: user.id,
          password: passwordHash,
        },
      });
    });
    console.log(`Created admin ${login}.`);
  }
} finally {
  await prisma.$disconnect();
}
