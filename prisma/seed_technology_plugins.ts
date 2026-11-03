import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Technology Verification Plugin System, Phase 0. Creates one DRAFT (not approved) plugin row per
// technology that already has a real LaunchpadTechnology row today — confirmed by direct query,
// that's exactly `react` and `nodejs` right now. Vue/Django exist in the OLD, code-only
// TECHNOLOGY_ADAPTERS registry but have no LaunchpadTechnology row of their own yet — per the
// plan's §9 edge case, creating placeholder rows for them is deferred to Phase 2's cutover, not
// done here. Nothing reads these rows yet (they're draft, and no validator/sandbox call site is
// wired to ctx.technologyPlugin until Phase 1) — running this script is a pure addition with zero
// effect on any live verification run.
//
// Every value below is copied byte-for-byte from the current, live source of truth
// (pattern-engine.ts / technology-adapter.ts / notable-patterns.ts / sandbox.service.ts /
// final-score.validator.ts) — this is a migration of existing behavior into rows, not new config.

// Same current COMPONENT_WEIGHTS as final-score.validator.ts:30-36 — the Phase 1 acceptance test
// (generalized final-score loop vs. today's hardcoded loop) depends on this being byte-identical.
const CURRENT_COMPONENT_WEIGHTS = {
  architecture: 0.2,
  requirement: 0.2,
  build: 0.15,
  lint: 0.1,
  'unit-tests': 0.2,
};

// AUTH_CONSTRUCT_BY_LANGUAGE / API_RESPONSE_CONSTRUCT_BY_LANGUAGE regex SOURCES, verbatim from
// pattern-engine.ts:158-167 (the .source of each RegExp literal there).
const AUTH_CONSTRUCT = {
  react:
    'useAuth\\s*\\(|AuthContext|ProtectedRoute|PrivateRoute|RequireAuth|Authorization[\\s\'"]*[:=]|Bearer\\s+[$`]?\\{?\\s*token',
  express: 'passport\\.authenticate\\s*\\(|@UseGuards\\s*\\(|jwt\\.verify\\s*\\(|req\\.headers\\.authorization|authMiddleware|@Roles\\s*\\(',
};
const API_RESPONSE_CONSTRUCT = {
  express: 'res\\.json\\s*\\(|res\\.send\\s*\\(|response\\.json\\s*\\(|res\\.status\\s*\\(\\s*\\d+\\s*\\)\\.json\\s*\\(',
};
// Sentinel for a technology with no real concept of this construct — required, non-nullable,
// never-matching (the confirmed crash-risk fix from the plan's §6.4).
const NEVER_MATCHES = '(?!)';

