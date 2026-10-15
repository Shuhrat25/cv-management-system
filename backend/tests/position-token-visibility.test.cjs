const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const privateEnv = { INTEGRATION_OPERATOR_IDS: 'operator', JWT_SECRET: 'synthetic-private-test-secret-01234567890123456789' };

function loadSource(relativePath, imports = {}, env = privateEnv) {
  const source = fs.readFileSync(path.join(__dirname, '../src', relativePath), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    exports: module.exports,
    module,
    process: { env },
    require(name) {
      if (Object.hasOwn(imports, name)) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename: relativePath });
  return module.exports;
}

function loadRoute(relativePath, prisma, env = privateEnv) {
  const routes = new Map();
  const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (route, ...handlers) => {
    routes.set(`${method} ${route}`, handlers);
  }]));
  const optionalAuthenticate = (_req, _res, next) => next();
  const authenticate = (_req, _res, next) => next();
  const auth = loadSource('middleware/auth.ts', { jsonwebtoken: {}, '../prisma': { prisma } }, env);
  const serializer = loadSource('serializers/position.ts', { '../middleware/auth': auth }, env);
  loadSource(relativePath, {
    express: { Router: () => router },
    '../prisma': { prisma },
    '../middleware/auth': { authenticate, optionalAuthenticate, requireRole: () => authenticate },
    '../serializers/position': serializer,
  }, env);
  return { ...serializer, routes, optionalAuthenticate };
}

function loadPositions(env = privateEnv) {
  const position = { id: 'position-1', title: 'Frontend developer', createdById: 'owner', apiToken: 'private-token', accessRulesJson: '[]', attributes: [] };
  const prisma = {
    position: {
      findMany: async () => [position],
      findUnique: async () => position,
      create: async () => position,
      update: async () => position,
    },
  };
  return { ...loadRoute('routes/positions.ts', prisma, env), position };
}

const users = {
  anonymous: undefined,
  owner: { id: 'owner', role: 'RECRUITER', isDemo: false },
  stranger: { id: 'stranger', role: 'RECRUITER', isDemo: false },
  operator: { id: 'operator', role: 'ADMIN', isDemo: false },
  untrustedAdmin: { id: 'promoted-by-demo', role: 'ADMIN', isDemo: false },
  demoOwner: { id: 'owner', role: 'RECRUITER', isDemo: true },
  demoOperator: { id: 'operator', role: 'ADMIN', isDemo: true },
};

test('serializer exposes tokens only to non-demo owner or configured real admin', () => {
  const { serializePosition, position } = loadPositions();
  for (const [name, user] of Object.entries(users)) {
    const result = serializePosition(position, user);
    assert.equal(Object.hasOwn(result, 'apiToken'), ['owner', 'operator'].includes(name), name);
    assert.equal(result.title, position.title, name);
  }
  assert.equal(position.apiToken, 'private-token', 'serialization must not mutate the Prisma result');
});

test('owner and operator tokens stay hidden without a private JWT secret even when integration flags are off', () => {
  for (const key of [undefined, 'short', 'super-secret-course-project-key-2026']) {
    const env = { ...privateEnv, SF_ENABLED: 'false', SF_WRITES_ENABLED: 'false', ODOO_ENABLED: 'false' };
    if (key === undefined) delete env.JWT_SECRET;
    else env.JWT_SECRET = key;
    const { serializePosition, position } = loadPositions(env);
    for (const user of [users.owner, users.operator]) {
      assert.equal(Object.hasOwn(serializePosition(position, user), 'apiToken'), false);
    }
  }
});

test('public list, eligibility list, and detail routes all apply the serializer', async () => {
  for (const key of ['get /', 'get /:id']) {
    for (const eligibility of key === 'get /' ? [false, true] : [false]) {
      const { routes, optionalAuthenticate } = loadPositions();
      const handlers = routes.get(key);
      assert.equal(handlers[0], optionalAuthenticate, 'public routes should support optional authentication');
      const handler = handlers.at(-1);
      for (const [name, user] of Object.entries(users)) {
        let body;
        const req = { user, params: { id: 'position-1' }, query: eligibility ? { candidateId: 'candidate' } : {} };
        const res = { json: value => { body = value; }, status: () => res };
        await handler(req, res);
        const result = Array.isArray(body) ? body[0] : body;
        assert.equal(Object.hasOwn(result, 'apiToken'), ['owner', 'operator'].includes(name), `${key} eligibility=${eligibility} ${name}`);
        assert.equal(result.title, 'Frontend developer');
        if (eligibility) assert.equal(result.isEligible, true);
      }
    }
  }
});

