#!/usr/bin/env node
const fs = require('node:fs');

if (process.env.BACKEND_BUILD_IN_DOCKER === '1') {
  process.exit(0);
}

const inDockerenv = fs.existsSync('/.dockerenv');
let cgroup = '';
try {
  cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
} catch {
  // ignore, file may be absent on non-linux hosts
}

const inContainerByCgroup = /(docker|containerd|kubepods|podman)/i.test(cgroup);

if (!inDockerenv && !inContainerByCgroup) {
  console.error('Backend build/typecheck is allowed only inside Docker containers.');
  console.error('Use: docker compose build api worker (or docker compose -f docker-compose.prod.yml build api worker)');
  process.exit(1);
}
