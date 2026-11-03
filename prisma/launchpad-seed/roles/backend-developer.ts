import { RoleContent } from '../types';

export const backendDeveloper: RoleContent = {
  careerName: 'Software Engineering',
  careerSlug: 'software-engineering',
  roleName: 'Backend Developer',
  roleSlug: 'backend-developer',
  roleDescription: 'Builds the servers, APIs, and databases behind real products — Node.js, Express, REST design, and real databases, ending in a verified, GitHub-based portfolio of real projects.',
  technologyName: 'Node.js & Express',
  technologySlug: 'nodejs',
  technologyDescription: 'The Node stack: JavaScript fundamentals for the server, Express routing/middleware, databases, and authentication.',
  levels: [
    // ───────────────────────── Level 1 ─────────────────────────
    {
      levelNumber: 1,
      name: 'Node.js & Express Foundations',
      description: 'What Node actually is, and building your first real HTTP server with Express.',
      difficulty: 'explorer',
      estimatedDurationHours: 12,
      xpRequired: 0,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Node.js Fundamentals',
          slug: 'nodejs-fundamentals',
          description: 'JavaScript outside the browser: modules, npm, and the event loop.',
          learningObjectives: [
            'Explain what Node.js is and why it can run JavaScript outside a browser',
            'Use require/module.exports (or ES modules) to split code across files',
            'Understand that Node is single-threaded but non-blocking via the event loop',
          ],
          videos: [{ title: 'How to build a REST API with Node & Express', url: 'https://www.youtube.com/watch?v=pKd0Rpw7O48', type: 'video' }],
          officialDocs: [
            { title: 'Node.js Documentation', url: 'https://nodejs.org/en/docs', type: 'doc' },
            { title: 'Modules: CommonJS modules', url: 'https://nodejs.org/api/modules.html', type: 'doc' },
          ],
          notes: `Node.js is a JavaScript runtime built on Chrome's V8 engine that runs outside a browser — no window, no DOM, but full access to the file system, network, and OS that a browser deliberately sandboxes away. That's what lets JavaScript run a server at all.

Code is split across files with modules: module.exports = { fn } in one file, const { fn } = require('./file') in another (CommonJS — the traditional Node style; newer projects often use ES modules with import/export instead, set via "type": "module" in package.json). Splitting into modules is not optional style for a real backend — a single-file server that mixes routes, database logic, and business logic together is exactly what the Structure/Architecture validators on this track's challenges are checking against.

Node is single-threaded, but I/O (file reads, network requests, database queries) is non-blocking: instead of freezing the thread waiting for a database response, Node hands the operation off and moves on, running your callback/promise resolution when the result is ready. This is why a slow database query in a request handler doesn't necessarily block every other request — but a CPU-heavy synchronous loop absolutely does, since that has nowhere else to go.`,
          cheatsheet: `require('./module')             — import (CommonJS)
module.exports = { fn }         — export (CommonJS)
import { fn } from './module.js'  — import (ES modules, needs "type":"module")
npm init -y                     — create package.json
npm install express             — add a dependency
node index.js                   — run a file
Node = single-threaded, non-blocking I/O via the event loop`,
          codeExamples: [
            {
              title: 'Splitting code into modules',
              language: 'javascript',
              code: `// math.js
function add(a, b) { return a + b; }
module.exports = { add };

// index.js
const { add } = require('./math');
console.log(add(2, 3));`,
            },
            {
              title: 'Non-blocking I/O in practice',
              language: 'javascript',
              code: `console.log('1: start');
setTimeout(() => console.log('2: timer done'), 0);
console.log('3: end');
// logs 1, 3, 2 — the timer callback runs after the synchronous code finishes`,
            },
          ],
          quizQuestions: [
            { question: 'Why can Node.js run JavaScript on a server when a browser cannot host a server at all?', options: ['Node is a different language than browser JS', 'Node embeds the V8 engine but adds OS-level APIs (file system, network, etc.) that a browser deliberately withholds', 'Browsers do not support JavaScript', 'There is no real difference'], correctIndex: 1, explanation: 'Same language, same core engine (V8) — Node just exposes system-level capabilities a browser sandbox intentionally blocks for security.' },
            { question: 'Does a slow database query block every other incoming request in Node?', options: ['Yes, always, since Node is single-threaded', 'No — I/O is non-blocking, so Node continues handling other requests while waiting for the result', 'Only on Linux', 'Only if using CommonJS'], correctIndex: 1, explanation: 'Being single-threaded refers to JS execution, not I/O — Node hands off I/O operations and keeps serving other requests while waiting.' },
            { question: 'What DOES block the event loop and hurt every other request?', options: ['A slow database query', 'A synchronous, CPU-heavy loop running on the main thread', 'Reading a file', 'Nothing can block Node'], correctIndex: 1, explanation: 'Pure synchronous computation has nowhere to be "handed off" to — it runs on the one JS thread and blocks everything else until it finishes.' },
          ],
          miniProject: {
            title: 'A multi-file CLI calculator',
            description: 'A small command-line calculator with add/subtract/multiply/divide split into a separate math module, imported into an entry file.',
            requirements: ['Math functions live in a separate module file, not the entry file', 'Divide by zero is handled without crashing the process'],
          },
          interviewBank: [
            {
              pattern: 'module\\.exports',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Why did you split this logic into a separate file instead of keeping everything in one index.js?',
              expectedAnswer: 'Separation of concerns — keeping route handlers, business logic, and utilities in distinct modules makes the codebase testable and navigable, and is what lets a project scale past a few hundred lines without becoming unmaintainable.',
              evaluationRubric: ['Names a concrete maintainability/testability benefit', 'Not just "it is a convention"', 'Can explain require/module.exports mechanics correctly'],
            },
            {
              pattern: 'setTimeout|event loop',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'In your non-blocking I/O example, why does "3: end" log before "2: timer done" even though the timer was scheduled first in the code?',
              expectedAnswer: 'setTimeout hands the callback off to be run later, even with a 0ms delay — Node finishes executing all the current synchronous code first (the call stack empties), and only then does the event loop pick up the queued timer callback, which is why the synchronous log always wins the race regardless of delay value.',
              evaluationRubric: ['Correctly explains synchronous code always finishes first', 'Does not claim 0ms means "immediately"', 'Names the event loop/callback queue as the mechanism'],
            },
            {
              pattern: 'require\\(|module\\.exports',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'What would happen if two of your files required each other — file A requires file B, and file B requires file A?',
              expectedAnswer: 'A circular require — Node detects it and returns a partially-completed (possibly empty) exports object for whichever module was still mid-execution when the cycle was hit, which commonly manifests as "X is not a function" or undefined exports; the real fix is usually restructuring so the shared logic lives in a third module both depend on.',
              evaluationRubric: ['Recognizes this as a circular dependency, not a crash', 'Describes the partial-exports symptom concretely', 'Proposes a structural fix, not just "avoid it"'],
            },
          ],
          xpReward: 80,
          coinsReward: 40,
          skillMapping: { 'Node.js': 25, JavaScript: 10 },
          difficulty: 'explorer',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a small multi-file CLI calculator (add/subtract/multiply/divide) with the math logic in its own module, and handle a divide-by-zero input without crashing the process.',
            requirements: ['error-handling:divide'],
            resources: [{ title: 'Node.js Documentation', url: 'https://nodejs.org/en/docs', type: 'doc' }],
            hints: [
              'Keep the math functions in a separate file, imported via require/module.exports — not inline in the entry file.',
              'Divide-by-zero should return a clear error/message, not throw an uncaught exception or silently print Infinity.',
            ],
            evaluationCriteria: [
              'Math logic lives in a separate module file, not the entry file',
              'Divide-by-zero is handled explicitly, not left to crash or silently misbehave',
            ],
            expectedSkills: ['Node.js', 'JavaScript'],
            difficulty: 'explorer',
            multiplier: 0.6,
            xp: 80,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'Express Basics & Routing',
          slug: 'express-basics-routing',
          description: 'Setting up a real HTTP server with Express: routes, params, and JSON responses.',
          learningObjectives: [
            'Set up an Express app and define GET/POST/PATCH/DELETE routes',
            'Read route params, query strings, and JSON request bodies',
            'Send correctly-structured JSON responses with the right status codes',
          ],
          videos: [{ title: 'How to build a REST API with Node & Express', url: 'https://www.youtube.com/watch?v=pKd0Rpw7O48', type: 'video' }],
          officialDocs: [
            { title: 'Express - routing', url: 'https://expressjs.com/en/guide/routing.html', type: 'doc' },
            { title: 'Express - installing', url: 'https://expressjs.com/en/starter/installing.html', type: 'doc' },
          ],
          notes: `Express is a thin, unopinionated layer over Node's raw http module that makes routing and middleware manageable. app.get('/users/:id', handler) defines a route; :id becomes available as req.params.id. app.use(express.json()) is required before any route that reads req.body from a JSON POST/PATCH request — forgetting it is one of the most common "why is req.body undefined" bugs.

A route handler is (req, res) => {...} — req has params/query/body/headers, res is how you respond: res.json(data) sends JSON with a 200 by default, res.status(404).json({error: 'Not found'}) sends the right status code alongside a body. Getting status codes right (200 success, 201 created, 400 bad input, 401 unauthenticated, 403 forbidden, 404 not found, 500 server error) is exactly what a well-designed REST API is judged on, and what a real frontend's error-handling code depends on to know how to react.

Route params (/users/:id) are for identifying a specific resource; query strings (?page=2&limit=10) are for filtering/pagination/optional modifiers — mixing these up (e.g. putting a filter in the URL path) is a common design smell this track's Architecture Validator checks for via the required "route:" patterns.`,
          cheatsheet: `const express = require('express');
const app = express();
app.use(express.json());          — required to read req.body on JSON requests

app.get('/users/:id', (req, res) => { ... })    — req.params.id
app.post('/users', (req, res) => { ... })       — req.body
app.get('/users', (req, res) => { ... })        — req.query.page etc.

res.json(data)                    — 200 + JSON body
res.status(201).json(data)        — created
res.status(404).json({ error })   — not found
app.listen(3000)                  — start the server`,
          codeExamples: [
            {
              title: 'A minimal Express CRUD-shaped server',
              language: 'javascript',
              code: `const express = require('express');
const app = express();
app.use(express.json());

let todos = [];

app.get('/todos', (req, res) => {
  res.json(todos);
});

app.post('/todos', (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  const todo = { id: Date.now(), text, done: false };
  todos.push(todo);
  res.status(201).json(todo);
});

app.get('/todos/:id', (req, res) => {
  const todo = todos.find(t => t.id === Number(req.params.id));
  if (!todo) return res.status(404).json({ error: 'Not found' });
  res.json(todo);
});

app.listen(3000, () => console.log('Listening on 3000'));`,
            },
          ],
          quizQuestions: [
            { question: 'What happens if you POST JSON data but forget app.use(express.json())?', options: ['req.body is automatically parsed anyway', 'req.body is undefined', 'The server crashes', 'The request is rejected with a 400'], correctIndex: 1, explanation: 'Without the JSON body-parsing middleware, Express never parses the raw request stream into req.body — it stays undefined.' },
            { question: 'For POST /users creating a new user successfully, which status code is most correct?', options: ['200', '201', '204', '404'], correctIndex: 1, explanation: '201 Created is the specific status for "a new resource was successfully created" — 200 is a generic success, less precise here.' },
            { question: 'In a route /users/:id, what does req.params.id contain for a request to /users/42?', options: ['undefined', 'The string "42"', 'The number 42', 'An array'], correctIndex: 1, explanation: 'Route params always arrive as strings — "42", not the number 42 — a common source of bugs when comparing against a numeric id without converting first.' },
          ],
          miniProject: {
            title: 'A book catalog API',
            description: 'GET /books (list), GET /books/:id (one), POST /books (create) — in-memory array, correct status codes.',
            requirements: ['GET /books/:id returns 404 for an unknown id, not a crash', 'POST /books validates that a title was provided'],
          },
          interviewBank: [
            {
              pattern: '\\.get\\(.*:id',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'What status code does your GET /books/:id return for an id that does not exist, and why that one specifically?',
              expectedAnswer: '404 Not Found — it correctly tells the client the resource itself does not exist, distinct from a 400 (bad request format) or 500 (server error), letting frontend code branch on the specific failure reason.',
              evaluationRubric: ['Names 404 specifically, not a generic "error"', 'Distinguishes it from 400/500', 'Confirms the actual code returns it, not just describes intent'],
            },
            {
              pattern: 'express\\.json\\(\\)',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'A teammate\'s POST route always sees req.body as undefined, even though Postman shows the JSON body being sent. What is the most likely cause?',
              expectedAnswer: 'app.use(express.json()) is either missing or registered after the affected route — without that middleware, Express never parses the raw incoming JSON stream into req.body, so it stays undefined regardless of what the client actually sent.',
              evaluationRubric: ['Names express.json() specifically as the likely missing piece', 'Mentions middleware order as a possible variant of the same bug', 'Does not blame the client/Postman'],
            },
            {
              pattern: 'req\\.query',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Would you design "get all books by a given author" as GET /books/:authorId or GET /books?authorId=X? Why?',
              expectedAnswer: 'A query string (?authorId=X) — the route param /:authorId implies authorId identifies the resource itself (a specific book), when here it is actually a filter being applied to a collection; conflating params and filters is a common REST design smell.',
              evaluationRubric: ['Correctly picks the query-string form', 'Explains the params-identify-a-resource vs query-filters-a-collection distinction', 'Can give a case where a path param would be the right call instead'],
            },
          ],
          xpReward: 100,
          coinsReward: 50,
          skillMapping: { Express: 25, 'REST API': 20 },
          difficulty: 'explorer',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a minimal book catalog API: list all books, fetch one by id, and create a new book — in-memory storage, correct status codes throughout.',
            requirements: ['route:GET /books', 'route:GET /books/:id', 'route:POST /books'],
            resources: [{ title: 'Express - routing', url: 'https://expressjs.com/en/guide/routing.html', type: 'doc' }],
            hints: [
              'GET /books/:id should return 404, not a crash, for an id that does not exist.',
              'POST /books should respond 201 on success, not the generic 200.',
            ],
            evaluationCriteria: [
              'All three routes exist and behave correctly',
              'An unknown id returns 404, not a server error',
            ],
            expectedSkills: ['Express', 'REST API'],
            difficulty: 'explorer',
            multiplier: 0.6,
            xp: 100,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Challenge: Book Catalog API',
          slug: 'challenge-book-catalog-api',
          description: 'Integrated challenge for Level 1 — a complete in-memory REST API for a book catalog.',
          learningObjectives: ['Apply Node modules and Express routing together in one real, submitted project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Level 1 integrated challenge (Part 4a). Complete it after Nodes 1 and 2.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'app\\.listen',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Walk me through what happens, in order, from your server starting up to responding to a GET /books request.',
              expectedAnswer: 'app.listen binds the server to a port; on an incoming GET /books, Express matches the route, runs any registered middleware in order, then the route handler runs and calls res.json() to send the in-memory array back as the response body with a 200 status.',
              evaluationRubric: ['Correctly orders middleware before the handler', 'Mentions route matching specifically', 'Knows what res.json() actually does (sets content-type + serializes + sends)'],
            },
            {
              pattern: 'PATCH.*:id',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'What does your PATCH /books/:id do if the id in the URL does not match any book — and what did you deliberately test for that case?',
              expectedAnswer: 'It returns 404 rather than silently doing nothing or throwing an unhandled error — this was tested by sending a PATCH to a clearly nonexistent id and asserting the response is a clean 404 with an error body, not a server crash or a misleading 200.',
              evaluationRubric: ['Confirms 404 specifically, not a generic failure', 'States they actually tested this path, not just assumed it', 'Rejects a silent no-op as acceptable behavior'],
            },
            {
              pattern: 'title.*required|validation:title',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Where exactly in your POST /books handler does title validation happen relative to creating the book?',
              expectedAnswer: 'Before any creation logic runs — the handler checks for a valid title first and returns 400 immediately if it is missing, so an invalid request never reaches the point of mutating the in-memory store at all.',
              evaluationRubric: ['Confirms validation happens before the write, not after', 'Names the correct status code (400)', 'Would not accept "it gets validated eventually" as sufficient'],
            },
          ],
          xpReward: 150,
          coinsReward: 75,
          skillMapping: { 'Node.js': 10, Express: 20, 'REST API': 20 },
          difficulty: 'explorer',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a REST API for a book catalog: list, get one, create, update, delete — in-memory storage, correct status codes throughout.',
            requirements: [
              'route:GET /books', 'route:POST /books', 'route:GET /books/:id',
              'route:PATCH /books/:id', 'route:DELETE /books/:id',
              'validation:title',
            ],
            resources: [{ title: 'Express - routing', url: 'https://expressjs.com/en/guide/routing.html', type: 'doc' }],
            hints: [
              'Validate required fields before creating/updating, return 400 with a clear message on failure',
              'Return 404, not a crash, for operations on an id that does not exist',
            ],
            evaluationCriteria: [
              'All five routes exist and behave correctly',
              'Status codes are correct for success, not-found, and validation failure',
              'Route handlers do not crash the server on bad input',
            ],
            expectedSkills: ['Node.js', 'Express', 'REST API'],
            difficulty: 'explorer',
            multiplier: 1.0,
            xp: 150,
            challengeType: 'career',
          },
        },
      ],
    },

    // ───────────────────────── Level 2 ─────────────────────────
    {
      levelNumber: 2,
      name: 'Middleware & Error Handling',
      description: 'What middleware actually is, and building a real, centralized error-handling pattern.',
      difficulty: 'beginner',
      estimatedDurationHours: 16,
      xpRequired: 200,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Middleware Deep Dive',
          slug: 'express-middleware',
          description: 'The (req, res, next) pattern that everything in Express is built on.',
          learningObjectives: [
            'Explain what middleware is and why order matters',
            'Write custom middleware for logging and simple auth checks',
            'Use next() correctly, including next(error) to skip to error handling',
          ],
          videos: [{ title: 'The ABSOLUTE BEST Way to Handle Errors in EXPRESS JS', url: 'https://www.youtube.com/watch?v=EUYnERcOGpA', type: 'video' }],
          officialDocs: [{ title: 'Using Express middleware', url: 'https://expressjs.com/en/guide/using-middleware.html', type: 'doc' }],
          notes: `Middleware is just a function (req, res, next) => {...} that runs before your route handler — every single thing in Express, including express.json() and even the route handlers themselves, is middleware under the hood. Middleware registered with app.use() runs for every matching request, in the exact order it was registered; that ordering is not cosmetic — an auth-check middleware registered AFTER the routes it's meant to protect does nothing.

Calling next() passes control to the next middleware/handler in the chain. Forgetting to call next() (and not sending a response either) leaves the request hanging forever — a real, common bug. Calling next(err) with an argument skips every remaining normal middleware and jumps straight to error-handling middleware.

A simple auth-check middleware: read a header, and either call next() to let the request continue, or res.status(401).json(...) to stop it there — never both.`,
          cheatsheet: `function logger(req, res, next) {
  console.log(req.method, req.path);
  next();  // must call this or the request hangs
}
app.use(logger);   // runs for every request, in registration order

function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  next();
}
app.get('/admin', requireAuth, (req, res) => { ... });  // per-route middleware

next(err)          — skip to error-handling middleware`,
          codeExamples: [
            {
              title: 'Logging middleware + a protected route',
              language: 'javascript',
              code: `function logger(req, res, next) {
  console.log(\`\${req.method} \${req.path}\`);
  next();
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  next();
}

app.use(logger);
app.get('/admin/stats', requireAuth, (req, res) => {
  res.json({ visitors: 1000 });
});`,
            },
          ],
          quizQuestions: [
            { question: 'What happens if a middleware function never calls next() and never sends a response?', options: ['Express automatically continues after a timeout', 'The request hangs indefinitely', 'An error is thrown immediately', 'The next middleware runs anyway'], correctIndex: 1, explanation: 'Express has no automatic fallback — a middleware that neither calls next() nor sends a response leaves the client waiting forever.' },
            { question: 'Why does middleware registration order matter?', options: ['It does not matter', 'Middleware runs in the exact order it was registered — an auth check after the protected route does nothing', 'Express reorders it automatically by type', 'Only route order matters, not middleware order'], correctIndex: 1, explanation: 'Requests flow through middleware top-to-bottom as registered — placing a guard after what it is meant to guard is a real, common bug.' },
            { question: 'What is the specific effect of calling next(err) instead of next()?', options: ['No difference', 'It skips remaining normal middleware/routes and jumps straight to error-handling middleware', 'It restarts the request', 'It logs a warning but continues normally'], correctIndex: 1, explanation: 'Passing an argument to next() signals an error, routing straight to any (err, req, res, next) error handlers instead of continuing the normal chain.' },
          ],
          miniProject: {
            title: 'Request logger + rate-limit-lite',
            description: 'A logging middleware plus a simple middleware that rejects a client after more than 5 requests in a rolling 10-second window (in-memory, per-IP).',
            requirements: ['Logger runs for every route, correctly calling next()', 'Rate-limit middleware returns 429 once the threshold is exceeded'],
          },
          interviewBank: [
            {
              pattern: 'function \\w+\\(req, res, next\\)',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Your requireAuth middleware is registered on a specific route, not globally with app.use(). Why did you choose that instead?',
              expectedAnswer: 'Per-route middleware (passed as an extra argument to app.get/post/etc.) applies only to that specific route, whereas app.use() applies globally to every request — the choice depends on whether the check should protect everything or just specific endpoints.',
              evaluationRubric: ['Correctly distinguishes global vs per-route middleware registration', 'Justifies the choice based on which routes actually need protection', 'Does not claim they are equivalent'],
            },
            {
              pattern: 'next\\(\\)',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'You added a new logging middleware and now every request hangs forever with no response. What is the most likely bug?',
              expectedAnswer: 'The middleware never calls next() (and never sends its own response), so Express has no signal to continue to the next handler — the request stalls indefinitely; the fix is making sure every code path in the middleware either calls next() or ends the response.',
              evaluationRubric: ['Correctly identifies a missing next() call as the likely cause', 'Confirms Express has no automatic timeout/fallback for this', 'Would check every branch of the middleware, not just the happy path'],
            },
            {
              pattern: 'next\\(err\\)|next\\(error\\)',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'What is the difference between calling next() and calling next(someError) inside a middleware?',
              expectedAnswer: 'next() with no argument continues to the next matching middleware/route in the normal chain; next(err) with any argument tells Express this is an error, skipping every remaining normal middleware and jumping straight to error-handling middleware instead.',
              evaluationRubric: ['Correctly distinguishes the two calls', 'Names error-handling middleware as the destination for next(err)', 'Knows passing any truthy value triggers this, not just an Error instance'],
            },
          ],
          xpReward: 110,
          coinsReward: 55,
          skillMapping: { Express: 25, 'Error Handling': 15 },
          difficulty: 'beginner',
          trustLevel: 'A',
          challenge: {
            objective: 'Add a logging middleware that runs on every request, plus a simple per-IP middleware that rejects a client with a 429 after more than 5 requests in a 10-second window.',
            requirements: ['error-handling:'],
            resources: [{ title: 'Using Express middleware', url: 'https://expressjs.com/en/guide/using-middleware.html', type: 'doc' }],
            hints: [
              'The logger must call next() on every request, or every route behind it will hang.',
              'Rate-limit tracking can be a simple in-memory Map keyed by IP — no database needed for this.',
            ],
            evaluationCriteria: [
              'Logging middleware runs for every route, correctly calling next()',
              'Rate-limit middleware returns 429 once the threshold is exceeded, not silently ignored',
            ],
            expectedSkills: ['Express', 'Error Handling'],
            difficulty: 'beginner',
            multiplier: 0.7,
            xp: 110,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'Centralized Error Handling & Validation',
          slug: 'express-error-handling-validation',
          description: 'A real error-handling pattern: one place errors get formatted, input validated before it ever reaches business logic.',
          learningObjectives: [
            'Write a 4-argument error-handling middleware and place it correctly',
            'Wrap async route handlers so rejected promises don\'t crash the process',
            'Validate request bodies before acting on them, returning clear 400 errors',
          ],
          videos: [{ title: 'The ABSOLUTE BEST Way to Handle Errors in EXPRESS JS', url: 'https://www.youtube.com/watch?v=EUYnERcOGpA', type: 'video' }],
          officialDocs: [{ title: 'Error Handling · Express.js', url: 'https://expressjs.com/en/guide/error-handling.html', type: 'doc' }],
          notes: `Express recognizes error-handling middleware specifically by its FOUR arguments: (err, req, res, next) — three-argument middleware is treated as normal middleware, even if you intended it as an error handler. It must be registered LAST, after every other app.use() and route.

A subtle, very common bug: an async route handler that throws (or an awaited promise that rejects) does NOT automatically get caught by Express's error handling the way a synchronous throw does — the process can crash or the request can hang. The fix is either wrapping every async handler in a try/catch that calls next(err), or a small asyncHandler wrapper that does this once, everywhere.

Validation should happen before any database write or business logic runs — checking "is this even valid input" first, separately from "does this input make business sense" (like a duplicate email), keeps error messages precise and keeps invalid data from ever reaching deeper logic. This directly feeds the "validation:" requirements this track's Requirement Validator checks for.`,
          cheatsheet: `// Must be LAST, and have exactly 4 args to be recognized as an error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Async handler wrapper — without this, a rejected promise can hang the request
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.post('/users', asyncHandler(async (req, res) => {
  if (!req.body.email) {
    const err = new Error('email is required');
    err.status = 400;
    throw err;
  }
  ...
}));`,
          codeExamples: [
            {
              title: 'asyncHandler + centralized error middleware',
              language: 'javascript',
              code: `const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

app.post('/users', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    const err = new Error('email is required');
    err.status = 400;
    throw err;
  }
  const user = await db.users.create({ email });
  res.status(201).json(user);
}));

// LAST in the file, after every route:
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});`,
            },
          ],
          quizQuestions: [
            { question: 'How does Express identify a function as error-handling middleware rather than normal middleware?', options: ['By its position in the file only', 'By having exactly 4 arguments: (err, req, res, next)', 'By its function name', 'By a special decorator'], correctIndex: 1, explanation: 'The 4-argument signature is the specific signal Express looks for — a 3-argument version is always treated as regular middleware.' },
            { question: 'What happens by default if an async route handler\'s awaited promise rejects, with no try/catch or wrapper?', options: ['Express automatically calls the error handler', 'The rejection is unhandled — the request can hang or the process can crash, depending on Node/Express version', 'The route returns a 500 automatically', 'Nothing bad happens'], correctIndex: 1, explanation: 'Unlike synchronous throws, Express does not automatically catch rejected promises from async handlers without an explicit try/catch or wrapper forwarding to next(err).' },
            { question: 'Why validate input before running business logic, rather than letting a database constraint catch bad data?', options: ['No real reason, it is the same either way', 'It produces precise, immediate 400 errors instead of vague database errors, and avoids unnecessary work/side effects on invalid input', 'Databases cannot reject bad data', 'It is required by REST'], correctIndex: 1, explanation: 'Validating first gives clear, actionable errors and avoids doing partial work (or leaking a raw DB error message) before discovering the input was invalid.' },
          ],
          miniProject: {
            title: 'Wrap an existing API in error handling',
            description: 'Take the Level 1 Book Catalog API, add an asyncHandler wrapper and a centralized error-handling middleware, replacing any inline try/catch.',
            requirements: ['A single error-handling middleware, registered last', 'All async routes use the wrapper, none silently swallow rejected promises'],
          },
          interviewBank: [
            {
              pattern: 'catch\\(next\\)',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Explain what actually happens if you remove asyncHandler from one of your routes and that route throws inside an await.',
              expectedAnswer: 'Without the wrapper forwarding the rejection to next(), Express never sees the error — the request either hangs with no response, or (depending on Node version) the unhandled rejection can crash the process, whereas the wrapper ensures next(err) is always called, routing it to the centralized handler.',
              evaluationRubric: ['Correctly identifies the specific failure mode, not just "it breaks"', 'Explains what the wrapper is doing mechanically', 'Confirms this was actually tested, not assumed'],
            },
            {
              pattern: '\\(err, req, res, next\\)',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'You wrote an error handler as (err, req, res) with only 3 parameters. Why does Express not treat it as an error handler?',
              expectedAnswer: 'Express identifies error-handling middleware purely by counting exactly 4 declared parameters — a 3-argument function is indistinguishable from normal middleware to Express, so it gets registered as (and treated as) a regular handler, and real errors would never reach it.',
              evaluationRubric: ['Correctly names the 4-parameter arity check specifically', 'Does not attribute the distinction to naming or position alone', 'Confirms the fix is adding the unused-but-required next parameter'],
            },
            {
              pattern: 'validate|validation',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Why check "is this a valid email format" before checking "does this email already exist in the database"?',
              expectedAnswer: 'Format validation is cheap and synchronous and should reject obviously bad input immediately; the database uniqueness check is an async, more expensive operation that should only run once the input is already known to be well-formed — running the DB check first would waste a real query on input that was never going to be valid anyway.',
              evaluationRubric: ['Correctly orders cheap/sync checks before expensive/async ones', 'Names the wasted-query cost of checking in the wrong order', 'Distinguishes format validity from business-rule validity (uniqueness)'],
            },
          ],
          xpReward: 110,
          coinsReward: 55,
          skillMapping: { Express: 20, 'Error Handling': 25, Validation: 20 },
          difficulty: 'beginner',
          trustLevel: 'A',
          challenge: {
            objective: 'Take the Level 1 Book Catalog API and add an asyncHandler wrapper plus one centralized error-handling middleware, replacing any inline try/catch.',
            requirements: ['error-handling:', 'validation:title'],
            resources: [{ title: 'Error Handling · Express.js', url: 'https://expressjs.com/en/guide/error-handling.html', type: 'doc' }],
            hints: [
              'The error handler needs exactly 4 arguments — (err, req, res, next) — and must be registered last.',
              'Every async route should go through the asyncHandler wrapper so a rejected promise reaches the error handler instead of hanging.',
            ],
            evaluationCriteria: [
              'A single error-handling middleware exists, registered last',
              'All async routes use the wrapper, none silently swallow rejected promises',
            ],
            expectedSkills: ['Express', 'Error Handling', 'Validation'],
            difficulty: 'beginner',
            multiplier: 0.7,
            xp: 110,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Challenge: Task Manager API',
          slug: 'challenge-task-manager-api',
          description: 'Integrated challenge for Level 2 — a task manager API with real middleware, validation, and centralized error handling.',
          learningObjectives: ['Apply middleware, validation, and centralized error handling together in one real, submitted project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Level 2 integrated challenge (Part 4a). Complete it after Nodes 1 and 2.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'asyncHandler',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Show me where a bad request (e.g. missing title) is caught in your task manager, and trace exactly what happens to it.',
              expectedAnswer: 'The route validates req.body.title before touching the in-memory store; if missing, it throws a 400 error, which is caught by the asyncHandler wrapper and forwarded via next(err) to the centralized error middleware, which formats and sends the JSON error response.',
              evaluationRubric: ['Traces the actual code path, not a hypothetical', 'Correctly places validation before the write, not after', 'Confirms the response has the right status code'],
            },
            {
              pattern: 'app\\.use\\(logger',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Where in your file is the logging middleware registered relative to your routes, and does the order actually matter here?',
              expectedAnswer: 'It is registered before the routes with app.use(), so it runs for every incoming request regardless of which route eventually handles it — registering it after the routes would mean it never runs at all for requests that already matched and were handled earlier in the chain.',
              evaluationRubric: ['Confirms the actual registration order in their code', 'Explains why placement before routes is required, not stylistic', 'Understands middleware order is request-flow order, not declaration convenience'],
            },
            {
              pattern: 'error-handling',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'How many separate error-handling code paths exist across your route handlers — one centralized one, or several scattered try/catch blocks?',
              expectedAnswer: 'A single centralized error-handling middleware registered last, with every route relying on asyncHandler (or manual next(err) calls) to funnel into it — scattered per-route try/catch blocks duplicate formatting logic and are easy to get inconsistent across routes, which is exactly what the challenge\'s "error-handling:" requirement is checking against.',
              evaluationRubric: ['States the actual count/structure in their own code', 'Prefers and can justify one centralized handler over scattered try/catch', 'Connects this to the specific evaluation criterion'],
            },
          ],
          xpReward: 180,
          coinsReward: 90,
          skillMapping: { Express: 20, 'Error Handling': 20, Validation: 20 },
          difficulty: 'beginner',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a task manager REST API with request logging middleware, input validation, and a centralized error handler — no inline try/catch scattered in route handlers.',
            requirements: [
              'route:GET /tasks', 'route:POST /tasks', 'route:PATCH /tasks/:id', 'route:DELETE /tasks/:id',
              'validation:title', 'error-handling:',
            ],
            resources: [{ title: 'Error Handling · Express.js', url: 'https://expressjs.com/en/guide/error-handling.html', type: 'doc' }],
            hints: [
              'One centralized error-handling middleware, registered last, not per-route try/catch blocks',
              'A logging middleware should run for every request, registered before the routes',
            ],
            evaluationCriteria: [
              'A single centralized error handler exists and is used consistently',
              'Missing/invalid input returns a clear 400, not a crash or 500',
              'Logging middleware runs for every request',
            ],
            expectedSkills: ['Express', 'Error Handling', 'Validation'],
            difficulty: 'beginner',
            multiplier: 1.2,
            xp: 180,
            challengeType: 'career',
          },
        },
      ],
    },

    // ───────────────────────── Level 3 ─────────────────────────
    {
      levelNumber: 3,
      name: 'Databases & Prisma',
      description: 'Moving off in-memory arrays: real persistence with Prisma and a schema that models relationships.',
      difficulty: 'intermediate',
      estimatedDurationHours: 18,
      xpRequired: 500,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Schema Design & Prisma Basics',
          slug: 'prisma-schema-basics',
          description: 'Modeling data with a real schema and running CRUD operations through an ORM.',
          learningObjectives: [
            'Define a Prisma model with fields and a one-to-many relation',
            'Run migrations to apply a schema to a real database',
            'Perform create/read/update/delete operations through the Prisma client',
          ],
          videos: [{ title: 'Prisma 2 (Node JS ORM) Crash Course', url: 'https://www.youtube.com/watch?v=mU8-nKwfw4Y', type: 'video' }],
          officialDocs: [
            { title: 'Prisma schema reference', url: 'https://www.prisma.io/docs/orm/reference/prisma-schema-reference', type: 'doc' },
            { title: 'CRUD | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/queries/crud', type: 'doc' },
          ],
          notes: `An ORM (Object-Relational Mapper) lets you work with a database using JavaScript objects and method calls instead of hand-writing SQL. Prisma's schema.prisma file is the single source of truth: you define models (tables) and their fields/relations there, then run a migration to actually apply that schema to a real database.

A one-to-many relation — one Author has many Posts — is modeled with a foreign key on the "many" side: Post has an authorId field and an author relation back to Author; Author has a posts Post[] relation. Prisma generates a fully-typed client from this schema, so prisma.post.create({ data: { title, authorId } }) is type-checked against your actual schema at compile time, not discovered as a typo at runtime like raw SQL strings would be.

Moving from an in-memory array (Levels 1-2) to a real database is the actual point of this node: an in-memory array resets every time the server restarts and can't be queried, filtered, or related to other data efficiently — a database persists and lets the DB engine (not your JS code) do filtering/sorting/joining correctly and fast.`,
          cheatsheet: `// schema.prisma
model Author {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[]
}
model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int
  author   Author @relation(fields: [authorId], references: [id])
}

npx prisma migrate dev --name init   — apply schema changes to the DB
prisma.post.create({ data: { title, authorId } })
prisma.post.findMany({ where: { authorId } })
prisma.post.update({ where: { id }, data: { title } })
prisma.post.delete({ where: { id } })`,
          codeExamples: [
            {
              title: 'A one-to-many schema',
              language: 'prisma',
              code: `model Author {
  id    Int    @id @default(autoincrement())
  name  String
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  authorId Int
  author   Author @relation(fields: [authorId], references: [id])
}`,
            },
            {
              title: 'CRUD through the generated client',
              language: 'javascript',
              code: `const author = await prisma.author.create({ data: { name: 'Asha' } });
const post = await prisma.post.create({
  data: { title: 'Hello', authorId: author.id },
});
const posts = await prisma.post.findMany({ where: { authorId: author.id } });`,
            },
          ],
          quizQuestions: [
            { question: 'Where does a one-to-many relation\'s foreign key live?', options: ['On the "one" side (Author)', 'On the "many" side (Post), pointing back to Author', 'Split across both', 'Foreign keys are not needed with Prisma'], correctIndex: 1, explanation: 'The "many" side holds the foreign key (authorId on Post) — each post points to one author, not the other way around.' },
            { question: 'What is the main problem with the in-memory array approach used in Levels 1-2?', options: ['It is too fast', 'Data disappears on every server restart and cannot be efficiently queried/filtered/related', 'It requires more code to write', 'There is no real problem'], correctIndex: 1, explanation: 'No persistence across restarts and no real query capability — exactly what a database and an ORM like Prisma solve.' },
            { question: 'What does running a Prisma migration actually do?', options: ['Only updates the generated TypeScript types', 'Applies your schema.prisma changes to the real database, creating/altering tables', 'Deletes all existing data', 'Nothing, migrations are optional'], correctIndex: 1, explanation: 'A migration is the step that turns your schema file into actual DDL run against the database — skipping it means your code and your database are out of sync.' },
          ],
          miniProject: {
            title: 'Migrate the Book Catalog to Prisma',
            description: 'Take the Level 1 in-memory Book Catalog API and back it with a real Prisma schema + SQLite/Postgres database instead of an array.',
            requirements: ['A Book model exists in schema.prisma with a real migration applied', 'All CRUD routes now go through prisma.book.* calls, not an array'],
          },
          interviewBank: [
            {
              pattern: 'prisma\\.\\w+\\.(create|findMany|update|delete)',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Why model this relationship with a foreign key on Post rather than, say, storing an array of post ids on Author?',
              expectedAnswer: 'A foreign key on the many side is the standard relational pattern — it keeps a single, authoritative place for the relationship, avoids duplicated/out-of-sync arrays, and lets the database index and query the relation efficiently, which an array-of-ids field cannot do as well.',
              evaluationRubric: ['Explains why foreign-key-on-many is standard, not just "that is how Prisma does it"', 'Mentions query/indexing efficiency', 'Shows they understand the alternative and why it is worse here'],
            },
            {
              pattern: 'migrate dev',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'What is the actual difference between editing schema.prisma and running a migration versus just editing schema.prisma alone?',
              expectedAnswer: 'Editing the schema file only changes what your code and the generated client expect — it does not touch the real database at all; running a migration is the step that generates and applies the actual SQL (CREATE TABLE, ALTER TABLE, etc.) needed to make the live database structure match the new schema.',
              evaluationRubric: ['Correctly separates "schema file changed" from "database changed"', 'Names the migration as the step that applies real DDL', 'Would notice a mismatch if only the file were edited'],
            },
            {
              pattern: 'in-memory|array',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What specifically breaks about the Level 1 in-memory array approach once you try to add a real "posts belong to an author" relationship to it?',
              expectedAnswer: 'An in-memory array has no built-in way to enforce or efficiently query a relationship between two collections — you would end up manually looping to find matching ids yourself (slow, error-prone, and gets worse as data grows), whereas a real foreign key plus include lets the database engine do that matching correctly and efficiently.',
              evaluationRubric: ['Names the manual-lookup problem specifically, not just "arrays are bad"', 'Connects it to why the database engine is better suited to this', 'Acknowledges the array approach did work fine for the simpler Level 1-2 cases'],
            },
          ],
          xpReward: 130,
          coinsReward: 65,
          skillMapping: { Database: 30, 'Prisma/ORM': 20 },
          difficulty: 'intermediate',
          trustLevel: 'A',
          challenge: {
            objective: 'Migrate the Level 1 in-memory Book Catalog to a real Prisma schema and database — a Book model with a real migration applied, every CRUD route going through prisma.book.*.',
            requirements: ['table:Book', 'route:GET /books', 'route:POST /books'],
            resources: [{ title: 'Prisma schema reference', url: 'https://www.prisma.io/docs/orm/reference/prisma-schema-reference', type: 'doc' }],
            hints: [
              'Run an actual migration — editing schema.prisma alone does not touch the real database.',
              'Replace every array operation with the matching prisma.book.* call, not just the ones you remember to change.',
            ],
            evaluationCriteria: [
              'A Book model exists in schema.prisma with a real migration applied',
              'No route still reads/writes the old in-memory array',
            ],
            expectedSkills: ['Database', 'Prisma/ORM'],
            difficulty: 'intermediate',
            multiplier: 0.8,
            xp: 130,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'Relations, Filtering & Pagination',
          slug: 'prisma-relations-pagination',
          description: 'Real queries: including related data, filtering with where, and paginating large result sets.',
          learningObjectives: [
            'Fetch related data with include instead of separate manual queries',
            'Filter results with where clauses matching real query parameters',
            'Paginate results with skip/take instead of returning everything at once',
          ],
          videos: [{ title: 'Master Prisma ORM Node JS Integration', url: 'https://www.youtube.com/watch?v=f9e7KyyfbtU', type: 'video' }],
          officialDocs: [{ title: 'Pagination | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/queries/pagination', type: 'doc' }],
          notes: `prisma.author.findMany({ include: { posts: true } }) fetches authors WITH their related posts in one query — the alternative (fetch authors, then loop and fetch posts per author separately) is the classic "N+1 query" problem: 1 query becomes 1 + N queries, which gets slow fast as data grows. include is Prisma's fix for exactly that.

where clauses turn a query request-param (like ?authorId=3&published=true from Level 1-2's routing) directly into a filter: prisma.post.findMany({ where: { authorId: 3, published: true } }). This is where a well-designed REST API's query string (Level 1) meets the database layer — the API's filtering behavior should map cleanly onto real where clauses, not fetch everything and filter in JavaScript afterward (which defeats the point of a database).

Pagination with skip/take (or Prisma's cursor-based pagination for large datasets) prevents an endpoint like GET /posts from returning literally every row in the table — a real API returning thousands of rows on one request is a production incident waiting to happen, and this is exactly the kind of thing the "Production Readiness" AI Review dimension looks for on a capstone submission.`,
          cheatsheet: `prisma.author.findMany({ include: { posts: true } })       — fetch with relations, avoids N+1
prisma.post.findMany({ where: { authorId: 3, published: true } })  — filtered query
prisma.post.findMany({ skip: 20, take: 10 })                — page 3 of 10-per-page
prisma.post.count({ where: { authorId: 3 } })                — total count for pagination metadata`,
          codeExamples: [
            {
              title: 'Filtered, paginated, related query',
              language: 'javascript',
              code: `app.get('/posts', asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { published: true },
      include: { author: true },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where: { published: true } }),
  ]);

  res.json({ posts, total, page, totalPages: Math.ceil(total / limit) });
}));`,
            },
          ],
          quizQuestions: [
            { question: 'What is the "N+1 query" problem, and what Prisma feature avoids it?', options: ['Running exactly N+1 total requests, avoided with pagination', 'Fetching a list then querying related data separately per item, avoided with include', 'A database connection limit issue, avoided with a connection pool', 'Not a real problem'], correctIndex: 1, explanation: 'N+1 is fetching a parent list (1 query) then looping to fetch each item\'s related data separately (N more queries) — include fetches everything in one properly-joined query instead.' },
            { question: 'Why is returning every row of a large table in one API response a real problem?', options: ['It is not a problem', 'Large, unbounded responses are slow, memory-heavy, and a real production risk as data grows', 'JSON cannot hold large arrays', 'REST forbids large responses'], correctIndex: 1, explanation: 'An endpoint with no pagination degrades linearly (or worse) as the table grows — exactly the kind of thing that works fine in a demo and breaks in production.' },
            { question: 'What does skip: 20, take: 10 return?', options: ['The first 10 rows', 'Rows 21-30 (skip the first 20, then take the next 10)', 'The last 10 rows', 'An error'], correctIndex: 1, explanation: 'skip offsets past the first N rows, take limits how many come after that — classic page-3-of-10-per-page math.' },
          ],
          miniProject: {
            title: 'Paginated, filterable post list',
            description: 'GET /posts supporting ?page, ?limit, and ?authorId query params, using include to attach author data in one query.',
            requirements: ['Uses skip/take for real pagination, not slicing an array in JS after fetching everything', 'Response includes total count and page metadata'],
          },
          interviewBank: [
            {
              pattern: 'include:\\s*\\{',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What would your GET /posts endpoint do differently, performance-wise, if you removed the include and instead looped over posts fetching each author separately?',
              expectedAnswer: 'It would turn one query into 1 + N queries (one per post to fetch its author), which is slower and puts more load on the database as the result set grows — the N+1 problem that include is specifically designed to avoid by joining the relation in a single query.',
              evaluationRubric: ['Names the N+1 pattern specifically', 'Explains the performance impact concretely, not just "it is slower"', 'Confirms understanding of what include actually does under the hood'],
            },
            {
              pattern: 'skip:.*take:',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'For page 3 with a limit of 10 per page, what skip and take values does your code actually compute, and why?',
              expectedAnswer: 'skip: 20, take: 10 — skip is (page - 1) * limit, which skips the two full pages before page 3, and take is the page size itself; a common off-by-one bug is using page * limit for skip instead, which would incorrectly skip an extra page\'s worth of rows.',
              evaluationRubric: ['Correct arithmetic for the given page/limit', 'States the (page-1)*limit formula, not just the resulting numbers', 'Aware of the off-by-one variant of this bug'],
            },
            {
              pattern: 'where:\\s*\\{',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'If you fetched every post with findMany and then filtered by authorId in a JavaScript .filter() call afterward, what would be wrong with that compared to using a Prisma where clause?',
              expectedAnswer: 'It transfers every row from the database to the application first, wasting bandwidth and memory on rows that get thrown away, and cannot benefit from a database index on authorId — a where clause pushes the filtering down to the database engine, which is both faster and scales correctly as the table grows.',
              evaluationRubric: ['Names the over-fetching problem specifically', 'Mentions indexing as a reason the database does it better', 'Would not defend JS-side filtering as equivalent'],
            },
          ],
          xpReward: 130,
          coinsReward: 65,
          skillMapping: { Database: 25, 'Prisma/ORM': 25, 'API Design': 15 },
          difficulty: 'intermediate',
          trustLevel: 'B',
          challenge: {
            objective: 'Build GET /posts supporting ?page, ?limit, and ?authorId query params, using include to attach author data in a single query, with accurate total count and page metadata in the response.',
            requirements: ['route:GET /posts'],
            resources: [{ title: 'Pagination | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/queries/pagination', type: 'doc' }],
            hints: [
              'Use skip/take for real pagination — do not fetch everything and slice the array in JavaScript.',
              'total and totalPages should come from a separate count query using the same filter, not the current page\'s array length.',
            ],
            evaluationCriteria: [
              'Uses skip/take for real database-level pagination',
              'Response includes accurate total count and page metadata',
            ],
            expectedSkills: ['Database', 'Prisma/ORM', 'API Design'],
            difficulty: 'intermediate',
            multiplier: 0.8,
            xp: 130,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Challenge: Blog API',
          slug: 'challenge-blog-api',
          description: 'Integrated challenge for Level 3 — a blog API with real Prisma-backed authors/posts, filtering, and pagination.',
          learningObjectives: ['Apply schema design, relations, filtering, and pagination together in one real, submitted project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Level 3 integrated challenge (Part 4a). Complete it after Nodes 1 and 2.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'skip:.*take:',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Show me the schema relation between your Author and Post models, and explain why you modeled it that way.',
              expectedAnswer: 'A one-to-many with the foreign key (authorId) on Post, matching the real-world fact that one author writes many posts — this lets Prisma efficiently include related posts per author or the author per post in a single query.',
              evaluationRubric: ['Correctly describes their actual schema, not a generic answer', 'Explains the foreign-key placement reasoning', 'Can point to where include/where are used in their own routes'],
            },
            {
              pattern: 'totalPages|Math\\.ceil',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What would happen to your pagination metadata if you computed totalPages without a separate count query — say, from the length of the current page\'s results array?',
              expectedAnswer: 'That would be wrong for every page except possibly the last one — the current page\'s array length is always at most the page size (e.g. 10), it tells you nothing about how many total posts exist, so totalPages must come from a separate prisma.post.count() query against the same filter, not derived from the page you happen to be looking at.',
              evaluationRubric: ['Correctly identifies the bug (page length is not total count)', 'Names a separate count query as the fix', 'Confirms the count uses the same where filter as the main query'],
            },
            {
              pattern: 'authorId.*exists|findUnique.*author',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What happens in your POST /posts route if the client sends an authorId that does not correspond to any real author?',
              expectedAnswer: 'A correct implementation checks that the author actually exists before creating the post (or lets the database\'s foreign key constraint reject it) and returns a clear 400/404, rather than either creating an orphaned post with a dangling authorId or crashing with a raw database constraint error leaked to the client.',
              evaluationRubric: ['States what their actual code does for this case', 'Rejects both silent creation of an orphaned row and an unhandled crash', 'Names an appropriate status code for the response'],
            },
          ],
          xpReward: 220,
          coinsReward: 110,
          skillMapping: { Database: 20, 'Prisma/ORM': 25, 'API Design': 20, 'REST API': 15 },
          difficulty: 'intermediate',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a blog API with Author and Post models (Prisma), supporting filtered, paginated post listing with author data included.',
            requirements: [
              'table:Author', 'table:Post', 'db-relation:authorId',
              'route:GET /posts', 'route:POST /posts',
            ],
            resources: [{ title: 'Pagination | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/queries/pagination', type: 'doc' }],
            hints: [
              'Design the schema and run a real migration before writing any routes',
              'GET /posts should support page/limit query params using skip/take, not in-memory slicing',
            ],
            evaluationCriteria: [
              'Author-Post relation modeled correctly with a real migration applied',
              'GET /posts supports pagination and includes author data in one query',
              'Creating a post validates a valid authorId exists',
            ],
            expectedSkills: ['Database', 'Prisma/ORM', 'API Design', 'REST API'],
            difficulty: 'intermediate',
            multiplier: 1.5,
            xp: 220,
            challengeType: 'career',
          },
        },
      ],
    },

    // ───────────────────────── Level 4 ─────────────────────────
    {
      levelNumber: 4,
      name: 'Authentication & Security',
      description: 'Real user auth: password hashing, JWTs, and protecting routes server-side.',
      difficulty: 'advanced',
      estimatedDurationHours: 20,
      xpRequired: 1000,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Password Hashing & Registration',
          slug: 'auth-password-hashing',
          description: 'Never storing a plaintext password, and why bcrypt specifically.',
          learningObjectives: [
            'Explain why passwords must never be stored in plaintext',
            'Hash passwords with bcrypt on registration and verify them on login',
            'Understand what a salt is and why bcrypt handles it automatically',
          ],
          videos: [{ title: 'JWT Authentication | Node JS and Express tutorials', url: 'https://www.youtube.com/watch?v=favjC6EKFgw', type: 'video' }],
          officialDocs: [{ title: 'bcrypt - npm', url: 'https://www.npmjs.com/package/bcrypt', type: 'doc' }],
          notes: `Storing a plaintext password means a single database breach exposes every user's actual password — and since people reuse passwords across sites, that breach compromises accounts on other services too. Passwords must always be hashed before storage: a one-way function where you can verify a guess against the hash, but can't reverse the hash back to the original password.

bcrypt is the standard choice specifically because it's deliberately slow (tunable via a "cost factor/rounds" parameter) — that slowness is the point, since it makes brute-forcing every possible password prohibitively expensive, unlike a fast hash like plain SHA-256 which a modern GPU can brute-force at billions of attempts per second. bcrypt also automatically generates and embeds a random salt per password, so two users with the same password get completely different hashes, defeating precomputed "rainbow table" attacks.

Registration flow: hash the password with bcrypt.hash(password, 10) before saving the user. Login flow: fetch the user by email, then bcrypt.compare(providedPassword, storedHash) — never compare the raw password to the hash directly, and never log or return the password hash in any API response.`,
          cheatsheet: `const bcrypt = require('bcrypt');
const hash = await bcrypt.hash(password, 10);       — 10 = cost factor/rounds
const match = await bcrypt.compare(password, hash); — true/false, never string-compare hashes directly
Never store plaintext passwords, never return password hashes in API responses`,
          codeExamples: [
            {
              title: 'Registration and login with bcrypt',
              language: 'javascript',
              code: `app.post('/register', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  res.status(201).json({ id: user.id, email: user.email }); // never return passwordHash
}));

app.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // issue a token here — see the next node
}));`,
            },
          ],
          quizQuestions: [
            { question: 'Why is a fast hash function like plain SHA-256 a bad choice for passwords, even though it is a real one-way hash?', options: ['It is not actually one-way', 'Its speed makes brute-forcing every possible password computationally cheap for an attacker', 'It does not exist in Node', 'There is no real reason'], correctIndex: 1, explanation: 'bcrypt is deliberately slow and tunable specifically to make brute-force attacks expensive — a fast hash makes that attack cheap.' },
            { question: 'What does bcrypt automatically handle that a plain hash function does not?', options: ['Encryption', 'A random per-password salt, preventing identical passwords from producing identical hashes', 'Compression', 'Database storage'], correctIndex: 1, explanation: 'The embedded salt means two users with "password123" get completely different hashes, defeating precomputed rainbow-table attacks.' },
            { question: 'What should a registration endpoint\'s response include about the new user?', options: ['The password hash, for debugging', 'The plaintext password, for confirmation', 'Never the password or its hash — only non-sensitive fields like id/email', 'Nothing at all'], correctIndex: 2, explanation: 'A password hash should never leave the server in an API response — even the hash itself is sensitive and should stay server-side only.' },
          ],
          miniProject: {
            title: 'Registration endpoint with real hashing',
            description: 'POST /register that hashes the password with bcrypt, rejects duplicate emails, and never returns the hash in its response.',
            requirements: ['Uses bcrypt.hash, not a plaintext or custom hash', 'Duplicate email returns a clear 409/400, not a raw database error', 'Response never includes the password or hash'],
          },
          interviewBank: [
            {
              pattern: 'bcrypt\\.(hash|compare)',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Why bcrypt.compare instead of hashing the login password again and string-comparing the two hashes?',
              expectedAnswer: 'bcrypt.compare correctly extracts the salt embedded in the stored hash and re-hashes the candidate password with that same salt before comparing — hashing independently with a new random salt would never match even for the correct password.',
              evaluationRubric: ['Explains the salt-extraction mechanism specifically', 'Does not just say "it is the right function to use"', 'Understands why naive re-hash-and-compare would be broken'],
            },
            {
              pattern: 'cost factor|rounds|bcrypt\\.hash\\(.*,\\s*\\d',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'You called bcrypt.hash(password, 10). What does that second argument actually control, and what happens if you set it much higher, like 20?',
              expectedAnswer: 'It is the cost factor — each increment roughly doubles the computation time per hash; a higher value makes both legitimate logins and brute-force attempts slower, which is the entire point, but set too high it can meaningfully slow down real user logins and server throughput, so it is a genuine tradeoff, not "higher is free".',
              evaluationRubric: ['Correctly identifies it as the cost/work factor, not a salt length or similar', 'Explains the exponential-ish time cost as rounds increase', 'Recognizes the real tradeoff at very high values'],
            },
            {
              pattern: 'res\\.status\\(201\\)|passwordHash',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'If I intercepted the response from your registration endpoint, would I see the user\'s password or its hash anywhere in it?',
              expectedAnswer: 'No — the response should only include non-sensitive fields like id and email; returning the passwordHash (even though it is not the plaintext password) is still a real information leak, since it gives an attacker material to brute-force offline, and there is never a legitimate reason for a client to receive it.',
              evaluationRubric: ['Confirms neither plaintext nor hash appears in their actual response', 'Explains why leaking even the hash is a real risk, not just "it is a habit"'],
            },
          ],
          xpReward: 150,
          coinsReward: 75,
          skillMapping: { Authentication: 30, Security: 20 },
          difficulty: 'advanced',
          trustLevel: 'B',
          challenge: {
            objective: 'Build POST /register that hashes the password with bcrypt, rejects a duplicate email cleanly, and never returns the password or its hash in the response.',
            requirements: ['route:POST /register', 'validation:email', 'auth:bcrypt'],
            resources: [{ title: 'bcrypt - npm', url: 'https://www.npmjs.com/package/bcrypt', type: 'doc' }],
            hints: [
              'Use bcrypt.hash, not a custom or plaintext scheme.',
              'A duplicate email should return a clean 409/400, not a raw database constraint error leaking through.',
            ],
            evaluationCriteria: [
              'Password is hashed with bcrypt before storage',
              'The response never includes the password or its hash',
            ],
            expectedSkills: ['Authentication', 'Security'],
            difficulty: 'advanced',
            multiplier: 1.0,
            xp: 150,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'JWTs & Protected Routes',
          slug: 'auth-jwt-protected-routes',
          description: 'Issuing a JWT on login and building real server-side auth middleware.',
          learningObjectives: [
            'Issue a signed JWT on successful login containing the minimum necessary claims',
            'Write auth middleware that verifies a JWT and attaches the user to req',
            'Explain what a JWT protects against and what it does not',
          ],
          videos: [{ title: 'JWT Authentication | Node JS and Express tutorials', url: 'https://www.youtube.com/watch?v=favjC6EKFgw', type: 'video' }],
          officialDocs: [{ title: 'jsonwebtoken - npm', url: 'https://www.npmjs.com/package/jsonwebtoken', type: 'doc' }],
          notes: `A JWT is a signed (not encrypted) token: header.payload.signature, base64-encoded. The payload — e.g. { userId, email, exp } — is readable by anyone who has the token, so never put a password or sensitive secret in it; the signature is what proves it wasn't tampered with, verified against a server-side secret the client never sees.

On login: jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' }) creates the token to return. Auth middleware on protected routes: read the Authorization: Bearer <token> header, jwt.verify(token, process.env.JWT_SECRET) — this throws if the signature is invalid or the token is expired, which your middleware should catch and respond with 401, not crash the server.

Crucially: a valid signature only proves the token was issued by your server and hasn't been altered — it says nothing about whether the specific user is still allowed to do a specific thing, which is why route-level authorization checks (is this user an admin? do they own this resource?) still happen separately, after authentication succeeds.`,
          cheatsheet: `const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1]; // "Bearer <token>"
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
app.get('/me', requireAuth, (req, res) => res.json(req.user));`,
          codeExamples: [
            {
              title: 'Full login → protected route flow',
              language: 'javascript',
              code: `app.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
}));

function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

app.get('/orders', requireAuth, asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({ where: { userId: req.user.userId } });
  res.json(orders);
}));`,
            },
          ],
          quizQuestions: [
            { question: 'Can anyone who intercepts a JWT read its payload contents?', options: ['No, it is encrypted', 'Yes — the payload is only base64-encoded and signed, not encrypted, so it is readable by anyone with the token', 'Only the server can read it', 'Only if they have the secret'], correctIndex: 1, explanation: 'JWT payloads are readable, not secret — the signature proves authenticity/integrity, it does not hide the contents. Never put secrets in the payload.' },
            { question: 'What does a valid JWT signature actually prove?', options: ['The user is authorized to perform any action', 'The token was issued by the server and has not been tampered with — nothing more', 'The user\'s password', 'The token will never expire'], correctIndex: 1, explanation: 'Authentication (who issued/who you are) and authorization (what you are allowed to do) are separate concerns — a valid token only establishes the former.' },
            { question: 'In requireAuth, why is jwt.verify wrapped in a try/catch?', options: ['It is not necessary', 'jwt.verify throws for an invalid signature or expired token — uncaught, this would crash the request instead of returning a clean 401', 'try/catch improves performance', 'jwt.verify never throws'], correctIndex: 1, explanation: 'jwt.verify throws synchronously on bad/expired tokens — without a catch, that becomes an unhandled exception instead of a controlled 401 response.' },
          ],
          miniProject: {
            title: 'Full login + protected /me route',
            description: 'POST /login issuing a JWT, and GET /me returning the authenticated user\'s data, rejecting requests with no or an invalid token.',
            requirements: ['Token issued with a real expiry, not infinite', 'requireAuth middleware correctly rejects missing and invalid tokens with 401'],
          },
          interviewBank: [
            {
              pattern: 'jwt\\.verify',
              difficulty: 'hard',
              experienceLevel: 'mid',
              question: 'A user\'s account gets suspended. Their existing JWT is still technically valid and unexpired — what happens when they use it, and how would you actually stop them?',
              expectedAnswer: 'A stateless JWT alone cannot be individually revoked before expiry — the middleware would still accept it as valid; the real fix is checking account status (a DB lookup) inside requireAuth, or maintaining a token blocklist/short expiry with refresh tokens, since JWT validity alone is not the same as "still allowed access."',
              evaluationRubric: ['Correctly identifies that a valid JWT does not mean the account is still in good standing', 'Proposes a concrete real fix (status check or blocklist/short-lived tokens)', 'Does not claim JWTs are individually revocable by default'],
            },
            {
              pattern: 'jwt\\.sign\\(\\{',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Would you put the user\'s password hash inside the JWT payload alongside userId? Why or why not?',
              expectedAnswer: 'No — the payload is only base64-encoded, not encrypted, so anyone holding the token (including the client it was issued to, and anyone who intercepts it) can read every field in it; the payload should carry only the minimum needed to identify the user (like userId), never a secret or sensitive credential.',
              evaluationRubric: ['Correctly says no, and explains payload is readable not secret', 'Names the minimum-necessary-claims principle', 'Would flag any sensitive field, not just password hash specifically'],
            },
            {
              pattern: 'try \\{[\\s\\S]*jwt\\.verify',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What specific errors does jwt.verify throw, and does your middleware treat an expired token differently from a tampered/invalid one?',
              expectedAnswer: 'jwt.verify throws TokenExpiredError for an expired token and JsonWebTokenError for a bad signature or malformed token; many implementations respond 401 to both identically, which is acceptable for basic auth, but a more polished API might distinguish them to tell the client whether a token refresh could fix it versus requiring a fresh login entirely.',
              evaluationRubric: ['Names at least the expired-vs-invalid distinction conceptually', 'Confirms both are caught, not just one', 'Bonus: aware of the different error types jsonwebtoken actually throws'],
            },
          ],
          xpReward: 150,
          coinsReward: 75,
          skillMapping: { Authentication: 30, Security: 20, 'REST API': 10 },
          difficulty: 'advanced',
          trustLevel: 'B',
          challenge: {
            objective: 'Build POST /login issuing a JWT with a real expiry, and GET /me returning the authenticated user\'s data — rejecting requests with a missing or invalid token.',
            requirements: ['route:POST /login', 'route:GET /me', 'auth:jwt'],
            resources: [{ title: 'jsonwebtoken - npm', url: 'https://www.npmjs.com/package/jsonwebtoken', type: 'doc' }],
            hints: [
              'Issue the token with a real expiresIn, not an infinite/no-expiry token.',
              'requireAuth should return 401 for both a missing token and an invalid/expired one — never crash the server.',
            ],
            evaluationCriteria: [
              'A valid token is required to reach GET /me',
              'Missing and invalid tokens are both rejected with 401, not a crash',
            ],
            expectedSkills: ['Authentication', 'Security', 'REST API'],
            difficulty: 'advanced',
            multiplier: 1.0,
            xp: 150,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Challenge: Authenticated Orders API',
          slug: 'challenge-authenticated-orders-api',
          description: 'Integrated challenge for Level 4 — a JWT-authenticated API where users can only see and manage their own data.',
          learningObjectives: ['Apply password hashing, JWT issuance, and protected/ownership-checked routes together in one real, submitted project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Level 4 integrated challenge (Part 4a), and this level\'s Milestone Project. Complete it after Nodes 1 and 2.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'req\\.user\\.userId',
              difficulty: 'hard',
              experienceLevel: 'mid',
              question: 'Two logged-in users both hit GET /orders/5, an order that belongs to user A. What happens for user B?',
              expectedAnswer: 'Authentication alone (a valid JWT) is not enough — the route must separately check that the order\'s userId matches req.user.userId from the token, returning 403/404 for user B rather than leaking user A\'s order data just because they have a valid token.',
              evaluationRubric: ['Correctly distinguishes authentication from ownership authorization', 'Confirms this check actually exists in their submitted code, not just in theory', 'Names an appropriate status code for the denial'],
            },
            {
              pattern: 'bcrypt\\.hash',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'Walk me through what your /register route does with the raw password from the request body, start to finish.',
              expectedAnswer: 'It is never stored or logged as-is — bcrypt.hash() runs on it to produce a salted hash, only that hash is written to the database via prisma.user.create, and the plaintext password value is discarded once the hash exists; the response back to the client includes neither the password nor the hash.',
              evaluationRubric: ['Confirms the plaintext is never persisted anywhere', 'Correctly places hashing before the database write', 'Confirms the response excludes both password and hash'],
            },
            {
              pattern: 'expiresIn',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Your token is issued with expiresIn: "7d". What is the tradeoff of that particular duration, versus something like "15m"?',
              expectedAnswer: 'A longer expiry means fewer re-logins for the user but a bigger window during which a stolen token remains usable; a short expiry limits that exposure window significantly but requires either frequent re-authentication or a refresh-token mechanism to keep the user logged in seamlessly — 7 days is a reasonable simple default for this track\'s scope, but a real answer should name the actual tradeoff, not just the number chosen.',
              evaluationRubric: ['Names the security-window vs UX tradeoff specifically', 'Does not claim their chosen duration has no downside', 'Aware refresh tokens are the standard way to get both short-lived security and long sessions'],
            },
          ],
          xpReward: 260,
          coinsReward: 130,
          skillMapping: { Authentication: 25, Security: 20, 'REST API': 15, 'Database': 15, 'Error Handling': 10 },
          difficulty: 'advanced',
          trustLevel: 'B',
          challenge: {
            objective: 'Build an orders API where users register/login, receive a JWT, and can only view/manage their own orders — never another user\'s.',
            requirements: [
              'route:POST /register', 'route:POST /login', 'route:GET /orders',
              'auth:Authorization', 'table:User', 'table:Order', 'db-relation:userId',
            ],
            resources: [{ title: 'jsonwebtoken - npm', url: 'https://www.npmjs.com/package/jsonwebtoken', type: 'doc' }],
            hints: [
              'Passwords hashed with bcrypt, never stored or returned in plaintext',
              'Every order route must check ownership (order.userId === req.user.userId), not just require any valid token',
            ],
            evaluationCriteria: [
              'Registration hashes passwords correctly, login issues a valid JWT',
              'Protected routes reject missing/invalid tokens with 401',
              'A user cannot access another user\'s orders even with a valid token of their own',
            ],
            expectedSkills: ['Authentication', 'Security', 'REST API', 'Database'],
            difficulty: 'advanced',
            multiplier: 1.8,
            xp: 260,
            challengeType: 'milestone',
          },
        },
      ],
    },

    // ───────────────────────── Level 5 ─────────────────────────
    {
      levelNumber: 5,
      name: 'Production Readiness & Capstone',
      description: 'What separates a working API from one that would survive real traffic — config, and a final capstone.',
      difficulty: 'professional',
      estimatedDurationHours: 24,
      xpRequired: 2000,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Environment Config & Input Sanitization',
          slug: 'backend-production-config',
          description: 'Secrets out of code, config out of code, and defending against malformed/malicious input.',
          learningObjectives: [
            'Move all secrets and environment-specific config out of source code into environment variables',
            'Validate and sanitize input at the API boundary, not deep inside business logic',
            'Understand basic rate-limiting and why an unprotected API is a real liability',
          ],
          videos: [],
          officialDocs: [
            { title: 'dotenv - npm', url: 'https://www.npmjs.com/package/dotenv', type: 'doc' },
            { title: 'Security Best Practices · Express.js', url: 'https://expressjs.com/en/advanced/best-practice-security.html', type: 'doc' },
          ],
          notes: `A JWT_SECRET, database URL, or API key hardcoded in source code is both a security risk (it ends up in git history, forever, even if "removed" later) and an operational one (can't differ between dev/staging/prod without editing code). require('dotenv').config() loads a .env file into process.env in development; production environments set real environment variables instead — the .env file itself should always be gitignored, never committed.

Input validation at the API boundary (checking types, required fields, formats before anything else runs) is what this track's "validation:" requirements have been checking for since Level 2 — by this point it should be a reflex, not an afterthought, applied consistently across every route, not just the ones that happened to get tested.

A basic rate limiter (even a simple in-memory per-IP counter, or the express-rate-limit package) protects against both accidental abuse (a buggy client retrying in a loop) and deliberate abuse — an API with zero rate limiting on, say, a login endpoint is directly vulnerable to password brute-forcing at whatever speed the attacker's script can send requests.`,
          cheatsheet: `require('dotenv').config();           — load .env into process.env (dev only, gitignore the file)
process.env.JWT_SECRET                — never hardcode secrets
process.env.DATABASE_URL               — never hardcode connection strings

// Basic per-IP rate limit sketch
const attempts = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const count = (attempts.get(ip) || 0) + 1;
  attempts.set(ip, count);
  if (count > 5) return res.status(429).json({ error: 'Too many requests' });
  next();
}`,
          codeExamples: [
            {
              title: 'Config loaded from environment, never hardcoded',
              language: 'javascript',
              code: `require('dotenv').config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}`,
            },
            {
              title: 'Rate-limiting a sensitive route',
              language: 'javascript',
              code: `const loginAttempts = new Map();

function rateLimitLogin(req, res, next) {
  const key = req.ip;
  const count = (loginAttempts.get(key) || 0) + 1;
  loginAttempts.set(key, count);
  setTimeout(() => loginAttempts.set(key, Math.max(0, (loginAttempts.get(key) || 1) - 1)), 60000);
  if (count > 5) {
    return res.status(429).json({ error: 'Too many login attempts, try again later' });
  }
  next();
}

app.post('/login', rateLimitLogin, asyncHandler(async (req, res) => { ... }));`,
            },
          ],
          quizQuestions: [
            { question: 'Why is committing a .env file with real secrets to git a serious problem even if you delete it in a later commit?', options: ['It is not a problem once deleted', 'Git history retains old commits — the secret remains recoverable from history even after deletion', 'git ignores .env files automatically', '.env files cannot contain secrets'], correctIndex: 1, explanation: 'Deleting a file in a new commit does not erase it from history — anyone with repo access (or a public repo) can still find the secret in an old commit.' },
            { question: 'What is the specific risk of an unprotected /login endpoint with no rate limiting?', options: ['Slower response times', 'An attacker can attempt unlimited password guesses at whatever speed their script allows', 'Higher hosting costs only', 'No real risk'], correctIndex: 1, explanation: 'Without a limit on attempts, brute-forcing passwords becomes a matter of raw request speed rather than something meaningfully defended against.' },
            { question: 'Where should input validation happen relative to business logic?', options: ['After, as a final check', 'At the API boundary, before business logic or database writes run', 'It does not matter', 'Only on the frontend'], correctIndex: 1, explanation: 'Validating first means invalid input is rejected cleanly before any side effects (writes, external calls) happen — validating late risks partial/inconsistent state.' },
          ],
          miniProject: {
            title: 'Harden the Orders API',
            description: 'Take the Level 4 capstone project, move every secret to environment variables, and add basic rate limiting to the login route.',
            requirements: ['No hardcoded secrets remain anywhere in the codebase', 'Login route rejects excessive attempts from the same IP with 429'],
          },
          interviewBank: [
            {
              pattern: 'process\\.env\\.',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What would happen right now if JWT_SECRET were missing from the environment when your server starts?',
              expectedAnswer: 'A well-written server should fail fast and loudly at startup — throwing a clear error before accepting any traffic — rather than silently running with an undefined secret, which would make every issued token trivially forgeable or cause every verification to fail unpredictably.',
              evaluationRubric: ['Confirms their actual code fails fast, not silently continues', 'Explains why a missing/undefined secret is dangerous, not just inconvenient', 'Bonus: distinguishes this from a config value with a safe default'],
            },
            {
              pattern: '\\.gitignore|\\.env',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'You deleted a .env file containing a real secret from your repo two commits ago. Is that secret actually gone now?',
              expectedAnswer: 'No — git history retains the full content of every prior commit, so the secret is still recoverable by anyone with repo access (or anyone who ever cloned it) by checking out or diffing the old commit, even though the file is absent from the current working tree; the correct response to a leaked secret is rotating it, not just deleting the file.',
              evaluationRubric: ['Correctly says the secret is still recoverable from history', 'Names checking out/browsing old commits as how it would be recovered', 'States rotation as the actual required remediation'],
            },
            {
              pattern: 'rate.?limit|429',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Your rate limiter tracks attempts per IP address. What is a real-world scenario where that specific design falls short?',
              expectedAnswer: 'Multiple legitimate users behind the same NAT/corporate network or VPN share one public IP, so one person\'s excessive (or malicious) requests can lock out everyone else on that IP; conversely, a distributed attacker using many different IPs can bypass a per-IP limit entirely — per-account rate limiting (in addition to or instead of per-IP) addresses the first problem, though not the second on its own.',
              evaluationRubric: ['Names the shared-IP false-positive scenario specifically', 'Recognizes per-IP limiting does not stop a distributed attacker', 'Proposes a concrete complementary approach, not just "it is imperfect"'],
            },
          ],
          xpReward: 160,
          coinsReward: 80,
          skillMapping: { Security: 25, Configuration: 20, 'Production Readiness': 25 },
          difficulty: 'professional',
          trustLevel: 'B',
          challenge: {
            objective: 'Move every secret and environment-specific value into environment variables, and add a basic rate limiter to the login route.',
            requirements: ['env:JWT_SECRET', 'error-handling:'],
            resources: [{ title: 'dotenv - npm', url: 'https://www.npmjs.com/package/dotenv', type: 'doc' }],
            hints: [
              'No secret or connection string should appear as a literal string anywhere in the code.',
              'A simple in-memory per-IP counter is enough — reject with 429 once a threshold is exceeded.',
            ],
            evaluationCriteria: [
              'No hardcoded secrets remain anywhere in the codebase',
              'The login route rejects excessive attempts from the same IP with 429',
            ],
            expectedSkills: ['Security', 'Configuration', 'Production Readiness'],
            difficulty: 'professional',
            multiplier: 1.0,
            xp: 160,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'Testing & API Documentation',
          slug: 'backend-testing-documentation',
          description: 'Proving your API works with real automated tests, and documenting it so someone else could actually use it.',
          learningObjectives: [
            'Write an automated test for at least one route\'s success and failure paths',
            'Document an API\'s endpoints clearly enough for another developer to integrate against it',
            'Understand the difference between manually testing in Postman and having a repeatable test suite',
          ],
          videos: [],
          officialDocs: [{ title: 'Supertest - npm', url: 'https://www.npmjs.com/package/supertest', type: 'doc' }],
          notes: `Manually clicking through Postman proves an endpoint works right now, for the exact input you tried — it proves nothing about what happens after the next change, and nothing about the inputs you didn't think to try. An automated test (using something like Jest + Supertest to make real requests against your Express app) is what actually catches a regression the next time someone edits that route.

A minimal real test checks both the success path (valid input → correct status + shape) AND at least one failure path (missing required field → 400, not a crash) — this is exactly what this track's Unit Tests validator stage is running against a submission.

Documentation doesn't need to be elaborate for Phase 1 — a clear README section per endpoint (method, path, required body/params, example response, possible error codes) is what separates "it works on my machine" from something a teammate or a future you could actually integrate against without reading the source.`,
          cheatsheet: `const request = require('supertest');
const app = require('../app');

test('POST /books creates a book', async () => {
  const res = await request(app).post('/books').send({ title: 'Dune' });
  expect(res.status).toBe(201);
  expect(res.body.title).toBe('Dune');
});

test('POST /books rejects missing title', async () => {
  const res = await request(app).post('/books').send({});
  expect(res.status).toBe(400);
});`,
          codeExamples: [
            {
              title: 'Success + failure path tests',
              language: 'javascript',
              code: `const request = require('supertest');
const app = require('../app');

describe('POST /tasks', () => {
  test('creates a task with valid input', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Ship it' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Ship it');
  });

  test('rejects a request with no title', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});`,
            },
          ],
          quizQuestions: [
            { question: 'What does a manual Postman test prove that an automated test does not, and vice versa?', options: ['They prove exactly the same thing', 'Postman proves it works right now for that one input; an automated test proves it repeatedly, for defined cases, on every future change', 'Postman is strictly better', 'Automated tests cannot check status codes'], correctIndex: 1, explanation: 'The real value of an automated suite is repeatability across changes — Postman only tells you about the single moment you ran it.' },
            { question: 'Why test a failure path (e.g. missing required field) in addition to the success path?', options: ['It is not necessary if the success path works', 'Because real clients send bad input, and the test proves the API fails safely (400, not a crash) rather than assuming it', 'Failure paths cannot be tested', 'Only for security-critical routes'], correctIndex: 1, explanation: 'Untested failure paths are exactly where bugs (unhandled crashes, wrong status codes, leaked errors) hide — the success path being tested tells you nothing about them.' },
            { question: 'What is the minimum useful content for documenting one API endpoint?', options: ['Just the URL', 'Method, path, required body/params, an example response, and possible error codes', 'A full OpenAPI spec is mandatory even for a small project', 'Documentation is optional for Phase 1'], correctIndex: 1, explanation: 'That minimum set is what actually lets another developer integrate against the endpoint without reading your source code.' },
          ],
          miniProject: {
            title: 'Test suite for the Orders API',
            description: 'Add Supertest-based tests for the login and orders-ownership behavior from Level 4 — including the case where user B tries user A\'s order.',
            requirements: ['At least one success-path and one failure-path test per tested route', 'The cross-user ownership rejection from Level 4 is explicitly tested, not just implemented'],
          },
          interviewBank: [
            {
              pattern: 'describe\\(|test\\(',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Walk me through one of your tests — what is it actually asserting, and what would make it fail?',
              expectedAnswer: 'A concrete trace through a real test: what request it sends, what status/body it expects, and specifically what code change would break that assertion — demonstrating the test is meaningfully checking behavior, not just asserting something trivially true.',
              evaluationRubric: ['Picks and explains a real test from their submission, not a hypothetical', 'Can name a concrete change that would break it', 'Understands the assertion is checking behavior, not just "the code ran"'],
            },
            {
              pattern: 'expect\\(res\\.status\\)\\.toBe\\(400\\)',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Why write an explicit test for the missing-title 400 case instead of just trusting that the validation code you already wrote handles it?',
              expectedAnswer: 'Code that "should" handle a case is not the same as code proven to handle it — a test locks in that behavior so a future refactor of the validation logic gets caught immediately if it accidentally breaks this path, rather than the regression only surfacing later in production against a real user.',
              evaluationRubric: ['Names regression protection as the actual value, not just "good practice"', 'Distinguishes "should work" from "proven to work"', 'Gives a believable scenario for how this specific test would later save someone'],
            },
            {
              pattern: 'README|documentation',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'A new teammate needs to integrate against your API tomorrow and has never seen the code. What can they learn from your documentation alone, without reading source?',
              expectedAnswer: 'For each endpoint: the method and path, what body/params it expects, an example successful response, and the error codes/shapes it can return — enough for them to write working client code against the documentation alone, without needing to trace through the actual route handler source to guess the contract.',
              evaluationRubric: ['Names the concrete minimum content set, not just "good docs"', 'States the test is whether someone could integrate without reading source', 'Confirms their own documentation actually meets this bar'],
            },
          ],
          xpReward: 160,
          coinsReward: 80,
          skillMapping: { Testing: 30, Documentation: 20, 'Production Readiness': 15 },
          difficulty: 'professional',
          trustLevel: 'B',
          challenge: {
            objective: 'Write Supertest-based tests for the Level 4 login and orders-ownership behavior, including the case where one user tries to access another user\'s order.',
            requirements: ['error-handling:'],
            resources: [{ title: 'Supertest - npm', url: 'https://www.npmjs.com/package/supertest', type: 'doc' }],
            hints: [
              'Test both the success path and at least one failure path per route, not just the happy case.',
              'Explicitly test the cross-user ownership rejection — do not just assume the Level 4 implementation covers it.',
            ],
            evaluationCriteria: [
              'At least one success-path and one failure-path test per tested route',
              'The cross-user ownership rejection is explicitly tested, not just implemented',
            ],
            expectedSkills: ['Testing', 'Documentation', 'Production Readiness'],
            difficulty: 'professional',
            multiplier: 1.0,
            xp: 160,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Capstone: Production-Ready Orders Platform',
          slug: 'capstone-production-ready-orders-platform',
          description: 'Track capstone — a complete, authenticated, tested, documented API combining everything from Levels 1-5. Recruiter-ready.',
          learningObjectives: ['Combine schema design, auth, error handling, testing, and production config into one real, recruiter-facing project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Backend Developer track Capstone (Part 4a), the heaviest-weighted challenge in the track and the headline project for the future Career Passport.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'requireAuth',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'A teammate says your API is "not production ready" after reviewing it. Defend it, or tell me what you would add before agreeing to ship.',
              expectedAnswer: 'A strong answer walks through what is actually present (env-based secrets, centralized error handling, input validation, ownership-checked auth, tests, rate limiting) and honestly names what is genuinely still missing for a real production deploy (e.g. structured logging, monitoring/alerting, a real deployment pipeline, load testing) rather than either over-claiming completeness or vaguely agreeing without specifics.',
              evaluationRubric: ['Gives a specific, honest inventory of what is and is not covered', 'Does not claim the project is "fully production ready" with no caveats', 'Names at least one genuine gap beyond what this track covers'],
            },
            {
              pattern: 'order\\.userId|req\\.user\\.userId',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'Walk me through every single layer that stands between an attacker with someone else\'s stolen-but-valid JWT and that user\'s private order data.',
              expectedAnswer: 'The token must pass jwt.verify (correct signature, not expired) to reach requireAuth at all; then every order route independently checks that the specific order\'s userId matches req.user.userId from the token before returning or mutating anything — a stolen valid token gets past authentication but still cannot read or modify another user\'s orders, because authorization is enforced per-resource, not assumed from a valid token alone.',
              evaluationRubric: ['Correctly separates the authentication layer from the per-resource authorization layer', 'Confirms the ownership check happens on every relevant route, not just one', 'Does not claim a valid token alone is sufficient protection'],
            },
            {
              pattern: 'test\\(|describe\\(',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'If I deleted your entire test suite right now, what would you have no way of proving about this API anymore?',
              expectedAnswer: 'Without the tests, there would be no automated, repeatable proof that the cross-user ownership rejection, the validation failure paths, and the auth flow actually work as claimed — you would be back to manual, one-off verification that gives no protection against the next person\'s change silently breaking one of those guarantees.',
              evaluationRubric: ['Names specific behaviors the tests are the only proof of, not a vague "quality" answer', 'Connects this to regression protection over time, not just current correctness', 'Shows awareness of which of their own tests cover the highest-risk behaviors (ownership, auth)'],
            },
          ],
          xpReward: 400,
          coinsReward: 200,
          skillMapping: { Authentication: 15, Security: 15, 'REST API': 15, Database: 15, 'Error Handling': 10, Testing: 15, 'Production Readiness': 15 },
          difficulty: 'professional',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a complete orders platform API: auth, ownership-checked routes, centralized error handling, env-based config, rate limiting on login, and an automated test suite covering success and failure paths.',
            requirements: [
              'route:POST /register', 'route:POST /login', 'route:GET /orders', 'route:POST /orders',
              'auth:Authorization', 'error-handling:', 'env:JWT_SECRET', 'env:DATABASE_URL',
              'table:User', 'table:Order', 'db-relation:userId',
            ],
            resources: [
              { title: 'Security Best Practices · Express.js', url: 'https://expressjs.com/en/advanced/best-practice-security.html', type: 'doc' },
              { title: 'Supertest - npm', url: 'https://www.npmjs.com/package/supertest', type: 'doc' },
            ],
            hints: [
              'This is the track capstone — the Verification Engine\'s AI Review stage specifically evaluates business/production readiness on this challenge, not just whether it runs',
              'Include tests for the cross-user ownership rejection explicitly, it is one of the most commonly-skipped cases',
            ],
            evaluationCriteria: [
              'No hardcoded secrets anywhere in the codebase',
              'A user cannot access or modify another user\'s orders under any circumstance',
              'Centralized error handling covers every route, no scattered inline try/catch',
              'A real automated test suite exists covering at least success and failure paths for auth and orders',
            ],
            expectedSkills: ['Authentication', 'Security', 'REST API', 'Database', 'Testing', 'Production Readiness'],
            difficulty: 'professional',
            multiplier: 2.2,
            xp: 400,
            challengeType: 'capstone',
          },
        },
      ],
    },

    // ═══════════════════ MILESTONE 1 (Levels 6–10): Professional Backend Engineering ═══════════════════

    // ───────────────────────── Level 6 ─────────────────────────
    {
      levelNumber: 6,
      name: 'TypeScript for Node & Express',
      description: 'Typing requests, responses, and Prisma usage — catching a whole class of bug before the server ever starts.',
      difficulty: 'expert',
      estimatedDurationHours: 18,
      xpRequired: 2500,
      nodes: [
        {
          nodeNumber: 1,
          title: 'TypeScript for Node & Express',
          slug: 'typescript-for-node-express',
          description: 'Typed request handlers, DTOs for request bodies, and typed Prisma queries — migrating a JS Express app to strict TS.',
          learningObjectives: [
            'Type Express request/response handlers using Request<Params, ResBody, ReqBody>',
            'Define DTOs (Data Transfer Objects) for request bodies instead of trusting `any`',
            'Use Prisma\'s generated types so a schema change surfaces as compile errors, not runtime surprises',
          ],
          videos: [{ title: 'Express + TypeScript Setup Tutorial', url: 'https://www.youtube.com/watch?v=iF1Fu-DCyOw', type: 'video' }],
          officialDocs: [
            { title: 'TypeScript: Documentation', url: 'https://www.typescriptlang.org/docs/', type: 'doc' },
            { title: '@types/express - npm', url: 'https://www.npmjs.com/package/@types/express', type: 'doc' },
          ],
          notes: `Express's Request type accepts generics: Request<Params, ResBody, ReqBody> lets you type req.params, the response shape, and req.body all at once — (req: Request<{ id: string }, Book, CreateBookDto>, res: Response<Book>) means req.params.id is known to be a string, req.body is known to be a CreateBookDto, and res.json() is checked against Book.

A DTO (Data Transfer Object) is just an interface or class describing exactly what a request body should look like: interface CreateBookDto { title: string; authorId: number }. Without one, req.body is typed as \`any\` by default — every property access on it is unchecked, and a typo like req.body.titel silently returns undefined instead of erroring at compile time. Defining the DTO turns that same typo into an immediate, caught compiler error.

Prisma already generates full TypeScript types from your schema.prisma — prisma.book.create({ data: {...} }) is checked against the real Book model's shape, so renaming a field in the schema and forgetting to update a query is a compile error, not a production incident discovered by a user. This is one of the more concrete, immediate wins TypeScript gives a backend: your database schema and your query code are guaranteed to agree, because the compiler enforces it.`,
          cheatsheet: `import { Request, Response } from 'express';

interface CreateBookDto { title: string; authorId: number; }

app.post('/books', (req: Request<{}, unknown, CreateBookDto>, res: Response) => {
  const { title, authorId } = req.body;  // fully typed, no \`any\`
  ...
});

app.get('/books/:id', (req: Request<{ id: string }>, res: Response) => {
  const id = req.params.id;  // known to be a string
});

prisma.book.create({ data: { title, authorId } });  // checked against the real schema`,
          codeExamples: [
            {
              title: 'A fully typed route with a DTO',
              language: 'typescript',
              code: `interface CreateBookDto {
  title: string;
  authorId: number;
}

app.post('/books', async (req: Request<{}, unknown, CreateBookDto>, res: Response) => {
  const { title, authorId } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }
  const book = await prisma.book.create({ data: { title, authorId } });
  res.status(201).json(book);
});`,
            },
            {
              title: 'Typed route params',
              language: 'typescript',
              code: `app.get('/books/:id', async (req: Request<{ id: string }>, res: Response) => {
  const book = await prisma.book.findUnique({
    where: { id: Number(req.params.id) },
  });
  if (!book) return res.status(404).json({ error: 'Not found' });
  res.json(book);
});`,
            },
          ],
          quizQuestions: [
            { question: 'What is the type of req.body by default, before you add a DTO/generic?', options: ['string', 'any', 'object', 'unknown'], correctIndex: 1, explanation: 'Without an explicit generic, Express types req.body as any — every property access is unchecked, exactly what a DTO is meant to fix.' },
            { question: 'If you rename a field in schema.prisma but forget to update a query using the old name, what happens with typed Prisma?', options: ['Nothing, Prisma ignores unknown fields silently', 'A compile-time TypeScript error, since the generated client types no longer match', 'A runtime error only, the code still compiles', 'The old field name still works forever'], correctIndex: 1, explanation: 'Prisma regenerates its client types from schema.prisma — a mismatched field name becomes an immediate compile error, not a runtime surprise.' },
            { question: 'What does Request<{ id: string }> tell TypeScript?', options: ['Nothing, it is decorative', 'The route\'s params object has an id property typed as string, so req.params.id is known and checked', 'The request body must be a string', 'It sets the response status code'], correctIndex: 1, explanation: 'The first generic parameter to Express\'s Request type describes req.params — this gives req.params.id a real, checked type instead of any.' },
          ],
          miniProject: {
            title: 'Type the Task Manager API',
            description: 'Take the Level 2 Task Manager API and add full TypeScript types: typed route handlers, a CreateTaskDto for the request body, and typed Prisma queries throughout.',
            requirements: ['A named DTO interface defines the shape of every POST/PATCH request body', 'No `any` appears anywhere in route handler signatures', 'Prisma queries are not cast with `as any` anywhere'],
          },
          interviewBank: [
            {
              pattern: 'interface \\w+Dto',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'Why define a CreateBookDto interface instead of just typing req.body as any and validating manually at runtime?',
              expectedAnswer: 'A DTO gives you compile-time checking on every property access throughout the handler, not just at one manual validation point — a typo in a field name is caught immediately by the editor and compiler, whereas relying purely on runtime validation only catches a subset of mistakes and only when that code path actually executes.',
              evaluationRubric: ['Names compile-time vs runtime checking as the actual distinction', 'Does not claim a DTO replaces runtime validation entirely (it does not — data still needs validating)', 'Understands DTOs and runtime validation are complementary, not redundant'],
            },
            {
              pattern: 'prisma\\.\\w+\\.(create|update|findUnique)',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'You changed a field name in schema.prisma. What is the very next thing that happens to your existing route handlers, before you even run the app?',
              expectedAnswer: 'Every query referencing the old field name becomes a TypeScript compile error the moment the Prisma client is regenerated, since the generated types no longer include that field — this surfaces every affected call site immediately, rather than discovering them one at a time as routes get hit in production.',
              evaluationRubric: ['Correctly says this is a compile-time, not runtime, discovery', 'Names all affected call sites being caught at once, not incrementally', 'Confirms this requires regenerating the Prisma client first'],
            },
            {
              pattern: 'Request<',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Your route is typed Request<{}, unknown, CreateBookDto> — why \`{}\` for the first generic instead of leaving it out entirely?',
              expectedAnswer: 'The generics are positional — to specify the third one (the request body type), the first two (params and response body) must be filled in even if there is nothing meaningful to type there; \`{}\` signals "no typed route params for this endpoint" explicitly rather than accidentally leaving params as an unchecked default.',
              evaluationRubric: ['Correctly explains the positional-generics reason', 'Does not claim `{}` has some other special meaning', 'Would know to fill in a real type for params on a route like /books/:id'],
            },
          ],
          xpReward: 280,
          coinsReward: 140,
          skillMapping: { TypeScript: 30, 'Node.js': 15 },
          careerDnaImpact: { 'Technical Mastery': 20 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Convert the existing Orders API to strict TypeScript: typed route handlers, a DTO for every request body, and Prisma queries with no `any` casts.',
            requirements: [
              'file:tsconfig.json', 'route:POST /orders', 'route:GET /orders',
            ],
            resources: [{ title: 'TypeScript: Documentation', url: 'https://www.typescriptlang.org/docs/', type: 'doc' }],
            hints: [
              'Enable "strict": true in tsconfig.json before starting, not after',
              'Define one DTO interface per request body shape, reused across create/update where the shape overlaps',
            ],
            evaluationCriteria: [
              'No `any` type appears anywhere in the codebase',
              'Every route handler that reads a request body has a corresponding named DTO',
              'Prisma queries are not cast with `as any` or similar type-escape hatches',
            ],
            expectedSkills: ['TypeScript', 'Node.js'],
            difficulty: 'expert',
            multiplier: 2.0,
            xp: 280,
            challengeType: 'career',
          },
        },
      ],
    },

    // ───────────────────────── Level 7 ─────────────────────────
    {
      levelNumber: 7,
      name: 'Testing Backend Applications',
      description: 'Real integration tests against a real (test) database, and mocking the layers that should not run in a test.',
      difficulty: 'expert',
      estimatedDurationHours: 18,
      xpRequired: 3000,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Integration Testing with a Real Test Database',
          slug: 'backend-integration-testing',
          description: 'Going beyond Level 5\'s basic Supertest tests: a dedicated test database, mocking external services, unit vs. integration boundaries.',
          learningObjectives: [
            'Set up a dedicated test database so tests never run against real/production data',
            'Decide when a test should hit a real (test) database versus mock the data layer entirely',
            'Reset database state between tests so one test\'s data cannot leak into another\'s result',
          ],
          videos: [{ title: 'Integration Testing Node.js APIs', url: 'https://www.youtube.com/watch?v=lvgBJZFnvVE', type: 'video' }],
          officialDocs: [{ title: 'Testing | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing', type: 'doc' }],
          notes: `A unit test isolates one function and mocks everything it calls; an integration test lets a real request flow through real middleware into a real (but separate, disposable) test database — both have a place, but conflating them is a common mistake: mocking Prisma entirely in a "test" that's meant to verify your actual database queries proves nothing about whether those queries are correct SQL against a real schema.

A dedicated test database (a separate DATABASE_URL for the test environment, often reset before each test run) is what makes integration tests safe and repeatable — running tests against a shared dev or, worse, production database risks corrupting real data and makes tests flaky, since leftover data from a previous run can silently affect the next one's assertions.

Resetting state between tests (a transaction rolled back after each test, or truncating tables in a beforeEach/afterEach hook) is what keeps tests independent — a test that only passes because an earlier test happened to run first and leave data behind is a real, common source of flaky test suites that mysteriously fail only in CI, or only when run in a different order.`,
          cheatsheet: `// .env.test — a SEPARATE database from dev/prod
DATABASE_URL="postgresql://.../myapp_test"

// jest.setup.ts — reset state before each test
beforeEach(async () => {
  await prisma.order.deleteMany();
  await prisma.user.deleteMany();
});

// Unit test: mock the data layer entirely
jest.mock('../db');

// Integration test: real request, real test-DB query, no mocking of Prisma itself
const res = await request(app).post('/orders').send({ ... });`,
          codeExamples: [
            {
              title: 'An integration test hitting a real test database',
              language: 'typescript',
              code: `import request from 'supertest';
import { app } from '../app';
import { prisma } from '../db';

beforeEach(async () => {
  await prisma.order.deleteMany();
});

test('POST /orders creates a real row in the test database', async () => {
  const res = await request(app)
    .post('/orders')
    .send({ productId: 1, quantity: 2 });

  expect(res.status).toBe(201);

  const saved = await prisma.order.findUnique({ where: { id: res.body.id } });
  expect(saved).not.toBeNull();
  expect(saved?.quantity).toBe(2);
});`,
            },
          ],
          quizQuestions: [
            { question: 'Why is running tests against your real development database a bad idea, even if it "usually works"?', options: ['It is not a bad idea', 'Test data can pollute real dev data, and leftover rows from a previous run can silently affect the next run\'s assertions, causing flaky failures', 'Development databases cannot be queried by tests', 'It is slower than a test database'], correctIndex: 1, explanation: 'A shared, non-reset database is exactly how flaky, order-dependent test failures happen — a dedicated, resettable test database avoids that entirely.' },
            { question: 'What is the key difference between a unit test and an integration test for a route handler?', options: ['No real difference', 'A unit test mocks the data layer and tests logic in isolation; an integration test lets a real request flow through to a real (test) database', 'Integration tests do not use Jest', 'Unit tests are always faster and therefore always better'], correctIndex: 1, explanation: 'The boundary is what is real versus mocked — integration tests deliberately exercise the real database interaction, which is exactly what a fully-mocked unit test cannot verify.' },
            { question: 'What does resetting state in beforeEach actually protect against?', options: ['Nothing meaningful', 'One test\'s leftover data silently affecting a later test\'s result, making pass/fail depend on execution order', 'Slow test execution', 'TypeScript compile errors'], correctIndex: 1, explanation: 'Without a reset, tests become implicitly coupled to whatever state earlier tests happened to leave — a classic, hard-to-debug source of "it passes locally but fails in CI" bugs.' },
          ],
          miniProject: {
            title: 'Integration-test the Blog API',
            description: 'Add integration tests for the Level 3 Blog API\'s post-creation and pagination behavior, running against a dedicated test database with state reset between tests.',
            requirements: ['Uses a DATABASE_URL distinct from dev/production, not the same database', 'State is reset between tests, and at least one test explicitly proves this (fails without the reset)'],
          },
          interviewBank: [
            {
              pattern: 'beforeEach|afterEach',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What would happen to your test suite if you removed the beforeEach reset — would every test still pass?',
              expectedAnswer: 'Not reliably — tests that assert on exact counts or specific rows would start failing or passing inconsistently depending on what data earlier tests left behind, especially if the suite\'s execution order ever changed; this is exactly why the reset step is not optional cleanup, it is what makes each test\'s assertions actually mean something on their own.',
              evaluationRubric: ['Correctly predicts flaky/order-dependent failures, not "everything stays fine"', 'Names a concrete kind of assertion that would break (counts, specific rows)', 'Confirms they actually tested this claim, not just assumed it'],
            },
            {
              pattern: 'jest\\.mock\\(.*db',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'If you mock the entire Prisma client in a test, what does a passing test actually prove — and what does it NOT prove?',
              expectedAnswer: 'It proves the route handler\'s logic calls the expected Prisma methods with the expected arguments; it proves nothing about whether those queries are actually valid against the real schema, whether a real database would accept them, or whether the real query returns the shape the code assumes — that gap is exactly what an integration test against a real test database is for.',
              evaluationRubric: ['Correctly identifies both what is and is not proven', 'Does not claim mocked tests are worthless (they still have value for logic)', 'Names integration tests as the specific thing that closes the gap'],
            },
            {
              pattern: 'DATABASE_URL',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'How does your test suite know to use a test database instead of accidentally connecting to development or production?',
              expectedAnswer: 'A separate DATABASE_URL is configured specifically for the test environment (e.g. via a .env.test file or an environment variable set only in CI/test runs), loaded before Prisma\'s client is instantiated — if this were ever misconfigured to point at a real database, tests could delete or corrupt real data via their reset/cleanup steps.',
              evaluationRubric: ['Names a distinct test-specific DATABASE_URL as the mechanism', 'Recognizes the real risk of misconfiguration (tests deleting real data)', 'Confirms this is actually how their own setup works, not a hypothetical'],
            },
          ],
          xpReward: 300,
          coinsReward: 150,
          skillMapping: { Testing: 30, Database: 15 },
          careerDnaImpact: { 'Technical Mastery': 15, 'Problem Solving': 10 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a real integration test suite for the Inventory features from Levels 1-5: a dedicated test database, state reset between tests, and coverage of both success and failure paths against real Prisma queries.',
            requirements: [
              'route:POST /orders', 'route:GET /orders', 'error-handling:',
            ],
            resources: [{ title: 'Testing | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing', type: 'doc' }],
            hints: [
              'Point DATABASE_URL at a genuinely separate test database, never dev or production',
              'Prove your reset step works by writing a test that would fail without it',
            ],
            evaluationCriteria: [
              'Tests run against a dedicated test database, confirmed separate from dev/production',
              'State is reliably reset between tests, with no order-dependent failures',
              'Both success and failure paths are covered with real database-level assertions, not just status codes',
            ],
            expectedSkills: ['Testing', 'Database'],
            difficulty: 'expert',
            multiplier: 2.0,
            xp: 300,
            challengeType: 'career',
          },
        },
      ],
    },

    // ───────────────────────── Level 8 ─────────────────────────
    {
      levelNumber: 8,
      name: 'Advanced Prisma & Transactions',
      description: 'When two writes must succeed or fail together, and what actually happens when two requests race each other.',
      difficulty: 'expert',
      estimatedDurationHours: 18,
      xpRequired: 3600,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Transactions & Race Conditions',
          slug: 'prisma-transactions',
          description: 'Using prisma.$transaction for atomic multi-step writes, and handling concurrent requests that touch the same row.',
          learningObjectives: [
            'Use prisma.$transaction to make multiple writes succeed or fail together atomically',
            'Recognize a race condition between two concurrent requests reading-then-writing the same row',
            'Use an atomic update (or a database-level constraint) instead of a read-then-write pattern where it matters',
          ],
          videos: [{ title: 'Prisma Transactions Explained', url: 'https://www.youtube.com/watch?v=1E1dQxeH0I0', type: 'video' }],
          officialDocs: [{ title: 'Transactions | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/queries/transactions', type: 'doc' }],
          notes: `A checkout that both decrements inventory AND creates an order record needs both writes to happen together, or neither — if the order is created but the inventory decrement fails, you've oversold; if inventory is decremented but the order creation fails, a customer paid for nothing. prisma.$transaction([decrementInventory, createOrder]) (or the interactive form, prisma.$transaction(async (tx) => {...})) guarantees this: either every operation inside it commits, or the entire batch rolls back as if none of it happened.

A classic race condition: two requests both read stock: 1, both see it as available, both proceed to create an order, and now two orders are fulfilled from one unit of stock — the bug isn't in either request individually, it's in the gap between reading and writing where another request can interleave. This is invisible in almost all manual testing (you're one person, one request at a time) and only shows up under real concurrent load.

The fix is an atomic operation, not a faster read-then-write: prisma.book.update({ where: { id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } }) — the database checks the condition and applies the decrement as a single atomic operation, so a second concurrent request that already sees stock at 0 simply fails the where clause and updates zero rows, instead of racing past a stale in-application check.`,
          cheatsheet: `// Multiple operations succeed or fail together
await prisma.$transaction([
  prisma.book.update({ where: { id }, data: { stock: { decrement: 1 } } }),
  prisma.order.create({ data: { bookId: id, quantity: 1 } }),
]);

// Interactive transaction — for logic between steps
await prisma.$transaction(async (tx) => {
  const book = await tx.book.findUnique({ where: { id } });
  if (!book || book.stock < 1) throw new Error('Out of stock');
  await tx.book.update({ where: { id }, data: { stock: { decrement: 1 } } });
  await tx.order.create({ data: { bookId: id } });
});

// Atomic conditional update — avoids the read-then-write race entirely
prisma.book.update({ where: { id, stock: { gt: 0 } }, data: { stock: { decrement: 1 } } });`,
          codeExamples: [
            {
              title: 'An atomic checkout using a transaction',
              language: 'typescript',
              code: `app.post('/checkout', asyncHandler(async (req, res) => {
  const { bookId } = req.body;

  const order = await prisma.$transaction(async (tx) => {
    const book = await tx.book.findUnique({ where: { id: bookId } });
    if (!book || book.stock < 1) {
      throw new Error('Out of stock');
    }
    await tx.book.update({
      where: { id: bookId },
      data: { stock: { decrement: 1 } },
    });
    return tx.order.create({ data: { bookId } });
  });

  res.status(201).json(order);
}));`,
            },
            {
              title: 'An atomic conditional update avoiding a race',
              language: 'typescript',
              code: `// Fails safely (updates 0 rows) if another request already took the last unit
const result = await prisma.book.updateMany({
  where: { id: bookId, stock: { gt: 0 } },
  data: { stock: { decrement: 1 } },
});

if (result.count === 0) {
  return res.status(409).json({ error: 'Out of stock' });
}`,
            },
          ],
          quizQuestions: [
            { question: 'If an inventory decrement succeeds but the order-creation write inside the same $transaction throws, what happens to the inventory decrement?', options: ['It stays decremented', 'It is rolled back — the entire transaction is atomic, so no partial write persists', 'It depends on which database is used', 'The transaction silently ignores the error'], correctIndex: 1, explanation: 'That is the entire point of a transaction — either all operations inside it commit, or none of them do; a partial failure cannot leave a half-applied state.' },
            { question: 'What specifically causes the two-orders-from-one-unit-of-stock race condition?', options: ['A bug in Prisma itself', 'Two requests both read the current stock BEFORE either writes, so both see it as available and proceed', 'The database is too slow', 'Using TypeScript instead of JavaScript'], correctIndex: 1, explanation: 'The gap between the read and the write is where a second concurrent request can interleave and read the same stale value — the bug is in the pattern, not either individual request.' },
            { question: 'Why does prisma.book.update({ where: { id, stock: { gt: 0 } }, ... }) fix the race, where a separate read-then-write does not?', options: ['It does not actually fix it', 'The condition check and the write happen as one atomic database operation, so a second request racing against the first sees the updated state and fails the where clause instead of racing past a stale check', 'It is just faster, not more correct', 'gt: 0 has no special effect here'], correctIndex: 1, explanation: 'Pushing the condition into the same atomic operation as the write closes the exact gap a separate read-then-write leaves open.' },
          ],
          miniProject: {
            title: 'Atomic seat reservation',
            description: 'A POST /reserve endpoint for a fixed-capacity event that must never allow more reservations than available seats, even under concurrent requests — using an atomic conditional update, not a read-then-write check.',
            requirements: ['Uses a single atomic update with a where-clause condition, not separate read-then-write calls', 'Returns 409 (not a crash) when capacity is already full'],
          },
          interviewBank: [
            {
              pattern: '\\$transaction',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Walk me through what happens, step by step, if the order-creation step inside your $transaction throws an error.',
              expectedAnswer: 'Prisma automatically rolls back every operation that already ran inside that transaction — the inventory decrement that happened earlier in the same transaction is undone, so the database ends up exactly as if the checkout attempt never happened, and the thrown error propagates out for the route handler to catch and respond to.',
              evaluationRubric: ['Correctly describes automatic rollback of the earlier step', 'Confirms the database ends in a consistent pre-transaction state', 'Traces where the thrown error actually goes (caught by asyncHandler/error middleware)'],
            },
            {
              pattern: 'stock:\\s*\\{\\s*gt:',
              difficulty: 'hard',
              experienceLevel: 'mid',
              question: 'Two requests hit your reservation endpoint at nearly the same instant for the last available seat. Walk me through exactly what happens to each one with your atomic-update approach.',
              expectedAnswer: 'Both requests issue the same conditional update; the database serializes them so only one actually finds a row matching stock > 0 (or capacity remaining) at the moment it runs and successfully decrements — the second request\'s update matches zero rows because the first already consumed the last unit, and the code checks the returned count to correctly respond 409 for the loser rather than silently succeeding.',
              evaluationRubric: ['Correctly explains the database serializes the two atomic operations', 'Names checking the update count/result to detect the "lost" request', 'Does not claim both could succeed with this approach'],
            },
            {
              pattern: 'findUnique.*stock < 1|book\\.stock',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'If someone on your team wrote the stock check as "find the book, check book.stock > 0 in JavaScript, then update" instead of the atomic where-clause version, what would you tell them?',
              expectedAnswer: 'That pattern reintroduces exactly the race condition an atomic update is meant to close — the read and the write are two separate operations with a gap between them where a concurrent request can interleave, so under real concurrent load it can still oversell even though it looks correct and passes any single-request manual test.',
              evaluationRubric: ['Correctly identifies this as reintroducing the race, not a minor style difference', 'Explains why manual/single-request testing would not catch it', 'Recommends the atomic conditional update as the actual fix'],
            },
          ],
          xpReward: 320,
          coinsReward: 160,
          skillMapping: { Database: 30, 'Prisma/ORM': 15 },
          careerDnaImpact: { 'Technical Mastery': 15, 'Problem Solving': 15 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Build an atomic checkout flow: decrementing stock and creating an order must happen together, and concurrent requests for the last unit of stock must never both succeed.',
            requirements: [
              'route:POST /checkout', 'table:Order', 'db-relation:bookId',
            ],
            resources: [{ title: 'Transactions | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/queries/transactions', type: 'doc' }],
            hints: [
              'A $transaction alone does not prevent the race — you still need an atomic conditional update or a re-check inside the transaction',
              'Test this with genuinely concurrent requests (e.g. Promise.all of two calls), not one after another',
            ],
            evaluationCriteria: [
              'Inventory decrement and order creation succeed or fail together, never partially',
              'Two concurrent requests for the last unit of stock result in exactly one success and one clean 409, never two successes',
              'The out-of-stock case returns a clear error, not a crash or a negative stock value',
            ],
            expectedSkills: ['Database', 'Prisma/ORM'],
            difficulty: 'expert',
            multiplier: 2.0,
            xp: 320,
            challengeType: 'career',
          },
        },
      ],
    },

    // ───────────────────────── Level 9 ─────────────────────────
    {
      levelNumber: 9,
      name: 'Caching & Background Jobs',
      description: 'Redis for expensive reads, and moving slow work off the request path with a real job queue.',
      difficulty: 'expert',
      estimatedDurationHours: 20,
      xpRequired: 4300,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Redis Caching & Background Jobs with BullMQ',
          slug: 'caching-background-jobs',
          description: 'Caching expensive reads with a real invalidation strategy, and deferring slow work (like sending email) to a background queue.',
          learningObjectives: [
            'Cache an expensive read in Redis and correctly invalidate it when the underlying data changes',
            'Move slow, non-critical work (sending an email) off the request/response path with BullMQ',
            'Recognize what should and should not be cached, and what should and should not be a background job',
          ],
          videos: [{ title: 'Redis Caching in Node.js Crash Course', url: 'https://www.youtube.com/watch?v=jgpVdJB2sKQ', type: 'video' }],
          officialDocs: [
            { title: 'Redis Documentation', url: 'https://redis.io/docs/latest/', type: 'doc' },
            { title: 'BullMQ Documentation', url: 'https://docs.bullmq.io/', type: 'doc' },
          ],
          notes: `A cache is only correct if it is invalidated when the underlying data changes — caching GET /books/:id in Redis with a TTL is easy; remembering to delete that cache key every time a PATCH /books/:id updates the same book is the actual hard part, and the part that's easy to forget until a user reports seeing stale data. A simple, honest starting pattern: read from cache if present, otherwise query the database and populate the cache; on any write to that resource, explicitly delete its cache key rather than trying to update the cached value in place.

Not everything should be cached — data that changes on every request, or where staleness is unacceptable (an account balance, a real-time stock count) is a poor caching candidate regardless of how expensive the underlying query is; caching is for read-heavy, tolerant-of-slight-staleness data.

A background job (via BullMQ, backed by Redis) takes work off the critical request path: POST /register shouldn't make the user wait for a welcome email to actually send before responding — enqueue an email job and respond immediately, letting a separate worker process pick it up and send it, possibly with a retry if the email provider is briefly down. The same judgment applies as with caching: not everything belongs in a background job — anything the user genuinely needs the result of immediately (like the actual created resource) must stay in the synchronous request/response cycle.`,
          cheatsheet: `import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Cache-aside read
const cached = await redis.get(\`book:\${id}\`);
if (cached) return JSON.parse(cached);
const book = await prisma.book.findUnique({ where: { id } });
await redis.set(\`book:\${id}\`, JSON.stringify(book), 'EX', 300); // 5 min TTL

// Invalidate on write — do this on EVERY write to the same resource
await redis.del(\`book:\${id}\`);

// BullMQ — enqueue work instead of doing it inline
import { Queue, Worker } from 'bullmq';
const emailQueue = new Queue('emails', { connection: redis });
await emailQueue.add('welcome', { userId: user.id });

new Worker('emails', async (job) => { await sendWelcomeEmail(job.data.userId); }, { connection: redis });`,
          codeExamples: [
            {
              title: 'Cache-aside read with invalidation on write',
              language: 'typescript',
              code: `app.get('/books/:id', asyncHandler(async (req, res) => {
  const cacheKey = \`book:\${req.params.id}\`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));

  const book = await prisma.book.findUnique({ where: { id: Number(req.params.id) } });
  if (!book) return res.status(404).json({ error: 'Not found' });

  await redis.set(cacheKey, JSON.stringify(book), 'EX', 300);
  res.json(book);
}));

app.patch('/books/:id', asyncHandler(async (req, res) => {
  const book = await prisma.book.update({ where: { id: Number(req.params.id) }, data: req.body });
  await redis.del(\`book:\${req.params.id}\`); // invalidate — do not leave stale data cached
  res.json(book);
}));`,
            },
            {
              title: 'Deferring email to a background job',
              language: 'typescript',
              code: `app.post('/register', asyncHandler(async (req, res) => {
  const user = await prisma.user.create({ data: req.body });
  await emailQueue.add('welcome', { userId: user.id }); // do not await the send itself
  res.status(201).json({ id: user.id, email: user.email });
}));

// Separate worker process
new Worker('emails', async (job) => {
  await sendWelcomeEmail(job.data.userId);
}, { connection: redis });`,
            },
          ],
          quizQuestions: [
            { question: 'A user updates a book\'s title, but GET /books/:id still returns the old title for the next 5 minutes. What is the most likely cause?', options: ['A database bug', 'The cache was not invalidated when the PATCH happened, so it kept serving the stale cached value until its TTL expired', 'Redis is down', 'The GET route has a bug in its query'], correctIndex: 1, explanation: 'This is the classic missed-invalidation bug — the cache write path was implemented, but the corresponding delete-on-write was forgotten.' },
            { question: 'Why enqueue a welcome email instead of awaiting the send directly inside POST /register?', options: ['Emails cannot be sent synchronously', 'It keeps the response fast and resilient to the email provider being slow or briefly down, without making the user wait for something they do not need the result of immediately', 'It is required by BullMQ', 'There is no real benefit'], correctIndex: 1, explanation: 'The user does not need to wait for email delivery to know registration succeeded — moving it to a background job decouples the two, and lets it retry independently on failure.' },
            { question: 'What kind of data is a poor caching candidate, regardless of how expensive the query is?', options: ['Anything read frequently', 'Data that changes on nearly every request or where even brief staleness is unacceptable (e.g. a live account balance)', 'Data stored in Postgres', 'Nothing — everything should always be cached'], correctIndex: 1, explanation: 'Caching trades a small amount of staleness for speed — for data where that staleness is genuinely unacceptable, caching is the wrong tool regardless of query cost.' },
          ],
          miniProject: {
            title: 'Cached catalog + async welcome email',
            description: 'Add Redis caching (with correct invalidation on write) to the book catalog\'s GET /books/:id, and move registration\'s welcome email to a BullMQ background job.',
            requirements: ['Cache is explicitly invalidated on every write to the same book, not left to expire only via TTL', 'Registration responds without waiting for the email to actually send'],
          },
          interviewBank: [
            {
              pattern: 'redis\\.del\\(',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Show me every place in your code that writes to a book\'s data. Does each one also invalidate that book\'s cache key?',
              expectedAnswer: 'A correct implementation traces every write path (create, update, delete) for the resource and confirms each one calls redis.del on the corresponding cache key — missing even one write path (a bulk update route, for instance) reintroduces the exact stale-cache bug the invalidation was meant to prevent.',
              evaluationRubric: ['Actually traces their own write paths, not a hypothetical', 'Confirms every write path invalidates, not just the most obvious one', 'Would recognize a missed invalidation as a real bug, not an edge case to ignore'],
            },
            {
              pattern: 'emailQueue\\.add|Worker\\(',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'If the email-sending worker crashes right after picking up a job but before actually sending the email, what happens to that welcome email?',
              expectedAnswer: 'A well-configured BullMQ job stays in a state where it will be retried (either automatically via configured retry attempts, or it remains in the queue/failed state for inspection) rather than being silently lost — this is one of the real advantages of a job queue over a fire-and-forget async call: the work is durable and recoverable, not gone the instant the process handling it dies.',
              evaluationRubric: ['Correctly identifies the job is not simply lost', 'Names retry/durability as a specific BullMQ behavior, not a vague "it is fine"', 'Confirms whether their own setup actually configures retries, not just assumes defaults'],
            },
            {
              pattern: 'EX.*300|TTL',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'Why give the cached book a 5-minute TTL instead of caching it forever until explicitly invalidated?',
              expectedAnswer: 'A TTL is a safety net for any invalidation path that gets missed or fails — even with correct invalidation logic, a TTL bounds how long a bug (or an edge case like a direct database write bypassing the API) can cause stale data to be served, trading a small amount of guaranteed-eventual staleness for protection against invalidation bugs.',
              evaluationRubric: ['Names the TTL as a safety net, not the primary invalidation mechanism', 'Understands invalidation-on-write and TTL are complementary, not either/or', 'Would not rely on TTL alone as the only staleness control'],
            },
          ],
          xpReward: 340,
          coinsReward: 170,
          skillMapping: { Caching: 30, 'Background Jobs': 15 },
          careerDnaImpact: { 'Technical Mastery': 15, 'Execution Focus': 15 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Add correctly-invalidated Redis caching to a read-heavy product catalog endpoint, and move a slow notification (order-confirmation email) to a BullMQ background job.',
            requirements: [
              'route:GET /books/:id', 'route:PATCH /books/:id',
            ],
            resources: [
              { title: 'Redis Documentation', url: 'https://redis.io/docs/latest/', type: 'doc' },
              { title: 'BullMQ Documentation', url: 'https://docs.bullmq.io/', type: 'doc' },
            ],
            hints: [
              'Every write path to the cached resource needs its own invalidation — audit all of them, not just the obvious PATCH route',
              'The background job should be genuinely fire-and-forget from the request\'s perspective — do not await its completion',
            ],
            evaluationCriteria: [
              'Cached reads are measurably faster on a cache hit, and correctly invalidated on every write',
              'The email/notification job is enqueued, not sent synchronously inside the request',
              'A deliberately stale-cache test (update then immediately re-read) returns fresh data, not the old cached value',
            ],
            expectedSkills: ['Caching', 'Background Jobs'],
            difficulty: 'expert',
            multiplier: 2.0,
            xp: 340,
            challengeType: 'career',
          },
        },
      ],
    },

    // ───────────────────────── Level 10 ─────────────────────────
    {
      levelNumber: 10,
      name: 'Milestone: Inventory Management API',
      description: 'Milestone 1 capstone — TypeScript, integration tests, transactions, and caching/jobs, combined into one project.',
      difficulty: 'expert',
      estimatedDurationHours: 26,
      xpRequired: 5100,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Milestone: Inventory Management API',
          slug: 'milestone-inventory-management-api',
          description: 'Integrated Milestone 1 challenge — everything from Levels 6-9 combined into one recruiter-facing project.',
          learningObjectives: [
            'Combine TypeScript, integration testing, transactional writes, and caching/background jobs into one cohesive, integrated backend project',
          ],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Milestone 1 integrated challenge, combining every skill from Levels 6-9. Complete it after all four preceding levels.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: '\\$transaction|updateMany',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'This API is typed, tested, transactional, and cached. Which of those four would you cut first under real time pressure, and why?',
              expectedAnswer: 'A strong, senior-level answer reasons about actual risk, not treats all four as equal: transactional correctness around inventory/orders is the least negotiable, since a race condition there means real overselling or lost orders; TypeScript and integration tests are foundational and expensive to retrofit later, so cutting them tends to cost more than it saves; caching is the most legitimately deferrable under time pressure, since it can be added later against real traffic patterns once the correctness-critical paths are solid.',
              evaluationRubric: ['Makes a real, defensible tradeoff, not "keep everything"', 'Correctly identifies transactional correctness as the least cuttable given this domain', 'Reasons about retrofit cost as the deciding factor for TS/testing vs. caching'],
            },
            {
              pattern: 'race condition|concurrent',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'Show me, specifically, how you tested that this API cannot oversell inventory under concurrent load — not just that the logic looks correct.',
              expectedAnswer: 'A real answer describes an actual test that fires genuinely concurrent requests (e.g. Promise.all of two or more simultaneous checkout calls) against the same limited-stock item and asserts that exactly the available quantity succeeds and the rest cleanly fail — "the code looks atomic" is not the same as having proven it under real concurrency, which is exactly the gap this test closes.',
              evaluationRubric: ['Describes an actual concurrent test, not just a description of the atomic-update logic', 'Confirms the assertion checks the correct outcome (exact stock count succeeds, rest fail cleanly)', 'Does not accept "it should be fine" as sufficient proof'],
            },
            {
              pattern: 'redis\\.del\\(|emailQueue\\.add',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'This capstone caches reads and queues emails as background jobs. If the cache invalidation had a bug and stock counts were shown stale during a flash sale, how would that interact with your transactional checkout — would customers actually oversell?',
              expectedAnswer: 'No — the cached value only affects what is displayed on a read, never what the atomic conditional update actually checks; the checkout transaction re-reads and re-validates stock inside the database operation itself, so a stale cached display could show incorrect availability to a user but could not cause an actual oversell, since the write path never trusts the cache.',
              evaluationRubric: ['Correctly separates the read-side cache from the write-side atomic check', 'Confirms the transactional write path never trusts cached data', 'Identifies the real-but-limited impact: a misleading display, not a correctness failure'],
            },
          ],
          xpReward: 500,
          coinsReward: 250,
          skillMapping: { TypeScript: 10, Testing: 10, Database: 10, Caching: 10, 'Background Jobs': 10 },
          careerDnaImpact: { 'Technical Mastery': 20, 'Execution Focus': 15, 'Problem Solving': 15, 'Collaborative Sync': 5 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a fully typed inventory management API: typed routes and DTOs throughout, a real integration test suite against a test database, atomic transactional checkout with no overselling under concurrent load, correctly-invalidated Redis caching on reads, and background-queued order-confirmation emails.',
            requirements: [
              'file:tsconfig.json', 'route:POST /checkout', 'route:GET /books/:id', 'table:Order', 'db-relation:bookId',
            ],
            resources: [
              { title: 'Transactions | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/queries/transactions', type: 'doc' },
              { title: 'Testing | Prisma Documentation', url: 'https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing', type: 'doc' },
            ],
            hints: [
              'This is the Milestone 1 capstone — the AI Review stage weighs integration and correctness across all four skills together, not any one in isolation',
              'Prove the no-overselling guarantee with an actual concurrent test, and keep it in the submitted test suite as evidence',
            ],
            evaluationCriteria: [
              'No `any` type appears anywhere in the codebase',
              'A real integration test suite runs against a dedicated test database, covering success and failure paths',
              'Concurrent checkout requests for limited stock never oversell, proven by an explicit concurrent test',
              'Reads are cached with correct invalidation on every write, and order confirmation is sent via a background job',
            ],
            expectedSkills: ['TypeScript', 'Testing', 'Database', 'Caching'],
            difficulty: 'expert',
            multiplier: 2.5,
            xp: 500,
            challengeType: 'milestone',
          },
        },
      ],
    },
  ],
};
