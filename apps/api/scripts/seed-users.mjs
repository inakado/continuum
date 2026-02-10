import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const args = process.argv.slice(2);
const getArg = (key) => {
  const long = `--${key}`;
  const inline = args.find((arg) => arg.startsWith(`${long}=`));
  if (inline) return inline.slice(long.length + 1);
  const idx = args.indexOf(long);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return undefined;
};

const resolveDatabaseUrl = () => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD || '';

  if (!host || !database || !user) {
    return '';
  }

  const auth = password ? `:${encodeURIComponent(password)}` : '';
  return `postgresql://${encodeURIComponent(user)}${auth}@${host}:${port}/${database}`;
};

const teacherLogin = getArg('teacher-login') || process.env.TEACHER_LOGIN;
const teacherPassword = getArg('teacher-password') || process.env.TEACHER_PASSWORD;
const studentLogin = getArg('student-login') || process.env.STUDENT_LOGIN;
const studentPassword = getArg('student-password') || process.env.STUDENT_PASSWORD;

if (!teacherLogin || !teacherPassword || !studentLogin || !studentPassword) {
  console.error('Missing credentials. Provide via args or env vars.');
  console.error('Example:');
  console.error(
    '  node apps/api/scripts/seed-users.mjs --teacher-login=teacher1 --teacher-password=Pass123! --student-login=student1 --student-password=Pass123!',
  );
  process.exit(1);
}

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  console.error('DATABASE_URL or POSTGRES_* env vars must be set.');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const ensureUser = async ({ login, password, role }) => {
  const existing = await prisma.user.findUnique({ where: { login } });
  if (existing) {
    console.log(`User ${login} already exists, skipping.`);
    return existing;
  }
  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: {
      login,
      passwordHash,
      role,
      isActive: true,
    },
  });
  console.log(`Created ${role} ${login}`);
  return user;
};

const ensureStudentProfile = async ({ studentId, leadTeacherId }) => {
  const existing = await prisma.studentProfile.findUnique({ where: { userId: studentId } });
  if (existing) {
    console.log(`StudentProfile for ${studentId} already exists, skipping.`);
    return existing;
  }
  const profile = await prisma.studentProfile.create({
    data: {
      userId: studentId,
      leadTeacherId,
      displayName: null,
      firstName: null,
      lastName: null,
    },
  });
  console.log(`Created StudentProfile for ${studentId}`);
  return profile;
};

try {
  const teacher = await ensureUser({
    login: teacherLogin,
    password: teacherPassword,
    role: Role.teacher,
  });
  const student = await ensureUser({
    login: studentLogin,
    password: studentPassword,
    role: Role.student,
  });
  await ensureStudentProfile({ studentId: student.id, leadTeacherId: teacher.id });
} finally {
  await prisma.$disconnect();
}