async function main() {
  // Environment-tolerant by design: this session's local dev DB had both `react` and `nodejs`
  // seeded, but production was confirmed (direct query) to have ONLY `react` at the time this
  // script was written — different environments legitimately have different subsets of
  // technologies seeded so far. A missing technology is skipped with a warning, never a hard
  // exit(1) that would also block every OTHER technology's plugin from being created in the same
  // run (the previous version of this script exited before creating anything if any one
  // technology was missing — confirmed to be a real bug by running this against production).
  const react = await prisma.launchpadTechnology.findUnique({ where: { slug: 'react' } });
  if (!react) {
    console.warn('LaunchpadTechnology "react" not found in this environment — skipping its plugin row.');
  }
  const nodejs = await prisma.launchpadTechnology.findUnique({ where: { slug: 'nodejs' } });
  if (!nodejs) {
    console.warn('LaunchpadTechnology "nodejs" not found in this environment — skipping its plugin row.');
  }

  if (react) {
    // Aliases: every raw technologySlug TECHNOLOGY_ADAPTERS.react.technologySlugs used to accept,
    // other than the canonical slug itself.
    await prisma.launchpadTechnologySlugAlias.upsert({
      where: { aliasSlug: 'react-js' },
      update: { technologyId: react.id },
      create: { aliasSlug: 'react-js', technologyId: react.id },
    });
  }
  if (nodejs) {
    // TECHNOLOGY_ADAPTERS.express.technologySlugs was ['nodejs', 'node-express', 'express'] — the
    // real LaunchpadTechnology row's own slug already IS 'nodejs', so only the other two are aliases.
    for (const aliasSlug of ['node-express', 'express']) {
      await prisma.launchpadTechnologySlugAlias.upsert({
        where: { aliasSlug },
        update: { technologyId: nodejs.id },
        create: { aliasSlug, technologyId: nodejs.id },
      });
    }
  }

  if (react) {
  const existingReactPlugin = await prisma.launchpadTechnologyPlugin.findFirst({
    where: { technologyId: react.id },
    orderBy: { versionNumber: 'desc' },
  });
  if (!existingReactPlugin) {
    await prisma.launchpadTechnologyPlugin.create({
      data: {
        technologyId: react.id,
        versionNumber: 1,
        approvalStatus: 'draft',
        fileExtensions: ['.html', '.js', '.jsx', '.ts', '.tsx'],
        requirementPatterns: [
          {
            prefix: 'component',
            matcherKind: 'component-file-or-declaration-with-semantic-fallback',
            args: { fileExtPattern: 'jsx?|tsx?', declPattern: '(function|const)\\s+{name}\\b' },
          },
          { prefix: 'route', matcherKind: 'route-frontend-path-literal', args: { operatorPattern: '[:=]' } },
          {
            prefix: 'state',
            matcherKind: 'state-hook-or-import',
            args: { template: 'from\\s+["\']{lib}["\']|useState|useReducer|useContext' },
          },
          {
            prefix: 'validation',
            matcherKind: 'validation-keyword-proximity',
            args: { template: '(required|validate|yup|zod|formik).{0,80}{field}|{field}.{0,80}(required|validate)' },
          },
          { prefix: 'auth', matcherKind: 'auth-substring-plus-construct' },
          {
            prefix: 'env',
            matcherKind: 'env-var-access',
            args: { template: 'process\\.env\\.{name}|import\\.meta\\.env\\.{name}' },
          },
        ],
        authConstructPattern: AUTH_CONSTRUCT.react,
        apiResponseConstructPattern: NEVER_MATCHES, // React has no `api-response:` prefix today
        notablePatterns: [
          { concept: 'React useEffect cleanup', patternSource: 'return\\s*\\(\\)\\s*=>\\s*(clearInterval|clearTimeout|\\w+\\.unsubscribe\\s*\\(|\\w+\\.removeEventListener\\s*\\(|\\w+\\.abort\\s*\\()', difficulty: 'medium' },
          { concept: 'React conditional rendering', patternSource: '\\{\\s*!?[\\w.]+\\s*(&&|\\?)\\s*<', difficulty: 'easy' },
          { concept: 'React list rendering with key prop', patternSource: '\\.map\\(\\s*\\([^)]*\\)\\s*=>[^\\n]*key\\s*=\\s*\\{', difficulty: 'easy' },
          { concept: 'React controlled input', patternSource: 'value\\s*=\\s*\\{[^}]+\\}[^>\\n]*onChange\\s*=\\s*\\{', difficulty: 'medium' },
          { concept: 'React custom hook definition', patternSource: '(function\\s+use[A-Z]\\w*\\s*\\(|const\\s+use[A-Z]\\w*\\s*=\\s*\\()', difficulty: 'hard' },
        ],
        challengeScaffold: {
          packageJson: {
            name: 'challenge-scaffold', private: true, version: '1.0.0',
            dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
            devDependencies: {
              jest: '^29.7.0', 'jest-environment-jsdom': '^29.7.0',
              '@testing-library/react': '^14.3.1', '@testing-library/jest-dom': '^6.4.5',
              '@babel/core': '^7.24.0', '@babel/preset-env': '^7.24.0', '@babel/preset-react': '^7.24.0',
              'babel-jest': '^29.7.0',
            },
            jest: { testEnvironment: 'jsdom' },
          },
          babelConfig: { presets: ['@babel/preset-env', ['@babel/preset-react', { runtime: 'automatic' }]] },
        },
        solutionFileName: 'solution.jsx',
        manifestFileName: 'package.json',
        testRunnerKind: 'process-exec',
        installCommand: 'npm install',
        testCommandTemplate: 'npx jest {testFile} --json --outputFile={outputFile}',
        testFileExtension: '.test.js',
        testOutputFormat: 'jest-json',
        lintStrategy: 'regex-js-ts',
        astFileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
        astStrategy: 'typescript-compiler-api',
        dangerousPatterns: [],
        scoreComponentWeights: CURRENT_COMPONENT_WEIGHTS,
        hiddenTestFrameworkName: 'Jest + @testing-library/react',
        hiddenTestPromptNotes:
          'Prefer testing dependency-array correctness, cleanup functions, protected-route redirect behavior, and form-validation rejection.',
        dockerImage: 'registry.neuravolt.in/verify-react:node20',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
      },
    });
    console.log('Created draft LaunchpadTechnologyPlugin v1 for react.');
  } else {
    console.log('react already has a plugin row — skipping (script is idempotent, not a re-seed).');
  }
  }

  if (nodejs) {
  const existingExpressPlugin = await prisma.launchpadTechnologyPlugin.findFirst({
    where: { technologyId: nodejs.id },
    orderBy: { versionNumber: 'desc' },
  });
  if (!existingExpressPlugin) {
    await prisma.launchpadTechnologyPlugin.create({
      data: {
        technologyId: nodejs.id,
        versionNumber: 1,
        approvalStatus: 'draft',
        fileExtensions: ['.js', '.ts'],
        requirementPatterns: [
          { prefix: 'route', matcherKind: 'route-express-style' },
          { prefix: 'table', matcherKind: 'table-prisma-model-or-ddl' },
          {
            prefix: 'validation',
            matcherKind: 'validation-keyword-proximity',
            args: { template: '(joi|class-validator|zod|IsNotEmpty|IsEmail).{0,80}{field}|{field}.{0,80}(required|@Is)' },
          },
          { prefix: 'error-handling', matcherKind: 'error-handling-trycatch-or-zero-guard' },
          { prefix: 'auth', matcherKind: 'auth-substring-plus-construct' },
          { prefix: 'db-relation', matcherKind: 'db-relation-keyword', args: { template: '@relation|belongsTo|hasMany|{relation}' } },
          { prefix: 'env', matcherKind: 'env-var-access', args: { template: 'process\\.env\\.{name}' } },
          { prefix: 'api-response', matcherKind: 'api-response-shape-plus-construct' },
        ],
        authConstructPattern: AUTH_CONSTRUCT.express,
        apiResponseConstructPattern: API_RESPONSE_CONSTRUCT.express,
        notablePatterns: [
          { concept: 'JWT verification', patternSource: 'jwt\\.verify\\s*\\(', difficulty: 'medium' },
          { concept: 'Express centralized error-handling middleware', patternSource: '\\(\\s*err\\s*,\\s*req\\s*,\\s*res\\s*,\\s*next\\s*\\)', difficulty: 'medium' },
          { concept: 'Express async route handler', patternSource: 'async\\s*\\(\\s*req\\s*,\\s*res', difficulty: 'easy' },
          { concept: 'Express request validation middleware', patternSource: "(body\\(\\s*['\"`]\\w+['\"`]\\)\\.\\w+\\(|@IsNotEmpty\\s*\\(|@IsEmail\\s*\\()", difficulty: 'medium' },
          { concept: 'Express Prisma database query', patternSource: 'prisma\\.\\w+\\.(findUnique|findMany|findFirst|create|update|delete)\\s*\\(', difficulty: 'easy' },
        ],
        challengeScaffold: {
          packageJson: {
            name: 'challenge-scaffold', private: true, version: '1.0.0',
            dependencies: { express: '^4.19.2' },
            devDependencies: { jest: '^29.7.0', supertest: '^6.3.4' },
          },
        },
        solutionFileName: 'solution.js',
        manifestFileName: 'package.json',
        testRunnerKind: 'process-exec',
        installCommand: 'npm install',
        testCommandTemplate: 'npx jest {testFile} --json --outputFile={outputFile}',
        testFileExtension: '.test.js',
        testOutputFormat: 'jest-json',
        lintStrategy: 'regex-js-ts',
        astFileExtensions: ['.ts', '.tsx', '.js', '.jsx'],
        astStrategy: 'typescript-compiler-api',
        dangerousPatterns: [],
        scoreComponentWeights: CURRENT_COMPONENT_WEIGHTS,
        hiddenTestFrameworkName: 'Jest + supertest',
        dockerImage: 'registry.neuravolt.in/verify-express:node20',
        memoryLimitMb: 512,
        cpuLimit: 1.0,
      },
    });
    console.log('Created draft LaunchpadTechnologyPlugin v1 for nodejs (express).');
  } else {
    console.log('nodejs already has a plugin row — skipping (script is idempotent, not a re-seed).');
  }
  }

  // Real-new-technology proof (not a re-expression of an already-dynamic technology like React/
  // Express): Python did not exist as a LaunchpadTechnology row in ANY environment before this.
  // isActive: false — this is a verification-engine stress test, not a live curriculum addition;
  // real students never see it until someone deliberately flips it on. Resolved by role SLUG
  // (backend-developer), not a hardcoded id, since career-role ids differ across environments —
  // confirmed by direct query (local and production both have the same slug, different ids).
  const backendRole = await prisma.launchpadCareerRole.findUnique({ where: { slug: 'backend-developer' } });
  if (!backendRole) {
    console.warn('LaunchpadCareerRole "backend-developer" not found — skipping Python technology + plugin.');
  } else {
    let python = await prisma.launchpadTechnology.findUnique({ where: { slug: 'python' } });
    if (!python) {
      python = await prisma.launchpadTechnology.create({
        data: {
          careerRoleId: backendRole.id,
          name: 'Python',
          slug: 'python',
          description: 'Python — added as a live proof that a genuinely new language needs zero core verification-engine code changes, only this one config row plus a small pytest-json-report output parser.',
          defaultStack: false,
          sortOrder: 99,
          isActive: false,
        },
      });
      console.log('Created LaunchpadTechnology "python" (isActive: false).');
    } else {
      console.log('LaunchpadTechnology "python" already exists — skipping create.');
    }

    const existingPythonPlugin = await prisma.launchpadTechnologyPlugin.findFirst({
      where: { technologyId: python.id },
      orderBy: { versionNumber: 'desc' },
    });
    if (!existingPythonPlugin) {
      await prisma.launchpadTechnologyPlugin.create({
        data: {
          technologyId: python.id,
          versionNumber: 1,
          approvalStatus: 'draft',
          fileExtensions: ['.py'],
          requirementPatterns: [],
          authConstructPattern: NEVER_MATCHES,
          apiResponseConstructPattern: NEVER_MATCHES,
          notablePatterns: [],
          challengeScaffold: null,
          solutionFileName: 'solution.py',
          manifestFileName: 'requirements.txt',
          testRunnerKind: 'process-exec',
          // Per-job venv, not a system-wide `pip install`: confirmed live on production (Debian's
          // system Python enforces PEP 668, refusing any pip install outside a venv with
          // "externally-managed-environment") — a venv is also the structurally correct choice
          // regardless, since it isolates each submission's own dependencies rather than
          // installing into shared system site-packages multiple concurrent jobs could stomp on.
          // `--copies`, not the venv default (a `.venv/bin/python` SYMLINK to the real system
          // interpreter): confirmed live — sandbox.service.ts's assertNoEscapingSymlinks (a real,
          // intentional security check, working exactly as designed) rejects that symlink because
          // it resolves outside the sandboxed workDir. `--copies` makes venv copy the interpreter
          // binary instead, so nothing inside the sandbox points outside it. All of this is plugin
          // DATA, not a sandbox.service.ts code change — the security check needed no adjustment.
          installCommand: 'python3 -m venv --copies .venv && .venv/bin/pip install -r requirements.txt',
          testCommandTemplate: '.venv/bin/python -m pytest {testFile} --json-report --json-report-file={outputFile}',
          testFileExtension: '_test.py',
          testOutputFormat: 'pytest-json-report',
          // ruff-python / python-ast-module registry entries don't exist yet (plan §4/§7,
          // Phase 6) — 'none' is the honest, already-supported default, not a placeholder lie.
          lintStrategy: 'none',
          astFileExtensions: [],
          astStrategy: 'none',
          // Left false, not true-but-unwired: TypeCheckingValidator/MutationTestingValidator
          // (plan §3) don't exist yet either — enabling these flags now would silently do
          // nothing, which is worse than an honest false until Phase 3 actually reads them.
          typeCheckingEnabled: false,
          mutationTestingEnabled: false,
          dangerousPatterns: [
            { flag: 'os-system', patternSource: 'os\\.system\\(' },
            { flag: 'subprocess', patternSource: 'subprocess\\.' },
            { flag: 'eval', patternSource: 'eval\\(' },
            { flag: 'exec', patternSource: 'exec\\(' },
            { flag: 'pickle-loads', patternSource: 'pickle\\.loads\\(' },
          ],
          scoreComponentWeights: CURRENT_COMPONENT_WEIGHTS,
          hiddenTestFrameworkName: 'pytest',
          hiddenTestPromptNotes: 'Hidden tests are plain pytest functions; import the solution module directly.',
          dockerImage: 'registry.neuravolt.in/verify-python:3.12',
          memoryLimitMb: 512,
          cpuLimit: 1.0,
        },
      });
      console.log('Created draft LaunchpadTechnologyPlugin v1 for python.');
    } else {
      console.log('python already has a plugin row — skipping (script is idempotent, not a re-seed).');
    }

    // Second real-new-technology proof, chosen deliberately different from Python: a compiled,
    // no-package-manager language. cmake/GoogleTest (the plan's §4 original C++ spec) are NOT
    // installed on production (confirmed by direct check) — rather than install new system
    // packages as a side effect of a verification-engine test, this uses a self-contained
    // approach needing only g++ (confirmed present on both local dev and production): the test
    // command compiles solution.cpp + the hidden test file together and runs the resulting
    // binary in one shell invocation, using the binary's own exit code as the pass/fail signal
    // (testOutputFormat: 'exit-code-only', a new but tiny registry entry — same "small, isolated
    // addition" pattern as pytest-json-report, not a sandbox.service.ts change).
    let cpp = await prisma.launchpadTechnology.findUnique({ where: { slug: 'cpp' } });
    if (!cpp) {
      cpp = await prisma.launchpadTechnology.create({
        data: {
          careerRoleId: backendRole.id,
          name: 'C++',
          slug: 'cpp',
          description: 'C++ — a second live proof of the plugin architecture, deliberately chosen as a compiled language with no package manager, to show the DB-driven design generalizes beyond interpreted/npm-shaped technologies.',
          defaultStack: false,
          sortOrder: 100,
          isActive: false,
        },
      });
      console.log('Created LaunchpadTechnology "cpp" (isActive: false).');
    } else {
      console.log('LaunchpadTechnology "cpp" already exists — skipping create.');
    }

    const existingCppPlugin = await prisma.launchpadTechnologyPlugin.findFirst({
      where: { technologyId: cpp.id },
      orderBy: { versionNumber: 'desc' },
    });
    if (!existingCppPlugin) {
      await prisma.launchpadTechnologyPlugin.create({
        data: {
          technologyId: cpp.id,
          versionNumber: 1,
          approvalStatus: 'draft',
          fileExtensions: ['.cpp', '.h', '.hpp'],
          requirementPatterns: [],
          authConstructPattern: NEVER_MATCHES,
          apiResponseConstructPattern: NEVER_MATCHES,
          notablePatterns: [],
          challengeScaffold: null,
          solutionFileName: 'solution.cpp',
          manifestFileName: null,
          testRunnerKind: 'process-exec',
          noBuildStep: true, // compile+run happens in one shot inside testCommandTemplate itself
          installCommand: null,
          buildCommand: null,
          testCommandTemplate: 'g++ -std=c++17 -O2 -Wall -o test_bin solution.cpp {testFile} && ./test_bin',
          testFileExtension: '.cpp',
          testOutputFormat: 'exit-code-only',
          // Real, not theoretical: g++ compiling + linking + running a tiny program, plus
          // whatever the student's own solution does, comfortably fits in far less than the
          // 30s default — kept modest specifically so a submission with a genuine infinite loop
          // (the discipline this plugin's own runInSandbox() timeout/Firejail --rlimit-cpu is
          // there to bound) fails fast rather than tying up a sandbox slot for half a minute.
          testRunnerDefaultTimeoutSec: 15,
          lintStrategy: 'none',
          astFileExtensions: [],
          astStrategy: 'none',
          // Memory/concurrency-safety validators (plan §3) don't exist yet — same honest-false
          // discipline as Python's typeCheckingEnabled/mutationTestingEnabled above.
          memorySafetyEnabled: false,
          concurrencySafetyEnabled: false,
          dangerousPatterns: [
            { flag: 'system-call', patternSource: 'system\\s*\\(' },
            { flag: 'exec-family', patternSource: '\\bexecl?p?\\s*\\(' },
            { flag: 'popen', patternSource: 'popen\\s*\\(' },
          ],
          scoreComponentWeights: CURRENT_COMPONENT_WEIGHTS,
          hiddenTestFrameworkName: 'plain g++ + assert (no GoogleTest — not installed on this host)',
          hiddenTestPromptNotes: 'Hidden tests are a small C++ file with a main() that uses assert() and forward-declares the solution\'s functions; exit code 0 means every assertion passed.',
          dockerImage: 'registry.neuravolt.in/verify-cpp:gcc13',
          memoryLimitMb: 512,
          cpuLimit: 1.0,
        },
      });
      console.log('Created draft LaunchpadTechnologyPlugin v1 for cpp.');
    } else {
      console.log('cpp already has a plugin row — skipping (script is idempotent, not a re-seed).');
    }
  }

  console.log('Seeding completed! Rows are DRAFT — nothing reads them until Phase 1 wires validators to ctx.technologyPlugin.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