test('create, duplicate and update response paths also hide tokens from demo accounts', async () => {
  const { routes } = loadPositions();
  for (const key of ['post /', 'post /:id/duplicate', 'put /:id']) {
    for (const user of [users.owner, users.demoOwner]) {
      let body;
      const req = { user, params: { id: 'position-1' }, body: { title: 'Title', description: 'Description' } };
      const res = { json: value => { body = value; }, status: () => res };
      await routes.get(key).at(-1)(req, res);
      assert.equal(body.id, 'position-1', key);
      assert.equal(Object.hasOwn(body, 'apiToken'), !user.isDemo, key);
    }
  }
});

test('public CV detail serializes its nested full Position without changing other CV fields', async () => {
  const position = {
    id: 'position-1', title: 'Frontend developer', createdById: 'owner', apiToken: 'private-token',
    projectTagsJson: '[]', maxProjects: 3,
    attributes: [{ id: 'pa-1', attributeId: 'a-1', isRequired: true, attribute: {
      id: 'a-1', name: 'Framework', description: 'Preferred framework', dataType: 'STRING',
      category: { name: 'Technology' }, optionsJson: null,
    } }],
  };
  const cv = {
    id: 'cv-1', candidateId: 'candidate', isPublished: true, version: 1,
    position, candidate: { id: 'candidate', name: 'Demo candidate' }, likes: [],
  };
  const prisma = {
    cV: { findUnique: async () => cv },
    candidateAttributeValue: { findMany: async () => [{ id: 'v-1', attributeId: 'a-1', value: 'React', version: 1 }] },
    candidateProject: { findMany: async () => [{ id: 'project-1', name: 'Demo project' }] },
  };
  const { routes, optionalAuthenticate } = loadRoute('routes/cvs.ts', prisma);
  const handlers = routes.get('get /:id');
  assert.equal(handlers[0], optionalAuthenticate);
  for (const [name, user] of Object.entries(users)) {
    let body;
    const req = { user, params: { id: 'cv-1' } };
    const res = { json: value => { body = value; }, status: () => res };
    await handlers.at(-1)(req, res);
    assert.equal(body.cv.id, 'cv-1');
    assert.equal(body.position.id, 'position-1');
    assert.equal(body.position.attributes[0].attribute.name, 'Framework');
    assert.equal(body.attributes[0].value, 'React');
    assert.equal(body.projects[0].name, 'Demo project');
    assert.equal(body.canPublish, true);
    assert.equal(Object.hasOwn(body.position, 'apiToken'), ['owner', 'operator'].includes(name), name);
    if (!['owner', 'operator'].includes(name)) assert.ok(!JSON.stringify(body).includes('private-token'), name);
  }
  assert.equal(position.apiToken, 'private-token', 'nested serialization must not mutate Prisma data');
});

test('public stats removes tokens from latest and popularity arrays for every caller', async () => {
  const positions = [
    { id: 'position-1', title: 'First', createdById: 'owner', apiToken: 'token-1', projectTagsJson: '["React"]', _count: { cvs: 1 } },
    { id: 'position-2', title: 'Second', createdById: 'stranger', apiToken: 'token-2', projectTagsJson: '[]', _count: { cvs: 3 } },
  ];
  const prisma = {
    cV: { count: async () => 4 }, user: { count: async () => 2 },
    position: { count: async () => 2, findMany: async () => positions },
    candidateProject: { findMany: async () => [{ tagsJson: '["Three.js"]' }] },
  };
  const { routes } = loadRoute('routes/stats.ts', prisma);
  for (const [name, user] of Object.entries(users)) {
    let body;
    const res = { json: value => { body = value; }, status: () => res };
    await routes.get('get /').at(-1)({ user }, res);
    assert.equal(body.stats.totalPositions, 2);
    assert.equal(body.latestPositions[0].title, 'First');
    assert.equal(body.mostPopularPositions[0].title, 'Second');
    assert.equal(body.mostPopularPositions[0]._count.cvs, 3);
    assert.equal(body.tagCloud.length, 2);
    assert.ok(!JSON.stringify(body).includes('apiToken'), name);
    assert.ok(!JSON.stringify(body).includes('token-1'), name);
    assert.ok(!JSON.stringify(body).includes('token-2'), name);
  }
});
