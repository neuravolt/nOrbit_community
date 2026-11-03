import { RoleContent } from '../types';

export const frontendDeveloper: RoleContent = {
  careerName: 'Software Engineering',
  careerSlug: 'software-engineering',
  roleName: 'Frontend Developer',
  roleSlug: 'frontend-developer',
  roleDescription: 'Builds the interfaces users actually touch — semantic HTML, layout, JavaScript, and React, ending in a verified, GitHub-based portfolio of real projects.',
  technologyName: 'React',
  technologySlug: 'react',
  technologyDescription: 'The React stack: HTML/CSS foundations, JavaScript fundamentals, React components, hooks, and API integration.',
  levels: [
    // ───────────────────────── Level 1 ─────────────────────────
    {
      levelNumber: 1,
      name: 'HTML & CSS Foundations',
      description: 'Semantic markup and layout with the CSS box model and Flexbox — the two things every real frontend job actually tests first.',
      difficulty: 'explorer',
      estimatedDurationHours: 12,
      xpRequired: 0,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Semantic HTML',
          slug: 'semantic-html',
          description: 'Writing HTML that means something, not just divs everywhere.',
          learningObjectives: [
            'Use semantic elements (header, nav, main, section, article, footer) instead of generic divs',
            'Structure a page so it makes sense to screen readers and search engines, not just visually',
            'Write accessible forms with proper label associations',
          ],
          videos: [{ title: 'CSS Flexbox Crash Course', url: 'https://www.youtube.com/watch?v=tXIhdp5R7sc', type: 'video' }],
          officialDocs: [
            { title: 'HTML elements reference', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element', type: 'doc' },
            { title: 'HTML: A good basis for accessibility', url: 'https://developer.mozilla.org/en-US/docs/Learn/Accessibility/HTML', type: 'doc' },
          ],
          notes: `Semantic HTML means choosing elements that describe what content IS, not how it looks. A <div> tells a browser (and a screen reader, and a recruiter's linter) nothing. A <nav> tells everyone this block is navigation.

The elements that matter most: <header> for intro/branding content, <nav> for navigation links, <main> for the page's primary content (one per page), <section> for a thematic grouping with its own heading, <article> for standalone content that would make sense syndicated on its own (a blog post, a product card), <aside> for tangential content, <footer> for closing/meta content.

Why this matters beyond style: screen readers use these landmarks to let users jump straight to "main content" or "navigation" — skipping semantic HTML actively breaks accessibility. It's also exactly what the Verification Engine's Architecture Validator checks for on this track's challenges — a required "component:Navbar" requirement is satisfied by a real <nav>, not a <div className="navbar">.

Forms deserve special care: every <input> needs an associated <label> (via htmlFor/id, or by wrapping the input), otherwise a screen reader announces "edit text" with no idea what it's for.`,
          cheatsheet: `<header> — intro/branding, top of a page or section
<nav> — navigation links
<main> — primary content, one per page
<section> — thematic grouping, usually with its own <h2+>
<article> — self-contained, syndicatable content
<aside> — tangential/related content
<footer> — closing/meta content
<label for="id"> — always pair with a matching input id
<button> not <div onClick> — buttons are keyboard-accessible by default
alt="" on every <img> — empty alt for decorative images, descriptive alt otherwise`,
          codeExamples: [
            {
              title: 'A properly structured page skeleton',
              language: 'html',
              code: `<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
    </nav>
  </header>
  <main>
    <section aria-labelledby="intro-heading">
      <h2 id="intro-heading">Welcome</h2>
      <p>Some intro copy.</p>
    </section>
  </main>
  <footer>
    <p>&copy; 2026</p>
  </footer>
</body>`,
            },
            {
              title: 'An accessible form field',
              language: 'html',
              code: `<label for="email">Email address</label>
<input id="email" name="email" type="email" required />`,
            },
          ],
          quizQuestions: [
            { question: 'Which element should wrap a page\'s primary, non-repeated content?', options: ['<div>', '<main>', '<section>', '<body>'], correctIndex: 1, explanation: '<main> is reserved for the primary content unique to that page — there should be exactly one per page.' },
            { question: 'Why does a <button> beat a <div onClick={...}> for a clickable action?', options: ['It looks better by default', 'It is keyboard-accessible and announced correctly by screen readers out of the box', 'It loads faster', 'There is no real difference'], correctIndex: 1, explanation: '<button> gets keyboard focus, Enter/Space activation, and correct screen-reader semantics for free — a <div> needs all of that re-implemented manually.' },
            { question: 'What does an empty alt="" on an <img> communicate?', options: ['The image failed to load', 'The image is purely decorative and should be skipped by screen readers', 'The image has no title', 'It is required for all images'], correctIndex: 1, explanation: 'Empty alt tells assistive tech to skip the image entirely — correct for decorative images, wrong for meaningful ones, which need a real description.' },
          ],
          miniProject: {
            title: 'Restructure a "div soup" page',
            description: 'Given a single-file HTML page built entirely from nested <div>s, rewrite it using proper semantic elements without changing how it looks.',
            requirements: ['Use header/nav/main/section/footer appropriately', 'Every form input has an associated label', 'Every image has an appropriate alt attribute'],
          },
          interviewBank: [
            {
              pattern: 'div.*onClick',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'I see a <div> with an onClick handler acting as a button in your code. Why might that be a problem?',
              expectedAnswer: 'A <div> is not keyboard-focusable or announced as interactive by screen readers by default — a real <button> gets that behavior for free, and using a div requires manually re-adding tabIndex, role, and key handlers to match.',
              evaluationRubric: ['Mentions keyboard accessibility', 'Mentions screen reader semantics', 'Knows how to fix it (use <button>)'],
            },
            {
              pattern: '<label',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'This input has no visible label text next to it — how does a screen reader user know what it is for?',
              expectedAnswer: 'They don\'t, unless a <label> is actually associated with the input via a matching for/id pair (or by wrapping the input) — placeholder text is not a substitute for a label, since it disappears once the user starts typing and many screen readers do not reliably announce it.',
              evaluationRubric: ['Names the for/id association specifically', 'Rejects placeholder-as-label as sufficient', 'Knows wrapping the input in <label> is an alternative'],
            },
            {
              pattern: 'alt=',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'When would you use alt="" versus writing an actual description in the alt attribute?',
              expectedAnswer: 'Empty alt="" for purely decorative images that carry no information (a background flourish), so screen readers skip them; a real, meaningful description for any image that conveys content the user needs (a product photo, a chart) — omitting alt entirely is different again, and worse, since some screen readers then read the filename.',
              evaluationRubric: ['Distinguishes decorative vs informational images', 'Knows omitting alt is worse than empty alt', 'Gives a concrete example of each case'],
            },
          ],
          xpReward: 80,
          coinsReward: 40,
          skillMapping: { HTML: 20, Accessibility: 10 },
          difficulty: 'explorer',
          trustLevel: 'A',
          challenge: {
            objective: 'Given a page built entirely from nested divs, rewrite it using proper semantic elements — header, nav, main, footer — without changing how it looks, with every form input properly labeled and every image given alt text.',
            requirements: ['component:header', 'component:footer'],
            resources: [{ title: 'HTML elements reference', url: 'https://developer.mozilla.org/en-US/docs/Web/HTML/Element', type: 'doc' }],
            hints: [
              'Pick each element by the role of its content, not to satisfy a checklist — nav for navigation, main for the primary content.',
              'A label needs a matching htmlFor/id pair, or must wrap the input, to actually be associated with it.',
            ],
            evaluationCriteria: [
              'Semantic elements replace generic divs where appropriate',
              'Every form input has a properly associated label, every image has alt text',
            ],
            expectedSkills: ['HTML', 'Accessibility'],
            difficulty: 'explorer',
            multiplier: 0.6,
            xp: 80,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'CSS Box Model & Flexbox',
          slug: 'css-box-model-flexbox',
          description: 'How layout actually works: box model, then Flexbox for real one-dimensional layouts.',
          learningObjectives: [
            'Explain content, padding, border, and margin and how box-sizing changes their math',
            'Build a row or column layout with Flexbox without floats or absolute positioning',
            'Use justify-content and align-items to control spacing and alignment on both axes',
          ],
          videos: [{ title: 'CSS Flexbox Crash Course', url: 'https://www.youtube.com/watch?v=tXIhdp5R7sc', type: 'video' }],
          officialDocs: [
            { title: 'CSS box model', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_box_model', type: 'doc' },
            { title: 'Basic concepts of flexbox', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox', type: 'doc' },
          ],
          notes: `Every element is a box: content, then padding (inside the border), then border, then margin (outside, invisible, pushes other elements away). By default width/height only set the content box — padding and border ADD to the rendered size, which is why almost every real stylesheet sets * { box-sizing: border-box; } so width means the actual rendered width.

Flexbox turns a container into a one-dimensional layout system. Set display: flex on the parent; its direct children become flex items laid out along a main axis (row by default). justify-content controls spacing along the main axis (flex-start, center, space-between, space-around). align-items controls alignment along the cross axis (stretch by default, or center, flex-start, flex-end). flex-wrap: wrap lets items drop to a new line instead of overflowing or shrinking forever.

A real navbar — logo left, links right, vertically centered — is: display:flex; justify-content:space-between; align-items:center; on the container. That single combination covers a huge fraction of real layout work.`,
          cheatsheet: `box-sizing: border-box — width/height include padding+border (set this globally)
display: flex — turns children into flex items along a main axis
flex-direction: row | column — which axis is "main"
justify-content: flex-start | center | space-between | space-around — main-axis spacing
align-items: stretch | center | flex-start | flex-end — cross-axis alignment
flex-wrap: wrap — allow items to wrap to new lines
gap: 1rem — spacing between flex items, no margin hacks needed`,
          codeExamples: [
            {
              title: 'A real navbar with Flexbox',
              language: 'css',
              code: `.navbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
}`,
            },
            {
              title: 'Global border-box reset',
              language: 'css',
              code: `*, *::before, *::after {
  box-sizing: border-box;
}`,
            },
          ],
          quizQuestions: [
            { question: 'With the default box-sizing, if you set width: 200px and padding: 20px, how wide is the element actually rendered?', options: ['200px', '220px', '240px', '180px'], correctIndex: 2, explanation: 'content-box (the default) adds padding and border ON TOP of the specified width: 200 + 20 + 20 = 240px total.' },
            { question: 'To vertically center items in a flex row, which property do you use?', options: ['justify-content', 'align-items', 'text-align', 'vertical-align'], correctIndex: 1, explanation: 'align-items controls the cross axis — vertical, in a default row-direction flex container.' },
            { question: 'What does justify-content: space-between do with 3 items in a row?', options: ['Equal gaps everywhere including edges', 'First item at start, last at end, remaining space split evenly between them', 'Items centered with no gap', 'Items stacked vertically'], correctIndex: 1, explanation: 'space-between pins the first and last items to the container edges and distributes remaining space evenly between the rest.' },
          ],
          miniProject: {
            title: 'Build a pricing-card row',
            description: 'Three pricing cards in a row, equal width, centered as a group, that wrap to a column on narrow screens.',
            requirements: ['display:flex with flex-wrap on the container', 'Cards use flex: 1 for equal width', 'Uses gap, not margin, for spacing between cards'],
          },
          interviewBank: [
            {
              pattern: 'display:\\s*flex',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Walk me through why your navbar looks the way it does — what is justify-content: space-between actually doing here?',
              expectedAnswer: 'It distributes the flex items along the main axis so the first item sits at the start, the last at the end, and remaining items are spaced evenly between them — that is what pushes the logo left and nav links right with the gap absorbing the middle space.',
              evaluationRubric: ['Correctly explains main-axis distribution', 'Distinguishes justify-content from align-items', 'Can explain what would change with flex-direction: column'],
            },
            {
              pattern: 'box-sizing',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'You set width: 200px and padding: 20px on an element with no box-sizing override. How wide does it actually render, and why?',
              expectedAnswer: '240px — by default (content-box), width only sets the content area, and padding plus border are added on top of it, not subtracted from it; box-sizing: border-box would make 200px the true rendered width instead by including padding/border inside it.',
              evaluationRubric: ['Does the arithmetic correctly (240px, not 200px)', 'Names content-box as the default behavior', 'Knows border-box is the common fix'],
            },
            {
              pattern: 'flex-wrap',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Your flex row of cards overflows horizontally on a narrow screen instead of stacking. What is missing?',
              expectedAnswer: 'flex-wrap: wrap on the container — without it, flex items default to flex-wrap: nowrap and will shrink or overflow rather than drop to a new line; adding wrap lets items that don\'t fit flow onto subsequent lines.',
              evaluationRubric: ['Names flex-wrap specifically, not just "responsive CSS"', 'Explains the default nowrap behavior', 'Distinguishes this from flex-direction: column'],
            },
          ],
          xpReward: 100,
          coinsReward: 50,
          skillMapping: { CSS: 25, Flexbox: 20 },
          difficulty: 'explorer',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a row of three pricing cards, equal width, that wraps to a column on narrow screens — using Flexbox with flex-wrap and gap, not floats or manual margins.',
            requirements: ['component:card'],
            resources: [{ title: 'Basic concepts of flexbox', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox', type: 'doc' }],
            hints: [
              'display:flex plus flex-wrap on the container is what lets cards drop to a new row on narrow screens.',
              'Use gap for spacing between cards, not margin, which is unreliable at the row edges.',
            ],
            evaluationCriteria: [
              'Container uses display:flex with flex-wrap',
              'Cards use flex:1 for equal width and gap for spacing, not margin',
            ],
            expectedSkills: ['CSS', 'Flexbox'],
            difficulty: 'explorer',
            multiplier: 0.6,
            xp: 100,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Challenge: Responsive Landing Page',
          slug: 'challenge-responsive-landing-page',
          description: 'Integrated challenge for Level 1 — a real landing page combining semantic HTML and Flexbox layout.',
          learningObjectives: ['Apply semantic HTML and Flexbox together in one real, submitted project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Level 1 integrated challenge (Part 4a). Complete it after Nodes 1 and 2.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'nav.*flex',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Explain why you built the navbar as flex instead of, say, floats or inline-block.',
              expectedAnswer: 'Flexbox handles vertical centering and space distribution natively without the clearfix hacks floats need or the whitespace issues inline-block has.',
              evaluationRubric: ['Names a concrete problem Flexbox avoids', 'Shows awareness of older layout techniques and why they were replaced'],
            },
            {
              pattern: '@media|min-width',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'What does "mobile-first" actually mean in how you wrote your CSS for this page?',
              expectedAnswer: 'The base (unqualified) styles target the narrowest screen first, and media queries with min-width add or override styles for wider viewports — the opposite of writing for desktop and using max-width queries to shrink things down, which tends to produce more overrides and heavier CSS for the common mobile case.',
              evaluationRubric: ['Correctly explains min-width vs max-width direction', 'Names base styles as the mobile baseline', 'Can justify why this ordering is preferred'],
            },
            {
              pattern: '<nav',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'The challenge required a "Navbar" component — would a <div className="navbar"> have satisfied that, functionally?',
              expectedAnswer: 'No — the Architecture Validator checks for a real semantic <nav> element (or an equivalent structural signal), not just a class name that happens to say "navbar"; a div with that class name looks right visually but provides none of the landmark semantics a real <nav> gives assistive technology.',
              evaluationRubric: ['Correctly says a div with a matching class name is not equivalent', 'Names the accessibility/semantic reason, not just "the grader would fail it"'],
            },
          ],
          xpReward: 150,
          coinsReward: 75,
          skillMapping: { HTML: 15, CSS: 15, Flexbox: 15, Responsive: 20 },
          difficulty: 'explorer',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a responsive landing page for a fictional product using semantic HTML and Flexbox layout — no CSS frameworks.',
            requirements: [
              'component:Navbar', 'component:Hero', 'component:Footer',
              'file:index.html', 'file:styles.css',
            ],
            resources: [
              { title: 'Basic concepts of flexbox', url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox', type: 'doc' },
            ],
            hints: [
              'Start with the HTML structure and semantic elements before touching CSS',
              'Build mobile-first: style for narrow screens, then add flex-direction changes for wider ones',
            ],
            evaluationCriteria: [
              'Uses semantic HTML elements, not div-only structure',
              'Navbar uses Flexbox for logo/links layout',
              'Layout does not break or overflow at mobile widths',
            ],
            expectedSkills: ['HTML', 'CSS', 'Flexbox', 'Responsive'],
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
      name: 'JavaScript Fundamentals',
      description: 'Real JavaScript: variables, functions, arrays/objects, the DOM, and events — no framework yet.',
      difficulty: 'beginner',
      estimatedDurationHours: 16,
      xpRequired: 200,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Variables, Functions & Arrays',
          slug: 'js-variables-functions-arrays',
          description: 'The core language: let/const, functions, arrow functions, and array methods that show up in every real codebase.',
          learningObjectives: [
            'Use let/const correctly and explain why var is avoided in modern code',
            'Write and use arrow functions, including implicit returns',
            'Use map/filter/reduce instead of manual for-loops for array transformations',
          ],
          videos: [{ title: 'JavaScript DOM Manipulation – Full Course', url: 'https://www.youtube.com/watch?v=aajhO5jTWq4', type: 'video' }],
          officialDocs: [
            { title: 'let - JavaScript', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let', type: 'doc' },
            { title: 'Array.prototype.map()', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map', type: 'doc' },
          ],
          notes: `let and const are block-scoped — they only exist inside the { } they were declared in, which is what var famously gets wrong (var leaks out of blocks into the enclosing function). Use const by default; use let only when you know the variable will be reassigned. You should almost never need var in code written today.

Arrow functions (const add = (a, b) => a + b) are shorter and, critically, don't rebind `+"`this`"+` the way regular function expressions do — that matters a lot once you're inside object methods or React components.

Array methods matter because they replace loops with declarative intent: .map() transforms every item into something new (returns a new array, same length). .filter() keeps only items matching a condition (returns a new, possibly shorter array). .reduce() folds an array down into a single value (a sum, an object, anything). None of them mutate the original array — that immutability is exactly what React's rendering model depends on later.`,
          cheatsheet: `const x = 1        — can't be reassigned, use by default
let x = 1          — can be reassigned, use when needed
const f = (a) => a * 2   — arrow function, implicit return
arr.map(x => x * 2)      — transform every item, same length
arr.filter(x => x > 5)   — keep matching items, new (shorter) array
arr.reduce((acc, x) => acc + x, 0)  — fold to a single value
const { a, b } = obj     — object destructuring
const [first, ...rest] = arr  — array destructuring + rest`,
          codeExamples: [
            {
              title: 'map/filter/reduce chained',
              language: 'javascript',
              code: `const prices = [10, 25, 5, 40];
const total = prices
  .filter(p => p > 8)
  .map(p => p * 1.1) // add 10% tax
  .reduce((sum, p) => sum + p, 0);
console.log(total);`,
            },
            {
              title: 'Destructuring in a function signature',
              language: 'javascript',
              code: `function renderUser({ name, email }) {
  return \`\${name} <\${email}>\`;
}`,
            },
          ],
          quizQuestions: [
            { question: 'What does .map() return?', options: ['A single value', 'A new array, same length as the original', 'The original array, mutated', 'undefined'], correctIndex: 1, explanation: '.map() always returns a new array with the same number of elements — one output per input.' },
            { question: 'Why prefer const over let by default?', options: ['const is faster at runtime', 'It signals intent — this binding will not be reassigned — making code easier to reason about', 'let does not work in all browsers', 'There is no real reason'], correctIndex: 1, explanation: 'It is a readability/intent signal, not a performance difference — const tells the next reader (or you, later) that this value never changes.' },
            { question: 'What is wrong with using var inside a for-loop body meant to be block-scoped?', options: ['Nothing', 'var leaks out of the block into the enclosing function scope, causing bugs with closures', 'var is deprecated syntax', 'It only works with numbers'], correctIndex: 1, explanation: 'var is function-scoped, not block-scoped — it "leaks" out of if/for blocks, a classic source of closure bugs that let fixes.' },
          ],
          miniProject: {
            title: 'Shopping cart totals',
            description: 'Given an array of cart item objects ({name, price, qty}), compute the total price using map/filter/reduce, no manual loops.',
            requirements: ['Uses array methods, not a for-loop', 'Correctly handles an empty cart (total = 0)'],
          },
          interviewBank: [
            {
              pattern: '\\.reduce\\(',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Walk me through what your .reduce() call is doing, step by step, for an input of [1, 2, 3].',
              expectedAnswer: 'reduce iterates the array carrying an accumulator; on each item it calls the callback with (accumulator, currentItem), and the return value becomes the new accumulator for the next iteration, starting from the initial value provided as the second argument.',
              evaluationRubric: ['Correctly traces accumulator through each step', 'Mentions the initial value argument', 'Can explain what happens if the initial value is omitted'],
            },
            {
              pattern: '\\.map\\(',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'What is the actual difference between .map() and .forEach() — could you swap one for the other here?',
              expectedAnswer: 'map returns a new array built from each callback\'s return value and is meant for transforming data; forEach returns undefined and is meant purely for side effects — using map and throwing away its result (or using forEach to build an array by pushing) both signal the wrong tool for the job, even if they happen to "work".',
              evaluationRubric: ['States map returns a new array, forEach does not', 'Identifies the intent difference (transform vs side effect)', 'Would not use forEach to build a new array via push'],
            },
            {
              pattern: '=>',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'You used an arrow function here instead of a regular function declaration. Does that choice matter, or is it just style?',
              expectedAnswer: 'For a standalone utility function like this, it is mostly style — but arrow functions do not have their own `this`, they inherit it from the enclosing scope, which matters a lot inside object methods or class-like contexts and is a real, common source of bugs when a regular function is used where lexical `this` was actually needed.',
              evaluationRubric: ['Names the lexical `this` behavior specifically', 'Does not claim they are functionally identical in every context', 'Can give a concrete scenario where the difference matters'],
            },
          ],
          xpReward: 100,
          coinsReward: 50,
          skillMapping: { JavaScript: 30 },
          difficulty: 'beginner',
          trustLevel: 'A',
          challenge: {
            objective: 'Given an array of cart item objects ({name, price, qty}), compute the total price using map/filter/reduce — no manual for-loops — and correctly return 0 for an empty cart.',
            requirements: ['component:total'],
            resources: [],
            hints: [
              'Chain map/filter/reduce rather than writing a manual for-loop to build the total.',
              'Guard against an empty array explicitly — reduce with no initial value throws on an empty array.',
            ],
            evaluationCriteria: [
              'Uses array methods (map/filter/reduce), not a manual for-loop',
              'An empty cart correctly computes a total of 0, not an error',
            ],
            expectedSkills: ['JavaScript'],
            difficulty: 'beginner',
            multiplier: 0.6,
            xp: 100,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'DOM & Events',
          slug: 'js-dom-events',
          description: 'Making a page interactive: selecting elements, listening for events, updating the DOM.',
          learningObjectives: [
            'Select elements with querySelector and update their content/attributes',
            'Attach event listeners and use event.preventDefault() where needed',
            'Understand event delegation and why it beats attaching a listener to every child',
          ],
          videos: [{ title: 'JavaScript DOM Manipulation – Full Course', url: 'https://www.youtube.com/watch?v=aajhO5jTWq4', type: 'video' }],
          officialDocs: [
            { title: 'Document.querySelector()', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector', type: 'doc' },
            { title: 'EventTarget.addEventListener()', url: 'https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener', type: 'doc' },
          ],
          notes: `document.querySelector('.foo') returns the first matching element (or null); querySelectorAll returns a static NodeList of all matches. Once you have an element, .textContent sets its text, .classList.add/remove/toggle manages classes, and .addEventListener('click', handler) wires up interaction.

A form's submit event fires when Enter is pressed or a submit button is clicked — call event.preventDefault() inside the handler or the browser will do a full page reload/navigation, which is almost never what you want in a JS-driven app.

Event delegation: instead of attaching a click listener to every single <li> in a list (expensive, and misses items added later), attach ONE listener to the parent <ul> and check event.target inside it to see which child was actually clicked. This is also conceptually the same trick React uses internally for its synthetic event system.`,
          cheatsheet: `document.querySelector('.foo')       — first match or null
document.querySelectorAll('.foo')     — all matches, static NodeList
el.textContent = 'hi'                 — set text
el.classList.add/remove/toggle('x')   — manage classes
el.addEventListener('click', fn)      — listen for an event
event.preventDefault()                — stop default browser behavior (e.g. form submit reload)
event.target                          — the actual element that triggered the event (for delegation)`,
          codeExamples: [
            {
              title: 'Event delegation on a list',
              language: 'javascript',
              code: `document.querySelector('ul').addEventListener('click', (event) => {
  if (event.target.tagName === 'LI') {
    event.target.classList.toggle('done');
  }
});`,
            },
            {
              title: 'Preventing default form submit',
              language: 'javascript',
              code: `form.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = form.querySelector('input').value;
  console.log('Submitted:', value);
});`,
            },
          ],
          quizQuestions: [
            { question: 'What happens if you forget event.preventDefault() in a form submit handler?', options: ['Nothing changes', 'The browser navigates/reloads the page as it would for a normal form', 'The handler does not run', 'An error is thrown'], correctIndex: 1, explanation: 'Without preventDefault(), the browser performs its default form submission behavior — a full page navigation — even though your handler also ran.' },
            { question: 'Why use event delegation instead of a listener per list item?', options: ['It is required by the DOM spec', 'One listener on the parent handles existing AND future children, and uses less memory', 'It is the only way to detect clicks', 'Delegation is faster to type'], correctIndex: 1, explanation: 'A single parent listener automatically covers items added later (since it checks event.target at click time) and avoids attaching/managing N separate listeners.' },
            { question: 'What does querySelector return if nothing matches?', options: ['An empty string', 'undefined', 'null', 'Throws an error'], correctIndex: 2, explanation: 'querySelector returns null on no match — a common source of "cannot read property of null" bugs if not checked.' },
          ],
          miniProject: {
            title: 'Vanilla-JS toggle list',
            description: 'A list of items where clicking any item toggles a "done" class, implemented with a single delegated event listener.',
            requirements: ['Uses event delegation, not one listener per item', 'Toggling persists visually via classList'],
          },
          interviewBank: [
            {
              pattern: 'addEventListener',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Your click handler is on the parent <ul>, not the <li> items. Why?',
              expectedAnswer: 'Event delegation — a single listener on the parent catches bubbled click events from any child, including ones added after the listener was attached, avoiding the cost and bookkeeping of one listener per item.',
              evaluationRubric: ['Explains event bubbling as the mechanism', 'Mentions dynamically-added children as a benefit', 'Can name event.target as how you know which child was clicked'],
            },
            {
              pattern: 'preventDefault',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'What actually happens in the browser if you remove event.preventDefault() from your form\'s submit handler?',
              expectedAnswer: 'Your handler still runs, but the browser also performs its own default action for a form submit — a full page navigation/reload to the form\'s action URL (or the current page if none is set) — which would wipe out any in-memory JS state you just built.',
              evaluationRubric: ['Correctly says the handler still runs either way', 'Names the page reload/navigation as the actual default behavior', 'Connects this to losing JS state'],
            },
            {
              pattern: 'querySelector',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'What does document.querySelector return if your selector matches nothing, and why does that matter?',
              expectedAnswer: 'It returns null, not undefined or an empty object — code that immediately calls a method or reads a property on the result without checking for null first will throw a "cannot read properties of null" error, a very common real-world bug.',
              evaluationRubric: ['Says null specifically, not undefined', 'Explains the resulting runtime error if unchecked', 'Contrasts with querySelectorAll returning an empty NodeList instead'],
            },
          ],
          xpReward: 100,
          coinsReward: 50,
          skillMapping: { JavaScript: 20, DOM: 20 },
          difficulty: 'beginner',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a list where clicking any item toggles a "done" class — using a single delegated event listener on the list container, not one listener per item.',
            requirements: ['component:list'],
            resources: [],
            hints: [
              'Attach the click listener once, on the parent list element, and check event.target inside the handler — that is event delegation.',
              'Use classList.toggle to flip the done class, not manual className string manipulation.',
            ],
            evaluationCriteria: [
              'Uses a single delegated listener, not one per list item',
              'Toggling is done via classList, and persists visually',
            ],
            expectedSkills: ['JavaScript', 'DOM'],
            difficulty: 'beginner',
            multiplier: 0.6,
            xp: 100,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Challenge: Interactive Todo List',
          slug: 'challenge-interactive-todo-list',
          description: 'Integrated challenge for Level 2 — a vanilla-JS todo app combining core JS, DOM, and events.',
          learningObjectives: ['Apply array methods and DOM/event handling together in one real, submitted project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Level 2 integrated challenge (Part 4a). Complete it after Nodes 1 and 2.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'localStorage',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Where are your todos actually stored, and what happens if the user refreshes the page?',
              expectedAnswer: 'Stored in localStorage as JSON; on load, the app reads and parses that JSON back into the in-memory array before rendering, so a refresh does not lose data.',
              evaluationRubric: ['Names localStorage specifically, not just "the browser"', 'Explains the JSON.stringify/parse round trip', 'Handles the empty/first-load case'],
            },
            {
              pattern: 'render|innerHTML',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'When a todo is added, do you insert one new <li> into the DOM, or re-render the whole list from the array? Which did you do, and why?',
              expectedAnswer: 'Re-rendering the whole list from a single source-of-truth array is simpler and less error-prone than surgically patching individual DOM nodes for every kind of change (add/toggle/delete) — the tradeoff is it is less efficient at large scale, which is exactly the problem frameworks like React solve with a virtual DOM diff, but for a todo list the simplicity wins.',
              evaluationRubric: ['States which approach they actually took', 'Names the array as the single source of truth', 'Aware of the efficiency tradeoff even if they chose full re-render'],
            },
            {
              pattern: 'trim\\(\\)|\\.length\\s*===?\\s*0',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'What happens if a user submits the add-todo form with an empty or whitespace-only input?',
              expectedAnswer: 'The submit handler should check the trimmed input length and simply not add a todo (and ideally not clear the input either) rather than silently adding a blank, meaningless list item — this is exactly the kind of edge case the challenge\'s "validation:empty todo text" requirement checks for.',
              evaluationRubric: ['Names trimming whitespace specifically, not just checking falsy', 'States the correct behavior is to reject, not silently add', 'Connects it to the actual submitted requirement'],
            },
          ],
          xpReward: 180,
          coinsReward: 90,
          skillMapping: { JavaScript: 20, DOM: 20, 'State Management': 10 },
          difficulty: 'beginner',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a todo list app in vanilla JavaScript (no framework): add, complete, delete items, persisted in localStorage.',
            requirements: [
              'file:index.html', 'file:script.js',
              'validation:empty todo text',
            ],
            resources: [
              { title: 'Window: localStorage property', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage', type: 'doc' },
            ],
            hints: [
              'Keep a single array as the source of truth, re-render from it rather than mutating the DOM piecemeal',
              'Save to localStorage after every change, load from it on page load',
            ],
            evaluationCriteria: [
              'Items can be added, marked complete, and deleted',
              'State survives a page refresh via localStorage',
              'Uses event delegation for item click handling, not per-item listeners',
            ],
            expectedSkills: ['JavaScript', 'DOM', 'State Management'],
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
      name: 'React Fundamentals',
      description: 'Components, props, and local state — the first real React app.',
      difficulty: 'intermediate',
      estimatedDurationHours: 18,
      xpRequired: 500,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Components & Props',
          slug: 'react-components-props',
          description: 'Building UI out of small, reusable, composable functions.',
          learningObjectives: [
            'Write a functional component and understand JSX as syntax sugar over function calls',
            'Pass data down via props and understand that props are read-only',
            'Compose multiple small components into a page',
          ],
          videos: [{ title: 'Intro to React Hooks with useState and useEffect', url: 'https://www.youtube.com/watch?v=P5p3vMeJ6LQ', type: 'video' }],
          officialDocs: [
            { title: 'Your First Component – React', url: 'https://react.dev/learn/your-first-component', type: 'doc' },
            { title: 'Passing Props to a Component', url: 'https://react.dev/learn/passing-props-to-a-component', type: 'doc' },
          ],
          notes: `A React component is just a function that returns JSX (HTML-like syntax that compiles to React.createElement calls). Component names must be capitalized — <userCard /> is treated as an HTML tag, <UserCard /> as a component.

Props are how a parent passes data to a child: <UserCard name="Asha" role="Engineer" /> — inside UserCard, those arrive as a single object argument: function UserCard({ name, role }) {...}. Props are read-only from the child's perspective; a component must never reassign its own props.

Composition beats one giant component: a Page component renders <Navbar />, <Hero />, <Footer /> rather than being 300 lines of mixed markup. This is also exactly what the Architecture Validator's "component:X" requirements check for — a real, separately-defined component named X, not a chunk of JSX with the right className.`,
          cheatsheet: `function Greeting({ name }) { return <h1>Hi {name}</h1>; }  — functional component
<Greeting name="Asha" />           — passing a prop
{props.children}                   — render whatever was nested inside the tag
Component names: PascalCase        — lowercase tags are treated as HTML
Props are read-only in the child   — never reassign them`,
          codeExamples: [
            {
              title: 'A composable page from small components',
              language: 'jsx',
              code: `function Navbar() {
  return <nav>My Site</nav>;
}
function Hero({ title }) {
  return <h1>{title}</h1>;
}
function Page() {
  return (
    <>
      <Navbar />
      <Hero title="Welcome" />
    </>
  );
}`,
            },
            {
              title: 'children prop',
              language: 'jsx',
              code: `function Card({ children }) {
  return <div className="card">{children}</div>;
}
// usage: <Card><p>Inside the card</p></Card>`,
            },
          ],
          quizQuestions: [
            { question: 'Why must a component name start with a capital letter?', options: ['Style convention only, no functional reason', 'JSX treats lowercase tags as native HTML elements and capitalized ones as components', 'React requires it for performance', 'It affects file size'], correctIndex: 1, explanation: 'JSX/React uses the case of the tag name to decide whether to render a DOM element or call your component function — lowercase always means "HTML tag".' },
            { question: 'Can a component reassign a prop it receives, e.g. props.name = "new value"?', options: ['Yes, freely', 'No — props are read-only from the receiving component\'s perspective', 'Only for string props', 'Only inside useEffect'], correctIndex: 1, explanation: 'Props flow one way, parent to child — mutating them breaks React\'s data-flow model and will not do what you expect.' },
            { question: 'What does the special "children" prop represent?', options: ['An array of child component names', 'Whatever JSX was nested between a component\'s opening and closing tags', 'A list of the component\'s own hooks', 'Nothing, it does not exist'], correctIndex: 1, explanation: '<Card><p>hi</p></Card> passes the <p>hi</p> element to Card as props.children — that is how wrapper/layout components work.' },
          ],
          miniProject: {
            title: 'Build a ProductCard component',
            description: 'A reusable ProductCard component accepting name/price/image props, rendered 3 times with different data in a parent.',
            requirements: ['ProductCard is a separate, reusable component', 'Parent renders 3 instances with different props', 'No hardcoded data inside ProductCard itself'],
          },
          interviewBank: [
            {
              pattern: 'function \\w+\\(\\{',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Explain what happens when React renders <ProductCard name="Chair" price={40} />.',
              expectedAnswer: 'React calls the ProductCard function with a single props object { name: "Chair", price: 40 }, and whatever JSX it returns is what gets rendered to the DOM for that position.',
              evaluationRubric: ['Correctly describes props as a single object argument', 'Knows props are read-only', 'Can explain re-render behavior if the prop value changes'],
            },
            {
              pattern: 'function [a-z]',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'If I renamed your ProductCard function to lowercase, productCard, and used <productCard /> in JSX, what would happen?',
              expectedAnswer: 'React would treat it as an unknown native HTML tag, not as a call to the component function — JSX decides component vs. DOM element purely by whether the tag name starts with a capital letter, so this would silently render an invalid/empty custom element instead of the actual card.',
              evaluationRubric: ['Correctly identifies it would be treated as an HTML tag, not a component', 'Names capitalization as the actual rule JSX uses', 'Does not claim it would throw a compile error'],
            },
            {
              pattern: 'children',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'How would you write a reusable Card wrapper that can render completely different content inside it each time it is used?',
              expectedAnswer: 'Accept and render props.children instead of hardcoding what goes inside — whatever JSX is nested between <Card> and </Card> at the call site is automatically passed in as children, letting the same Card component wrap arbitrary content without needing a prop for every possible thing that could go inside it.',
              evaluationRubric: ['Names props.children specifically', 'Explains it is populated by nested JSX at the usage site', 'Distinguishes this from passing content as a named prop'],
            },
          ],
          xpReward: 120,
          coinsReward: 60,
          skillMapping: { React: 25, JavaScript: 10 },
          difficulty: 'intermediate',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a reusable ProductCard component accepting name/price/image as props, and render it three times with different data from a parent — no hardcoded data inside ProductCard itself.',
            requirements: ['component:ProductCard'],
            resources: [{ title: 'Passing Props to a Component', url: 'https://react.dev/learn/passing-props-to-a-component', type: 'doc' }],
            hints: [
              'ProductCard should read every value it displays from its props, not from hardcoded strings inside the component.',
              'Render it three separate times in the parent with three different prop values.',
            ],
            evaluationCriteria: [
              'ProductCard is a separate, reusable component',
              'No data is hardcoded inside ProductCard itself — it all comes from props',
            ],
            expectedSkills: ['React', 'JavaScript'],
            difficulty: 'intermediate',
            multiplier: 0.7,
            xp: 120,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'State & Events in React',
          slug: 'react-state-events',
          description: 'useState, controlled inputs, and handling clicks/form submits the React way.',
          learningObjectives: [
            'Use useState to give a component memory across re-renders',
            'Build a controlled input where React state is the single source of truth',
            'Handle events (onClick, onSubmit) and update state immutably',
          ],
          videos: [{ title: 'Intro to React Hooks with useState and useEffect', url: 'https://www.youtube.com/watch?v=P5p3vMeJ6LQ', type: 'video' }],
          officialDocs: [
            { title: 'State: A Component\'s Memory', url: 'https://react.dev/learn/state-a-components-memory', type: 'doc' },
            { title: 'Responding to Events', url: 'https://react.dev/learn/responding-to-events', type: 'doc' },
          ],
          notes: `const [count, setCount] = useState(0) gives a component a piece of state that survives re-renders, plus a setter function. Calling setCount(count + 1) doesn't mutate count directly — it tells React "re-render this component with the new value," which is why you never write count = count + 1 directly.

A controlled input ties an <input>'s value to React state: value={text} onChange={e => setText(e.target.value)}. React state is now the single source of truth for what's in the box, not the DOM itself — this is what lets you validate, transform, or reset the input's value from your own code.

State updates on objects/arrays must be immutable: setItems([...items, newItem]) not items.push(newItem). React compares old vs new state by reference to decide whether to re-render — mutating in place means the reference never changes and React may not notice the update.`,
          cheatsheet: `const [state, setState] = useState(initialValue)
setState(newValue)                — triggers a re-render, does not mutate in place
<input value={x} onChange={e => setX(e.target.value)} />   — controlled input
onClick={() => doSomething()}     — inline handler (careful: new function every render)
setItems([...items, newItem])     — immutable array update, never items.push()
setUser({ ...user, name: 'new' }) — immutable object update`,
          codeExamples: [
            {
              title: 'A controlled input with a counter',
              language: 'jsx',
              code: `function NameForm() {
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(name);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={e => setName(e.target.value)} />
      <button type="submit">Save</button>
      {submitted && <p>Saved: {submitted}</p>}
    </form>
  );
}`,
            },
            {
              title: 'Immutable array update',
              language: 'jsx',
              code: `function addTodo(text) {
  setTodos(prev => [...prev, { id: Date.now(), text, done: false }]);
}`,
            },
          ],
          quizQuestions: [
            { question: 'Why does React re-render when you call setCount, but not when you write count = count + 1 directly?', options: ['Direct assignment throws an error', 'setState schedules a re-render; a plain variable reassignment is invisible to React\'s tracking', 'There is no difference', 'count is a constant so reassignment is impossible'], correctIndex: 1, explanation: 'React only knows to re-render when you go through the setter it gave you — that is the entire mechanism by which state changes become visible.' },
            { question: 'What makes an <input> a "controlled" input?', options: ['It has a name attribute', 'Its value is driven by React state, and onChange updates that state', 'It is required', 'It uses a ref'], correctIndex: 1, explanation: 'Controlled means React state is the single source of truth for the input\'s value — the DOM value is just a reflection of state, updated via onChange.' },
            { question: 'What is wrong with setItems(items.push(newItem))?', options: ['Nothing, this is correct', 'push mutates the array in place and returns the new length, not the array — this breaks React\'s state comparison', 'push does not exist on arrays', 'It is slower than a for-loop'], correctIndex: 1, explanation: 'push() mutates in place (so React can\'t detect the change by reference) and returns the new length (a number), not the array — setItems would receive the wrong value entirely.' },
          ],
          miniProject: {
            title: 'Controlled search filter',
            description: 'A controlled text input that filters a hardcoded list of names as the user types, showing only matches.',
            requirements: ['Input value is driven by useState (controlled)', 'Filtering happens on every keystroke, case-insensitive'],
          },
          interviewBank: [
            {
              pattern: 'useState',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'If I call setCount twice in a row inside the same event handler, does the component re-render twice?',
              expectedAnswer: 'No — React batches state updates that occur within the same event handler into a single re-render for performance, applying both updates before rendering once.',
              evaluationRubric: ['Mentions batching specifically', 'Does not claim two separate re-renders happen', 'Bonus: aware this is more nuanced/automatic in recent React versions'],
            },
            {
              pattern: 'value=\\{',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'What would break if you set an input\'s value to state but forgot the onChange handler?',
              expectedAnswer: 'The input would become read-only in effect — React would keep resetting the displayed value back to whatever the state holds on every keystroke, since nothing ever updates that state, which is a very common "why can\'t I type in this box" bug for controlled inputs.',
              evaluationRubric: ['Correctly predicts the input appears frozen/unresponsive', 'Explains why: state never changes so React keeps re-rendering the same value', 'Knows onChange is what closes the loop'],
            },
            {
              pattern: 'setItems|setTodos|setUsers',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'Why is setItems(items.push(newItem)) wrong, even though push() is a real array method?',
              expectedAnswer: 'push mutates the array in place and returns the new array length (a number), not the array itself — so setItems would receive a number instead of the updated array, and even if it somehow received the right array, mutating in place means React can\'t detect a state change by reference comparison and may skip the re-render.',
              evaluationRubric: ['Correctly identifies push\'s return value as the bug', 'Also mentions the mutation/reference-comparison problem', 'Knows the fix is spreading into a new array'],
            },
          ],
          xpReward: 120,
          coinsReward: 60,
          skillMapping: { React: 25, Hooks: 20, 'State Management': 15 },
          difficulty: 'intermediate',
          trustLevel: 'A',
          challenge: {
            objective: 'Build a controlled text input that filters a hardcoded list of names as the user types — case-insensitive, updating on every keystroke.',
            requirements: ['state:useState'],
            resources: [{ title: 'State: A Component\'s Memory', url: 'https://react.dev/learn/state-a-components-memory', type: 'doc' }],
            hints: [
              'The input\'s value must come from state (value={query}), with onChange updating that state — that is what makes it "controlled".',
              'Lowercase both the query and each name before comparing, so the filter is case-insensitive.',
            ],
            evaluationCriteria: [
              'Input value is driven by useState, not read directly from the DOM',
              'Filtering updates on every keystroke and is case-insensitive',
            ],
            expectedSkills: ['React', 'Hooks', 'State Management'],
            difficulty: 'intermediate',
            multiplier: 0.7,
            xp: 120,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Challenge: React Todo App',
          slug: 'challenge-react-todo-app',
          description: 'Integrated challenge for Level 3 — rebuild the Level 2 todo app in React with components and state.',
          learningObjectives: ['Apply components, props, and useState together in one real, submitted project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Level 3 integrated challenge (Part 4a). Complete it after Nodes 1 and 2.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'key=\\{',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'You are mapping over an array of todos to render list items. Why does each one need a unique key prop?',
              expectedAnswer: 'React uses the key to match array items across re-renders so it can correctly reorder, add, or remove DOM nodes instead of re-rendering the whole list — using array index as key breaks this when items are reordered or removed.',
              evaluationRubric: ['Explains reconciliation/matching, not just "React requires it"', 'Flags index-as-key as a common pitfall', 'Knows a stable id is the correct key'],
            },
            {
              pattern: 'AddTodoForm|onAddTodo',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'AddTodoForm needs to add an item to the list that TodoList renders. They are siblings — how does data get from one to the other?',
              expectedAnswer: 'The todos array and the function to update it live in their common parent (or the top-level component); the parent passes the update function down to AddTodoForm as a prop and the current array down to TodoList as a prop — this is "lifting state up", the standard pattern for sibling components that need to share data in React.',
              evaluationRubric: ['Names lifting state up specifically', 'Correctly identifies the parent as the state owner', 'Does not propose siblings talking directly to each other'],
            },
            {
              pattern: 'todo\\.id|item\\.id',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'If you deleted the middle todo from a list keyed by array index instead of a stable id, what would actually go wrong on screen?',
              expectedAnswer: 'React would reuse the DOM nodes by position, not by identity — so after a middle item is removed, every item after it shifts up an index and inherits the DOM state (like a checked checkbox or in-progress edit) that belonged to a different todo, producing a UI that visually shows the wrong item as completed or being edited.',
              evaluationRubric: ['Gives a concrete, specific symptom, not just "it breaks"', 'Explains it is about state-per-DOM-node getting reused incorrectly', 'Confirms stable ids fix it'],
            },
          ],
          xpReward: 200,
          coinsReward: 100,
          skillMapping: { React: 20, Hooks: 15, 'State Management': 15, JavaScript: 10 },
          difficulty: 'intermediate',
          trustLevel: 'A',
          challenge: {
            objective: 'Rebuild the todo list from Level 2 as a React app: TodoList, TodoItem, and AddTodoForm components sharing state via props/useState.',
            requirements: [
              'component:TodoList', 'component:TodoItem', 'component:AddTodoForm',
              'state:useState',
            ],
            resources: [{ title: 'State: A Component\'s Memory', url: 'https://react.dev/learn/state-a-components-memory', type: 'doc' }],
            hints: [
              'Keep the todos array in the parent (TodoList) and pass items + handlers down as props',
              'Each TodoItem needs a stable key — use the todo\'s id, not its array index',
            ],
            evaluationCriteria: [
              'State lives in one place and flows down via props, not duplicated across components',
              'Adding, completing, and deleting a todo all work correctly',
              'List rendering uses a stable, unique key',
            ],
            expectedSkills: ['React', 'Hooks', 'State Management'],
            difficulty: 'intermediate',
            multiplier: 1.5,
            xp: 200,
            challengeType: 'career',
          },
        },
      ],
    },

    // ───────────────────────── Level 4 ─────────────────────────
    {
      levelNumber: 4,
      name: 'React Hooks & Data Fetching',
      description: 'useEffect, side effects, and pulling real data from an API.',
      difficulty: 'advanced',
      estimatedDurationHours: 20,
      xpRequired: 1000,
      nodes: [
        {
          nodeNumber: 1,
          title: 'useEffect & Side Effects',
          slug: 'react-useeffect',
          description: 'Running code in response to renders — data fetching, subscriptions, timers.',
          learningObjectives: [
            'Explain when useEffect runs relative to rendering',
            'Use the dependency array correctly to control when an effect re-runs',
            'Clean up effects (timers, subscriptions) to avoid memory leaks',
          ],
          videos: [{ title: 'Intro to React Hooks with useState and useEffect', url: 'https://www.youtube.com/watch?v=P5p3vMeJ6LQ', type: 'video' }],
          officialDocs: [{ title: 'Synchronizing with Effects', url: 'https://react.dev/learn/synchronizing-with-effects', type: 'doc' }],
          notes: `useEffect(fn, deps) runs fn after the browser has painted the render. The dependency array controls WHEN it re-runs: [] means "once, on mount only"; [userId] means "on mount, and again whenever userId changes"; omitting the array entirely means "after every single render" (rarely what you want).

The classic use case is data fetching: useEffect(() => { fetch(...).then(setData) }, [id]) — refetch whenever id changes. Returning a function from the effect is the cleanup — React calls it before the next effect run (or on unmount), which is where you clear a timer (clearInterval) or unsubscribe from something, or it'll keep running in the background after the component is gone.

A very common bug: fetching inside useEffect without checking whether the component is still mounted when the response arrives, causing a "state update on an unmounted component" — the fix is either a cleanup flag or an AbortController.`,
          cheatsheet: `useEffect(() => { ... }, [])          — run once on mount
useEffect(() => { ... }, [dep])       — run on mount + whenever dep changes
useEffect(() => { ... })              — run after every render (rarely correct)
useEffect(() => { return () => cleanup() }, [dep])  — cleanup before next run / on unmount
fetch(url).then(r => r.json()).then(setData)  — basic fetch + state pattern`,
          codeExamples: [
            {
              title: 'Fetching data for a given id',
              language: 'jsx',
              code: `function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(\`/api/users/\${userId}\`)
      .then(res => res.json())
      .then(data => { if (!cancelled) setUser(data); });
    return () => { cancelled = true; };
  }, [userId]);

  if (!user) return <p>Loading...</p>;
  return <p>{user.name}</p>;
}`,
            },
            {
              title: 'Cleaning up a timer',
              language: 'jsx',
              code: `useEffect(() => {
  const id = setInterval(() => setTick(t => t + 1), 1000);
  return () => clearInterval(id);
}, []);`,
            },
          ],
          quizQuestions: [
            { question: 'With useEffect(fn, [userId]), when does fn run?', options: ['Only once, ever', 'After mount, and again every time userId changes value', 'Before every render', 'Only when the component unmounts'], correctIndex: 1, explanation: 'The dependency array means "re-run this effect whenever any listed value changes" — plus always once on mount.' },
            { question: 'What is the function returned from inside useEffect used for?', options: ['It has no special meaning', 'Cleanup — called before the next effect run and on unmount', 'It replaces the component\'s render output', 'It sets the initial state'], correctIndex: 1, explanation: 'That returned function is React\'s cleanup hook for the effect — used to clear timers, cancel requests, or unsubscribe.' },
            { question: 'What bug does the "cancelled" flag in the fetch example prevent?', options: ['Network errors', 'Calling setUser after the component has already unmounted', 'Slow requests', 'CORS errors'], correctIndex: 1, explanation: 'If the component unmounts before the fetch resolves, calling setState afterward is a bug (and a React warning) — the cancelled flag guards against acting on a stale response.' },
          ],
          miniProject: {
            title: 'Live clock component',
            description: 'A component that displays the current time, updating every second, with the interval properly cleaned up on unmount.',
            requirements: ['Uses useEffect with setInterval', 'Cleans up the interval in the effect\'s return function'],
          },
          interviewBank: [
            {
              pattern: 'useEffect\\(',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Your useEffect has an empty dependency array but ESLint is warning about a missing dependency. What is that warning telling you, and should you always silence it?',
              expectedAnswer: 'The linter is flagging a value used inside the effect that is not listed in the dependency array, meaning the effect could run against a stale closure over that value — sometimes silencing it is genuinely correct (e.g. a true "run once" effect), but it should be a deliberate decision, not a reflex, since it is a common source of stale-state bugs.',
              evaluationRubric: ['Explains stale closures as the underlying risk', 'Does not say "always just add eslint-disable"', 'Can describe a legitimate case for intentionally omitting a dependency'],
            },
            {
              pattern: 'clearInterval|clearTimeout',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'You start a setInterval inside useEffect but the component can unmount (e.g. the user navigates away) before it would naturally stop. What happens if you don\'t clean it up?',
              expectedAnswer: 'The interval keeps running in the background against a component that no longer exists, wasting resources, and if its callback calls a state setter, React will log a warning about updating state on an unmounted component — the fix is returning a cleanup function from the effect that calls clearInterval on the stored interval id.',
              evaluationRubric: ['Names the leaked timer specifically, not just "a bug"', 'Mentions the unmounted-component setState warning', 'Knows the fix is the effect\'s return/cleanup function'],
            },
            {
              pattern: '\\[\\]|\\[userId\\]|\\[id\\]',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What is the actual difference between useEffect(fn, []) and useEffect(fn) with no array at all?',
              expectedAnswer: 'An empty array means the effect runs exactly once, after the initial render, and never again on its own; omitting the array entirely means the effect re-runs after every single render, which for something like a data fetch would trigger a new request on every state change or parent re-render — almost never the intended behavior.',
              evaluationRubric: ['Correctly contrasts "once" vs "every render"', 'Gives a concrete consequence of omitting the array (e.g. refetch loop)', 'Does not confuse this with omitting a specific dependency, which is a different mistake'],
            },
          ],
          xpReward: 140,
          coinsReward: 70,
          skillMapping: { React: 20, Hooks: 30, 'API Integration': 15 },
          difficulty: 'advanced',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a component that displays the current time, updating every second via setInterval inside useEffect, with the interval properly cleaned up on unmount.',
            requirements: ['state:useState'],
            resources: [{ title: 'Synchronizing with Effects', url: 'https://react.dev/learn/synchronizing-with-effects', type: 'doc' }],
            hints: [
              'setInterval belongs inside useEffect, started once with an empty dependency array.',
              'Return a cleanup function from the effect that calls clearInterval — skipping this leaks a running timer every time the component unmounts.',
            ],
            evaluationCriteria: [
              'Uses useEffect with setInterval to update the time',
              'The effect\'s cleanup function actually clears the interval on unmount',
            ],
            expectedSkills: ['React', 'Hooks', 'API Integration'],
            difficulty: 'advanced',
            multiplier: 0.8,
            xp: 140,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'Consuming a Real API',
          slug: 'react-api-integration',
          description: 'Loading states, error handling, and rendering real data from a public API.',
          learningObjectives: [
            'Handle the three states of an async request: loading, success, error',
            'Parse and render JSON data returned from an API',
            'Handle a failed request gracefully instead of leaving the UI stuck',
          ],
          videos: [{ title: 'How to build a REST API with Node & Express', url: 'https://www.youtube.com/watch?v=pKd0Rpw7O48', type: 'video' }],
          officialDocs: [{ title: 'Fetch API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API', type: 'doc' }],
          notes: `Every real API call has three states your UI needs to handle: loading (request in flight — show a spinner, not a blank screen), success (render the data), and error (the request failed — show something useful, not a silently broken page). Skipping the error state is one of the most common gaps in junior-level submissions.

fetch() only rejects on network failure — a 404 or 500 response is still a "successful" fetch from fetch()'s point of view, so you must check res.ok (or res.status) yourself before assuming the JSON body is valid data.

A clean pattern: three pieces of state (data, loading, error), set loading true before the fetch, set data and loading false on success, set error and loading false on failure — and render conditionally off those three flags.`,
          cheatsheet: `const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

fetch(url)
  .then(res => { if (!res.ok) throw new Error('Request failed'); return res.json(); })
  .then(setData)
  .catch(err => setError(err.message))
  .finally(() => setLoading(false));

if (loading) return <Spinner />;
if (error) return <ErrorMessage text={error} />;
return <DataView data={data} />;`,
          codeExamples: [
            {
              title: 'Full loading/error/success pattern',
              language: 'jsx',
              code: `function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/users')
      .then(res => {
        if (!res.ok) throw new Error(\`Request failed: \${res.status}\`);
        return res.json();
      })
      .then(setUsers)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}`,
            },
          ],
          quizQuestions: [
            { question: 'Does fetch() reject its promise for a 404 response?', options: ['Yes, always', 'No — it only rejects on network failure; you must check res.ok yourself for HTTP error statuses', 'Only for 500 errors', 'Only in Chrome'], correctIndex: 1, explanation: 'fetch resolves even for 4xx/5xx responses — checking res.ok (or res.status) is the caller\'s responsibility.' },
            { question: 'What is wrong with a component that only handles the success case (renders data, nothing else)?', options: ['Nothing, this is fine for simple apps', 'A failed or slow request leaves the user staring at a blank/broken screen with no feedback', 'It will not compile', 'It is slower'], correctIndex: 1, explanation: 'Real networks fail and are sometimes slow — omitting loading/error states means users get no feedback when that happens, which reads as a broken app.' },
            { question: 'Why call setLoading(false) in a .finally() rather than in both .then() and .catch()?', options: ['finally is faster', 'It runs regardless of success or failure, avoiding duplicated code in both branches', 'catch does not allow setState', 'There is no functional reason'], correctIndex: 1, explanation: '.finally() runs after either .then or .catch resolves/rejects, so it is the single correct place to turn off a loading flag without repeating yourself.' },
          ],
          miniProject: {
            title: 'Public API list view',
            description: 'Fetch and render a list from any public JSON API, with correct loading and error states.',
            requirements: ['All three states (loading/success/error) are handled and visibly different', 'A deliberately broken URL shows the error state, not a blank page'],
          },
          interviewBank: [
            {
              pattern: 'res\\.ok',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What would happen in your app right now if this API returned a 500 error — walk me through it.',
              expectedAnswer: 'Since fetch does not reject on HTTP error statuses, the response would resolve normally; the res.ok check throws, which the .catch() picks up, setting the error state and rendering the error UI instead of trying to render invalid/missing data.',
              evaluationRubric: ['Correctly traces the flow through res.ok to catch()', 'Does not assume fetch auto-rejects on 500', 'Confirms the UI actually changes, not just that an error is "caught" silently'],
            },
            {
              pattern: 'loading|Spinner',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'Why not just render nothing while the request is in flight instead of a loading state?',
              expectedAnswer: 'A blank screen is indistinguishable from a broken page to the user — they cannot tell whether the app is working or has frozen; an explicit loading indicator communicates "this is normal, wait a moment" and is especially important on slow connections where the difference between 200ms and 3 seconds is very noticeable.',
              evaluationRubric: ['Names the blank-screen-looks-broken problem specifically', 'Connects it to real-world variable network speed', 'Does not dismiss loading states as purely cosmetic'],
            },
            {
              pattern: '\\.finally\\(',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Why put setLoading(false) in .finally() instead of once at the end of .then() and again inside .catch()?',
              expectedAnswer: '.finally() runs after the promise settles regardless of whether it resolved or rejected, so it is the single place to guarantee loading gets turned off either way — duplicating setLoading(false) in both .then() and .catch() works too but is repeated code that is easy to forget to update consistently if the logic changes later.',
              evaluationRubric: ['Correctly explains finally runs on both success and failure', 'Names code duplication/consistency as the reason to prefer it', 'Does not claim .then()/.catch() alone cannot achieve the same result'],
            },
          ],
          xpReward: 140,
          coinsReward: 70,
          skillMapping: { React: 15, 'API Integration': 30, 'Error Handling': 20 },
          difficulty: 'advanced',
          trustLevel: 'B',
          challenge: {
            objective: 'Fetch and render a list from any public JSON API, correctly handling all three states — loading, success, and error — with a deliberately broken URL visibly showing the error state, not a blank page.',
            requirements: ['state:useState'],
            resources: [{ title: 'Fetch API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API', type: 'doc' }],
            hints: [
              'Track loading/data/error as separate state, and render a distinct UI for each — never leave the user looking at a blank screen while any of them is true.',
              'Test the error state for real by pointing at a URL you know will fail, not just by inspecting the code.',
            ],
            evaluationCriteria: [
              'All three states (loading/success/error) are handled and visibly different',
              'A broken URL actually shows the error UI, not a blank page or unhandled crash',
            ],
            expectedSkills: ['React', 'API Integration', 'Error Handling'],
            difficulty: 'advanced',
            multiplier: 0.8,
            xp: 140,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Challenge: Weather Dashboard',
          slug: 'challenge-weather-dashboard',
          description: 'Integrated challenge for Level 4 — a weather app fetching real data from a public API with full state handling.',
          learningObjectives: ['Apply useEffect, API fetching, and loading/error states together in one real, submitted project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Level 4 integrated challenge (Part 4a), and this level\'s Milestone Project. Complete it after Nodes 1 and 2.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'catch\\(',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What happens in your weather app if the user types a city that does not exist?',
              expectedAnswer: 'The API returns an error response (often a 404 for an unknown location), res.ok is false, an error is thrown and caught, and the app shows an error message instead of crashing or showing stale/wrong data.',
              evaluationRubric: ['Traces the actual failure path in their own code', 'Confirms a real, visible error state exists for this case', 'Does not just say "it would work"'],
            },
            {
              pattern: 'onSubmit|handleSearch',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Does your app send a request on every keystroke as the user types the city name, or only when they submit?',
              expectedAnswer: 'Firing a request on every keystroke wastes calls against most APIs\' rate limits and shows flickering loading/error states for an incomplete, likely-invalid query — requiring an explicit submit (or debouncing keystrokes with a delay) means the request only fires once the user has actually finished typing a real search term.',
              evaluationRubric: ['States which approach was actually taken', 'Names rate limits or wasted requests as the concrete cost of per-keystroke fetching', 'Knows debouncing as the alternative if search-as-you-type is genuinely wanted'],
            },
            {
              pattern: 'WeatherCard|data\\.',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'How would I know, just from looking at your WeatherCard, whether it is rendering the real API response or hardcoded placeholder data you left in during development?',
              expectedAnswer: 'The component should render values that trace directly back to the fetched response object (e.g. data.main.temp), not hardcoded strings/numbers left over from prototyping — the honest test is changing the searched city and confirming the displayed numbers actually change, which is exactly what the "successful responses render real data" evaluation criterion is checking.',
              evaluationRubric: ['Names tracing data back to the actual API response as the test', 'Connects this to the specific evaluation criterion', 'Would not accept "it looks right" as sufficient proof'],
            },
          ],
          xpReward: 250,
          coinsReward: 125,
          skillMapping: { React: 15, Hooks: 15, 'API Integration': 25, 'Error Handling': 15 },
          difficulty: 'advanced',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a weather dashboard: search a city, fetch real weather data from a public API, and display it with correct loading/error handling.',
            requirements: [
              'component:SearchBar', 'component:WeatherCard',
              'api-response:temperature', 'error-handling:',
            ],
            resources: [{ title: 'Fetch API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API', type: 'doc' }],
            hints: [
              'Debounce or require an explicit submit before firing the search request, do not fetch on every keystroke',
              'Test the "city not found" path deliberately, not just the happy path',
            ],
            evaluationCriteria: [
              'Loading state shown while a request is in flight',
              'Error state shown for an invalid/unknown city, not a blank screen or crash',
              'Successful responses render real data, not hardcoded placeholders',
            ],
            expectedSkills: ['React', 'Hooks', 'API Integration', 'Error Handling'],
            difficulty: 'advanced',
            multiplier: 1.8,
            xp: 250,
            challengeType: 'milestone',
          },
        },
      ],
    },

    // ───────────────────────── Level 5 ─────────────────────────
    {
      levelNumber: 5,
      name: 'Auth & Capstone',
      description: 'Client-side authentication and a final, recruiter-facing capstone project.',
      difficulty: 'professional',
      estimatedDurationHours: 24,
      xpRequired: 2000,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Client-Side Auth & Protected Routes',
          slug: 'react-auth-protected-routes',
          description: 'Storing a JWT, sending it with requests, and gating routes behind login.',
          learningObjectives: [
            'Explain why a JWT is stored and attached to authenticated requests',
            'Build a protected route that redirects unauthenticated users to login',
            'Understand the tradeoffs of localStorage vs. httpOnly cookies for token storage',
          ],
          videos: [{ title: 'JWT Authentication | Node JS and Express tutorials', url: 'https://www.youtube.com/watch?v=favjC6EKFgw', type: 'video' }],
          officialDocs: [{ title: 'jwt.io Introduction', url: 'https://jwt.io/introduction', type: 'doc' }],
          notes: `After a successful login, a backend typically returns a JWT — a signed token the client stores and sends back on every subsequent authenticated request (usually as an Authorization: Bearer <token> header). The frontend's job is not to validate the token's signature (that's the server's job) — it just needs to store it, attach it, and react to 401 responses by clearing it and redirecting to login.

Where to store it: localStorage is simple but readable by any JavaScript on the page, making it vulnerable to XSS-based token theft; an httpOnly cookie is inaccessible to JavaScript entirely (safer against XSS) but requires CSRF protection instead. For a Phase-1 challenge, localStorage is acceptable and simpler — but a real interview answer should be able to name this tradeoff, not just say "I used localStorage" with no justification.

A protected route component checks whether a token exists (and, ideally, whether it's expired) before rendering its children, redirecting to /login otherwise — this is a gate, not real security, since a determined user can still hit the API directly; the actual authorization must always be enforced server-side too.`,
          cheatsheet: `localStorage.setItem('token', jwt)         — store after login
localStorage.getItem('token')              — read for requests
fetch(url, { headers: { Authorization: \`Bearer \${token}\` } })  — attach to a request
localStorage.removeItem('token')           — clear on logout / 401
ProtectedRoute: check token exists, else redirect to /login
Real security is always enforced server-side, never trust the client-side gate alone`,
          codeExamples: [
            {
              title: 'A minimal protected route',
              language: 'jsx',
              code: `function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" />;
  }
  return children;
}`,
            },
            {
              title: 'Attaching the token to a fetch call',
              language: 'jsx',
              code: `async function getMyProfile() {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/me', {
    headers: { Authorization: \`Bearer \${token}\` },
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }
  return res.json();
}`,
            },
          ],
          quizQuestions: [
            { question: 'What should the frontend do when it receives a 401 from an authenticated request?', options: ['Retry the same request immediately', 'Clear the stored token and redirect the user to login', 'Ignore it and keep the stale UI', 'Show a generic network-error message'], correctIndex: 1, explanation: 'A 401 means the token is missing/invalid/expired — the correct client response is to clear it and send the user back to authenticate again.' },
            { question: 'Is a client-side ProtectedRoute check real security on its own?', options: ['Yes, that is sufficient', 'No — it is a UX gate only; the server must independently verify the token on every protected endpoint', 'Only if using React Router', 'Security is not relevant on the frontend'], correctIndex: 1, explanation: 'A client-side check can always be bypassed by calling the API directly — actual authorization must be enforced server-side, every time, regardless of what the UI does.' },
            { question: 'What is the main security tradeoff of storing a JWT in localStorage vs. an httpOnly cookie?', options: ['No difference', 'localStorage is readable by any JS on the page (XSS risk); httpOnly cookies are not, but need CSRF protection instead', 'localStorage is always safer', 'Cookies cannot store tokens'], correctIndex: 1, explanation: 'It is a genuine tradeoff between two different attack surfaces (XSS vs CSRF), not a strictly-better option in either direction.' },
          ],
          miniProject: {
            title: 'Login flow with a protected page',
            description: 'A login form storing a mock token on success, and a /dashboard route that redirects to /login if no token is present.',
            requirements: ['Token stored on successful login, cleared on logout', 'Protected route actually redirects when no token exists'],
          },
          interviewBank: [
            {
              pattern: 'Authorization.*Bearer',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Where is your JWT stored, and what is the security tradeoff of that choice compared to the alternative?',
              expectedAnswer: 'If localStorage: acknowledges it is readable by any script on the page (XSS exposure) versus an httpOnly cookie, which is inaccessible to JS but requires CSRF protection — a real answer names the specific tradeoff, not just the choice made.',
              evaluationRubric: ['Names the actual storage mechanism used', 'Articulates the XSS vs CSRF tradeoff specifically', 'Does not claim their choice has zero downsides'],
            },
            {
              pattern: 'status === 401',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'A protected API call comes back with a 401 partway through the user\'s session. Walk me through exactly what your code does next.',
              expectedAnswer: 'The response handler checks for status 401, clears the stored token from localStorage, and redirects to the login page — leaving a stale/invalid token in storage and continuing to show protected content would let the UI drift out of sync with what the server will actually allow.',
              evaluationRubric: ['Names clearing the token specifically, not just "log the user out"', 'Includes the redirect to login', 'Confirms this happens for any protected call, not only the initial login'],
            },
            {
              pattern: 'ProtectedRoute',
              difficulty: 'hard',
              experienceLevel: 'mid',
              question: 'If I opened dev tools and manually deleted your ProtectedRoute check from the running app, could I now see the dashboard without logging in?',
              expectedAnswer: 'You could see whatever the frontend renders, yes — but any real data on that dashboard comes from API calls that still require a valid token server-side, so you would see an empty or error-riddled page, not actual protected data; this is exactly why the client-side gate is a UX convenience, not the actual security boundary.',
              evaluationRubric: ['Correctly says the route guard alone does not protect real data', 'Names the server-side check as the actual security boundary', 'Does not claim removing the client check would expose real backend data'],
            },
          ],
          xpReward: 160,
          coinsReward: 80,
          skillMapping: { React: 15, Authentication: 30, 'API Integration': 15 },
          difficulty: 'professional',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a login form that stores a mock token on success, and a /dashboard route that redirects to /login whenever no token is present.',
            requirements: ['route:/dashboard', 'auth:token'],
            resources: [{ title: 'jwt.io Introduction', url: 'https://jwt.io/introduction', type: 'doc' }],
            hints: [
              'The redirect check has to run every time the protected route renders, not just once on the first load.',
              'Clearing the token on logout should immediately make the protected route redirect again, not just hide a UI element.',
            ],
            evaluationCriteria: [
              'A token is stored on successful login and cleared on logout',
              'The protected route actually redirects to /login when no token exists',
            ],
            expectedSkills: ['React', 'Authentication', 'API Integration'],
            difficulty: 'professional',
            multiplier: 0.9,
            xp: 160,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 2,
          title: 'Production Concerns: Env Vars & Error Boundaries',
          slug: 'react-production-concerns',
          description: 'What separates a tutorial project from something that would survive shipping.',
          learningObjectives: [
            'Use environment variables for config instead of hardcoding URLs/keys',
            'Add an Error Boundary so one broken component does not crash the whole app',
            'Recognize the difference between a demo-quality and production-quality submission',
          ],
          videos: [],
          officialDocs: [
            { title: 'Environment Variables – Vite', url: 'https://vite.dev/guide/env-and-mode', type: 'doc' },
            { title: 'Catching Rendering Errors with an Error Boundary', url: 'https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary', type: 'doc' },
          ],
          notes: `Hardcoding an API base URL (or worse, an API key) directly into a component is a real, common mistake this track's Requirement Validator specifically checks for — "env:VITE_API_URL" as a requirement means it must come from import.meta.env.VITE_API_URL, not be typed literally into the fetch call, because a hardcoded URL can't change between local/staging/production without editing code.

An Error Boundary is a component that catches JavaScript errors thrown anywhere in its child tree during rendering and shows a fallback UI instead of the entire app going blank. React does not (as of function components) let you write one with a hook — it still requires a class component with static getDerivedStateFromError or componentDidCatch, wrapped once near the app root.

This node marks the shift from "does it work" to "would this survive being shipped" — the same shift the AI Review stage's productionReadiness/scalabilityNotes fields are specifically evaluating on a capstone submission.`,
          cheatsheet: `import.meta.env.VITE_API_URL     — env var access in a Vite app, never hardcode the URL
.env file: VITE_API_URL=https://api.example.com
Error Boundary: class component with static getDerivedStateFromError(error)
Wrap the app root once: <ErrorBoundary><App /></ErrorBoundary>`,
          codeExamples: [
            {
              title: 'Env var instead of a hardcoded URL',
              language: 'jsx',
              code: `const API_URL = import.meta.env.VITE_API_URL;
fetch(\`\${API_URL}/users\`);`,
            },
            {
              title: 'A minimal Error Boundary',
              language: 'jsx',
              code: `class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <p>Something went wrong.</p>;
    return this.props.children;
  }
}`,
            },
          ],
          quizQuestions: [
            { question: 'Why is hardcoding an API URL directly in a component a real problem, not just a style issue?', options: ['It is not actually a problem', 'It cannot be changed between local/staging/production environments without editing and redeploying code', 'It makes the bundle larger', 'React forbids hardcoded strings'], correctIndex: 1, explanation: 'Config baked into code means every environment needs a code change to point somewhere else — env vars decouple config from code.' },
            { question: 'What does an Error Boundary catch?', options: ['Network request failures', 'JavaScript errors thrown during rendering in its child component tree', 'Console warnings', 'Syntax errors at build time'], correctIndex: 1, explanation: 'Error Boundaries specifically catch render-time errors in their children — they do not catch errors in event handlers or async code, which need their own try/catch.' },
            { question: 'Can you write an Error Boundary as a function component with hooks?', options: ['Yes, with useErrorBoundary', 'No — as of React today it still requires a class component', 'Yes, with useEffect', 'Error boundaries do not exist'], correctIndex: 1, explanation: 'This is one of the few remaining cases where React still requires a class component — there is no hook equivalent for catching render errors.' },
          ],
          miniProject: {
            title: 'Wrap an app in error handling',
            description: 'Take any earlier project, move its API URL into an env var, and wrap the app root in an Error Boundary with a real fallback UI.',
            requirements: ['No hardcoded API URL remains in component code', 'A deliberately-broken child component is caught by the boundary, not left as a blank page'],
          },
          interviewBank: [
            {
              pattern: 'getDerivedStateFromError',
              difficulty: 'hard',
              experienceLevel: 'mid',
              question: 'Your Error Boundary is wrapping the whole app in one place. What is the downside of that, and how would you improve it for a real product?',
              expectedAnswer: 'A single top-level boundary means any error anywhere blanks the entire app; wrapping boundaries around independent sections (e.g. per-widget on a dashboard) contains failures to just that section, letting the rest of the UI keep working.',
              evaluationRubric: ['Identifies the blast-radius problem with one global boundary', 'Proposes finer-grained boundaries as the fix', 'Understands boundaries do not catch event-handler or async errors'],
            },
            {
              pattern: 'import\\.meta\\.env',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'Why is import.meta.env.VITE_API_URL better than just writing the URL string directly in your fetch calls?',
              expectedAnswer: 'The env var lets the exact same built code point at a different backend in local dev, staging, and production just by changing a .env file, with no code edit or rebuild logic needed — a hardcoded URL means every environment switch requires touching and redeploying source code.',
              evaluationRubric: ['Names the multi-environment reason specifically', 'Does not just say "it is best practice" with no justification', 'Knows this requires a rebuild to actually take effect, not a runtime change'],
            },
            {
              pattern: 'componentDidCatch|onClick.*try',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Would your Error Boundary catch an error thrown inside an onClick handler, or inside a .then() callback from a fetch call?',
              expectedAnswer: 'No — Error Boundaries only catch errors thrown during rendering in their child component tree; errors in event handlers, async callbacks, timers, or server-rendered code are invisible to them and need their own try/catch (for handlers) or .catch() (for promises).',
              evaluationRubric: ['Correctly says no for both event handlers and async callbacks', 'States the scope is render-time errors only', 'Knows the actual mitigation for those other cases'],
            },
          ],
          xpReward: 160,
          coinsReward: 80,
          skillMapping: { React: 15, 'Production Readiness': 30, Configuration: 15 },
          difficulty: 'professional',
          trustLevel: 'B',
          challenge: {
            objective: 'Take any earlier project, move its API URL into an environment variable, and wrap the app root in an Error Boundary with a real fallback UI — a deliberately-broken child component should be caught, not left as a blank page.',
            requirements: ['env:VITE_API_URL', 'component:ErrorBoundary'],
            resources: [{ title: 'Environment Variables – Vite', url: 'https://vite.dev/guide/env-and-mode', type: 'doc' }],
            hints: [
              'Read the URL via import.meta.env.VITE_API_URL — no hardcoded URL should remain anywhere in the component code.',
              'The Error Boundary needs a real fallback UI, not just a caught-and-ignored error — the user should see something meaningful, not a blank screen.',
            ],
            evaluationCriteria: [
              'No hardcoded API URL remains in component code',
              'A deliberately-broken child component is caught by the boundary with a real fallback UI',
            ],
            expectedSkills: ['React', 'Production Readiness', 'Configuration'],
            difficulty: 'professional',
            multiplier: 0.9,
            xp: 160,
            challengeType: 'practice',
          },
        },
        {
          nodeNumber: 3,
          title: 'Capstone: Authenticated Dashboard',
          slug: 'capstone-authenticated-dashboard',
          description: 'Track capstone — a full authenticated dashboard app combining everything from Levels 1-5. Recruiter-ready.',
          learningObjectives: ['Combine auth, API integration, component architecture, and production practices into one real, recruiter-facing project'],
          videos: [],
          officialDocs: [],
          notes: 'This node has no new teaching content — it is the Frontend Developer track Capstone (Part 4a), the heaviest-weighted challenge in the track and the headline project for the future Career Passport.',
          cheatsheet: '',
          codeExamples: [],
          quizQuestions: [],
          miniProject: { title: '', description: '', requirements: [] },
          interviewBank: [
            {
              pattern: 'ProtectedRoute',
              difficulty: 'hard',
              experienceLevel: 'mid',
              question: 'Walk me through everything that happens, in order, from a user typing their password to landing on your protected dashboard.',
              expectedAnswer: 'Form submit is intercepted (preventDefault), credentials POSTed to the login endpoint, a JWT returned on success and stored, the app redirects to /dashboard, the ProtectedRoute checks for the token and renders the dashboard, and the dashboard\'s own data fetches attach the token as an Authorization header on every request, with a 401 anywhere in that chain clearing the token and bouncing back to /login.',
              evaluationRubric: ['Traces the full flow accurately, not just fragments', 'Mentions both the login-time and every-subsequent-request use of the token', 'Correctly describes the 401 failure path'],
            },
            {
              pattern: 'productionReadiness|businessReadiness',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'This dashboard "works" end to end. What specifically separates that from being production-ready, and did you address any of it here?',
              expectedAnswer: 'Working means the happy path succeeds; production-ready additionally means config is externalized (env vars, not hardcoded), failures are contained and communicated (Error Boundaries, real error states) rather than crashing, expired/invalid sessions are handled gracefully, and the code would survive a teammate reading it — this challenge specifically bundles env config, error boundaries, and 401 handling together because "it runs on my machine" and "it survives being shipped" are genuinely different bars.',
              evaluationRubric: ['Names at least 2-3 concrete production-readiness dimensions, not just "more testing"', 'Connects the answer to what they actually built in this challenge', 'Does not conflate "it works" with "it is production-ready"'],
            },
            {
              pattern: 'localStorage|httpOnly',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'If this dashboard were handling real financial or health data instead of a demo, what would you change about how you built auth here?',
              expectedAnswer: 'A strong answer moves beyond localStorage to httpOnly, secure, sameSite cookies to eliminate XSS-based token theft (accepting the CSRF-protection tradeoff instead), adds short token expiry with refresh tokens rather than one long-lived JWT, and points out that client-side route guards remain UX only — every sensitive read/write still needs server-side authorization checked on every request, not assumed from a valid-looking token alone.',
              evaluationRubric: ['Proposes httpOnly cookies or an equivalent XSS mitigation, not just "add more validation"', 'Mentions token expiry/refresh as a real gap in a long-lived JWT approach', 'Reiterates that server-side authorization is still required regardless of client storage choice'],
            },
          ],
          xpReward: 400,
          coinsReward: 200,
          skillMapping: { React: 20, Hooks: 15, Authentication: 20, 'API Integration': 20, 'Production Readiness': 15, 'Error Handling': 10 },
          difficulty: 'professional',
          trustLevel: 'B',
          challenge: {
            objective: 'Build an authenticated dashboard app: login page, protected dashboard route, real API data fetching with loading/error states, env-var config, and an Error Boundary.',
            requirements: [
              'component:LoginForm', 'component:Dashboard', 'component:ProtectedRoute',
              'auth:Authorization', 'env:VITE_API_URL', 'error-handling:',
            ],
            resources: [
              { title: 'jwt.io Introduction', url: 'https://jwt.io/introduction', type: 'doc' },
              { title: 'Catching Rendering Errors with an Error Boundary', url: 'https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary', type: 'doc' },
            ],
            hints: [
              'This is the track capstone — the Verification Engine\'s AI Review stage specifically evaluates business/production readiness on this challenge, not just whether it runs',
              'Test what happens with an expired/invalid token, not only the happy login path',
            ],
            evaluationCriteria: [
              'Unauthenticated users cannot reach the dashboard route',
              'API base URL comes from an environment variable, not a hardcoded string',
              'A broken child component is caught by an Error Boundary, not a blank white screen',
              'A 401 response clears the stored token and redirects to login',
            ],
            expectedSkills: ['React', 'Hooks', 'Authentication', 'API Integration', 'Production Readiness'],
            difficulty: 'professional',
            multiplier: 2.2,
            xp: 400,
            challengeType: 'capstone',
          },
        },
      ],
    },

    // ═══════════════════ MILESTONE 1 (Levels 6–10): Professional React Engineering ═══════════════════

    // ───────────────────────── Level 6 ─────────────────────────
    {
      levelNumber: 6,
      name: 'TypeScript for React',
      description: 'Typing components, state, and events — and why `any` quietly defeats the entire point.',
      difficulty: 'expert',
      estimatedDurationHours: 18,
      xpRequired: 2500,
      nodes: [
        {
          nodeNumber: 1,
          title: 'TypeScript for React Components',
          slug: 'typescript-for-react',
          description: 'Typed props, typed state, and typed event handlers — converting a real JS app to strict TypeScript.',
          learningObjectives: [
            'Type component props with an interface, including optional props and children',
            'Type useState with an explicit generic where inference is not enough',
            'Type DOM event handlers correctly instead of reaching for `any`',
          ],
          videos: [{ title: 'React with TypeScript - Complete Tutorial', url: 'https://www.youtube.com/watch?v=TPACABQTHvE', type: 'video' }],
          officialDocs: [
            { title: 'TypeScript: Documentation - React', url: 'https://www.typescriptlang.org/docs/handbook/react.html', type: 'doc' },
            { title: 'TypeScript – React.dev', url: 'https://react.dev/learn/typescript', type: 'doc' },
          ],
          notes: `A props interface is the contract for a component: interface ProductCardProps { name: string; price: number; onSelect?: () => void; children?: React.ReactNode }. Optional props get a ?; a prop with no default and no ? is required, and TypeScript will error at every call site that omits it — this is the entire value proposition: mistakes get caught at compile time, in your editor, instead of at runtime in front of a user.

useState usually infers correctly from its initial value (useState(0) is number, useState('') is string), but when the initial value doesn't tell the full story — an object that starts as null but will later hold real data — you supply the generic explicitly: useState<User | null>(null). Without it, TypeScript infers the type as just null forever, and every later setUser(realUser) call becomes an error.

Event handlers need the correct React event type, not \`any\`: a change handler on an <input> is React.ChangeEvent<HTMLInputElement>, a form submit is React.FormEvent<HTMLFormElement>, a click is React.MouseEvent<HTMLButtonElement>. Reaching for \`any\` on an event handler silences the compiler entirely on exactly the code that's easiest to get wrong (e.target.value doesn't exist on a generic Event) — it's a common junior-TS shortcut that erases the actual point of using TypeScript.

Migrating a real JS file to TS is incremental, not a rewrite: rename .jsx to .tsx, fix compiler errors one at a time (usually starting with props and state), and resist reaching for \`any\` as the fix for each one — an honest, narrower type (or genuinely \`unknown\` if the shape isn't known yet) keeps the safety TypeScript is there to provide.`,
          cheatsheet: `interface Props { name: string; price: number; onSelect?: () => void; children?: React.ReactNode }
function ProductCard({ name, price, onSelect, children }: Props) { ... }

const [user, setUser] = useState<User | null>(null);   — explicit generic when inference isn't enough
const [items, setItems] = useState<Item[]>([]);        — typed empty array

function handleChange(e: React.ChangeEvent<HTMLInputElement>) { setText(e.target.value); }
function handleSubmit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); }
function handleClick(e: React.MouseEvent<HTMLButtonElement>) { ... }

Avoid \`any\` — prefer a real interface, or \`unknown\` with a type-check, over silencing the compiler`,
          codeExamples: [
            {
              title: 'A fully typed component',
              language: 'tsx',
              code: `interface ProductCardProps {
  name: string;
  price: number;
  onSelect?: () => void;
}

function ProductCard({ name, price, onSelect }: ProductCardProps) {
  return (
    <div onClick={onSelect}>
      <h3>{name}</h3>
      <p>\${price.toFixed(2)}</p>
    </div>
  );
}`,
            },
            {
              title: 'Typed state and a typed change handler',
              language: 'tsx',
              code: `interface User {
  id: number;
  name: string;
}

function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
  }

  return <input value={query} onChange={handleChange} />;
}`,
            },
          ],
          quizQuestions: [
            { question: 'Why does useState<User | null>(null) need an explicit generic instead of just useState(null)?', options: ['It does not, they are identical', 'Without it, TypeScript infers the state\'s type as just null forever, so a later setUser(realUser) becomes a type error', 'Generics are required syntax for all useState calls', 'null cannot be used as an initial state value'], correctIndex: 1, explanation: 'TypeScript infers the narrowest possible type from the initial value — plain null infers as null, not User | null, unless you tell it the fuller type explicitly.' },
            { question: 'What is the correct type for a change handler on a text <input>?', options: ['any', 'Event', 'React.ChangeEvent<HTMLInputElement>', 'string'], correctIndex: 2, explanation: 'React.ChangeEvent<HTMLInputElement> gives you a correctly-typed e.target.value — a plain Event does not know about target.value at all.' },
            { question: 'What does adding a ? to a prop in a TypeScript interface actually mean?', options: ['The prop is deprecated', 'The prop is optional — callers may omit it, and it may be undefined inside the component', 'The prop must be a boolean', 'It has no effect'], correctIndex: 1, explanation: 'A ? marks a prop optional — omitting it is valid at every call site, and the component must handle it possibly being undefined.' },
          ],
          miniProject: {
            title: 'Type a small form component',
            description: 'Take a plain JS form component (name + email inputs, submit handler) and add full TypeScript types: a props interface, typed state, and typed event handlers throughout.',
            requirements: ['A real interface defines the component\'s props, not inline object types', 'No `any` appears anywhere in the file', 'Event handlers use the correct React.*Event<...> types'],
          },
          interviewBank: [
            {
              pattern: 'interface \\w+Props',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Why define a named Props interface instead of typing props inline in the function signature?',
              expectedAnswer: 'A named interface is reusable (for tests, for documentation, for extending), reads better at the top of the file as the component\'s contract, and is easier to reference from other files than an inline anonymous type repeated at every usage.',
              evaluationRubric: ['Names reusability or readability as the concrete reason', 'Does not claim inline typing is impossible, just worse', 'Can describe a case where the interface gets reused elsewhere'],
            },
            {
              pattern: 'React\\.ChangeEvent',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'What would go wrong, specifically, if you typed a change handler\'s event parameter as `any` instead of React.ChangeEvent<HTMLInputElement>?',
              expectedAnswer: 'You would lose autocomplete and compile-time checking on e.target.value entirely — a typo like e.traget.value or reading e.target.checked on a text input (which does not exist there) would silently type-check and only fail at runtime, exactly the class of bug TypeScript is meant to catch.',
              evaluationRubric: ['Gives a concrete example of a bug `any` would hide', 'Correctly names what the proper type actually provides', 'Does not just say "any is bad practice" with no mechanism'],
            },
            {
              pattern: 'children\\?:\\s*React\\.ReactNode',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Your Props interface has children?: React.ReactNode. Why optional, and why ReactNode specifically rather than, say, string?',
              expectedAnswer: 'Optional because not every usage of the component necessarily nests content inside it; ReactNode (not string) because JSX children can be elements, arrays, fragments, numbers, or null — typing it as string would incorrectly reject perfectly valid JSX passed as children.',
              evaluationRubric: ['Explains why children is often optional', 'Correctly contrasts ReactNode\'s breadth against a narrower type like string', 'Would not accept a wrong type here even if it "worked" for a single test case'],
            },
          ],
          xpReward: 280,
          coinsReward: 140,
          skillMapping: { TypeScript: 30, React: 15 },
          careerDnaImpact: { 'Technical Mastery': 20 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Convert an existing JavaScript product catalog (list + card components, a search filter, and add-to-cart state) to strict TypeScript — no `any`, no implicit any, full prop and state typing.',
            requirements: [
              'file:tsconfig.json', 'component:ProductList', 'component:ProductCard', 'state:useState',
            ],
            resources: [{ title: 'TypeScript: Documentation - React', url: 'https://www.typescriptlang.org/docs/handbook/react.html', type: 'doc' }],
            hints: [
              'Enable "strict": true in tsconfig.json before starting, not after — it changes what counts as an error',
              'Migrate one component at a time, fixing its errors before moving to the next, rather than renaming every file first',
            ],
            evaluationCriteria: [
              'No `any` type appears anywhere in the codebase',
              'Every component has a named Props interface, including optional props marked correctly',
              'Event handlers use the correct React.*Event generic type, not a loosely-typed parameter',
            ],
            expectedSkills: ['TypeScript', 'React'],
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
      name: 'Testing React Applications',
      description: 'Jest and React Testing Library — proving a component works, not just eyeballing it.',
      difficulty: 'expert',
      estimatedDurationHours: 18,
      xpRequired: 3000,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Component and Hook Testing',
          slug: 'react-testing-library',
          description: 'Testing what a component does from a user\'s perspective, not how it is implemented internally.',
          learningObjectives: [
            'Write a component test that renders, interacts, and asserts using React Testing Library',
            'Mock an API call inside a test so it runs deterministically without a real network',
            'Understand why Testing Library deliberately avoids testing internal implementation details',
          ],
          videos: [{ title: 'React Testing Library Course for Beginners', url: 'https://www.youtube.com/watch?v=7dTTFW7yACQ', type: 'video' }],
          officialDocs: [
            { title: 'React Testing Library', url: 'https://testing-library.com/docs/react-testing-library/intro/', type: 'doc' },
            { title: 'Jest Documentation', url: 'https://jestjs.io/docs/getting-started', type: 'doc' },
          ],
          notes: `React Testing Library's core philosophy is right in its guiding principle: "the more your tests resemble the way your software is used, the more confidence they can give you." That means queries like getByRole, getByText, and getByLabelText — finding elements the way a real user (or screen reader) would — rather than reaching into a component's internal state or calling its methods directly.

A typical test: render(<Counter />) mounts the component into a virtual DOM; screen.getByRole('button', { name: /increment/i }) finds the button the same way a user would look for it; fireEvent.click(button) or the more realistic userEvent.click(button) simulates the interaction; expect(screen.getByText('1')).toBeInTheDocument() asserts on the visible result. Nowhere does the test know or care that the count is stored in a useState call — that is exactly the point: implementation can change (useState today, a reducer tomorrow) without breaking the test, as long as the user-visible behavior stays the same.

Mocking an API call for a test — jest.mock('../api') or intercepting fetch — makes the test deterministic and fast, not dependent on a real network or a real backend being up; you control exactly what the "API" returns for each test case, including error responses, which is often easier to trigger deliberately in a test than to reproduce by hand against a real server.`,
          cheatsheet: `render(<Component />)                          — mount into a virtual DOM
screen.getByRole('button', { name: /save/i })  — find the way a user would
screen.getByText('Loading...')                 — find by visible text
userEvent.click(button)                        — realistic simulated interaction
expect(screen.getByText('Saved')).toBeInTheDocument()

jest.mock('../api')                            — replace a module with a mock for this test file
(api.getUser as jest.Mock).mockResolvedValue({ name: 'Asha' })`,
          codeExamples: [
            {
              title: 'Testing a counter\'s user-visible behavior',
              language: 'tsx',
              code: `import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

test('increments the displayed count on click', async () => {
  render(<Counter />);
  const button = screen.getByRole('button', { name: /increment/i });

  await userEvent.click(button);

  expect(screen.getByText('1')).toBeInTheDocument();
});`,
            },
            {
              title: 'Mocking an API call for a data-fetching component',
              language: 'tsx',
              code: `jest.mock('../api');
import { getUser } from '../api';

test('renders the fetched user name', async () => {
  (getUser as jest.Mock).mockResolvedValue({ name: 'Asha' });
  render(<UserProfile userId={1} />);

  expect(await screen.findByText('Asha')).toBeInTheDocument();
});`,
            },
          ],
          quizQuestions: [
            { question: 'Why does React Testing Library encourage getByRole/getByText over reaching into component state directly?', options: ['It is not possible to access state in tests', 'Tests that check user-visible behavior survive internal refactors; tests coupled to implementation details break every time internals change even if behavior is unchanged', 'getByRole is faster to execute', 'There is no real reason, it is just a convention'], correctIndex: 1, explanation: 'The guiding principle is testing what a user experiences, not how the component is built internally — that resilience to refactors is the entire value.' },
            { question: 'What does await screen.findByText(...) do differently from screen.getByText(...)?', options: ['No difference', 'findByText waits/retries for the element to appear (useful after an async action), getByText fails immediately if not already present', 'findByText is deprecated', 'getByText is async'], correctIndex: 1, explanation: 'findBy* queries are async and poll until the element appears or a timeout is hit — exactly what you need after triggering something that fetches data.' },
            { question: 'Why mock the API call in a component test instead of letting it hit a real backend?', options: ['Real backends cannot be tested', 'Mocking makes the test fast, deterministic, and able to test error cases on demand, independent of a real server being available', 'It is required by Jest', 'There is no benefit'], correctIndex: 1, explanation: 'A mocked API call removes network flakiness and lets you trigger specific responses (including failures) on command, which is often impractical against a real server.' },
          ],
          miniProject: {
            title: 'Test a search-filter component',
            description: 'Write React Testing Library tests for a component that filters a list as the user types: covers typing a matching query, typing a query with no matches, and clearing the input.',
            requirements: ['Uses userEvent to simulate typing, not direct state manipulation', 'Covers the no-matches case explicitly, not just the happy path'],
          },
          interviewBank: [
            {
              pattern: 'getByRole|getByText',
              difficulty: 'easy',
              experienceLevel: 'junior',
              question: 'Why query for the button by its accessible role and name instead of, say, a CSS class or test id?',
              expectedAnswer: 'Querying by role/name is how the DOM (and a screen reader) actually identifies the element to a user, so the test stays valid if class names or internal markup change; a CSS-class query breaks the moment a stylesheet refactor happens even though nothing about user-facing behavior changed.',
              evaluationRubric: ['Names resilience to markup/style changes specifically', 'Connects role-based queries to accessibility, not just testing convenience', 'Would use a test id only as a last resort, not a first choice'],
            },
            {
              pattern: 'jest\\.mock',
              difficulty: 'medium',
              experienceLevel: 'junior',
              question: 'How would you write a test proving your component shows an error message when the API call fails?',
              expectedAnswer: 'Mock the API function to reject (mockRejectedValue) or resolve with an error-shaped response for that specific test, render the component, and assert the error UI text appears via a findBy query — deliberately exercising the failure path rather than only ever testing the success case.',
              evaluationRubric: ['Proposes mocking a rejection specifically for this test', 'Confirms it asserts on visible error UI, not just that no crash occurred', 'Recognizes this as a distinct, necessary test from the happy path'],
            },
            {
              pattern: 'userEvent',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What is the actual difference between fireEvent.click and userEvent.click, and does it matter which one you use?',
              expectedAnswer: 'fireEvent dispatches a single, low-level DOM event; userEvent simulates the fuller sequence of real browser events a genuine click produces (focus, mousedown, mouseup, click), which matters for components relying on those intermediate events (like some focus-triggered validation) — userEvent is the more realistic, generally preferred choice for that reason.',
              evaluationRubric: ['Correctly distinguishes single-event vs full-interaction simulation', 'Gives a concrete case where the difference would actually matter', 'Does not claim they are always interchangeable'],
            },
          ],
          xpReward: 300,
          coinsReward: 150,
          skillMapping: { Testing: 30, React: 15 },
          careerDnaImpact: { 'Technical Mastery': 15, 'Problem Solving': 10 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Retrofit a complete test suite onto an existing Todo app: cover add/complete/delete behavior, the empty-state, and a mocked API failure case.',
            requirements: [
              'file:src/App.test.tsx', 'component:TodoList', 'state:useState',
            ],
            resources: [{ title: 'React Testing Library', url: 'https://testing-library.com/docs/react-testing-library/intro/', type: 'doc' }],
            hints: [
              'Test user-visible behavior (what appears on screen after an interaction), not internal state values directly',
              'Include at least one test for a failure/empty case, not only the happy path',
            ],
            evaluationCriteria: [
              'Tests use userEvent and query by role/text, not implementation details',
              'Add, complete, and delete are each covered by a real assertion, not just "renders without crashing"',
              'At least one failure or empty-state case is explicitly tested',
            ],
            expectedSkills: ['Testing', 'React'],
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
      name: 'Global State at Scale',
      description: 'When Context stops being enough, and how to reach for a real state library without over-engineering.',
      difficulty: 'expert',
      estimatedDurationHours: 18,
      xpRequired: 3600,
      nodes: [
        {
          nodeNumber: 1,
          title: 'State Management Beyond Context',
          slug: 'global-state-zustand',
          description: 'Recognizing when local state and Context genuinely stop scaling, and modeling shared state with a dedicated store.',
          learningObjectives: [
            'Identify the specific symptoms that mean Context has outgrown its use case',
            'Model shared application state in a small, typed Zustand store',
            'Read and update store state from components without prop-drilling',
          ],
          videos: [{ title: 'Zustand Tutorial - React State Management', url: 'https://www.youtube.com/watch?v=_ngCLZ5Iz-0', type: 'video' }],
          officialDocs: [{ title: 'Zustand — GitHub', url: 'https://github.com/pmndrs/zustand', type: 'doc' }],
          notes: `Context is not a performance-free global store — every consumer of a Context re-renders whenever the provided value changes, even if that consumer only cares about a small slice of it. A single AppContext holding user, theme, cart, and notifications means updating notifications re-renders every component reading anything from that context, including ones that only care about theme. That's the specific, concrete symptom that means it's time to reach for a dedicated state library instead of one giant Context.

Zustand models state as a single hook created once: const useCartStore = create((set) => ({ items: [], addItem: (item) => set((state) => ({ items: [...state.items, item] })) })). Any component calls useCartStore(state => state.items) to read just the slice it needs — and, critically, only re-renders when that specific slice changes, not on every store update, which is exactly the granularity Context can't offer without significant extra work (splitting into multiple contexts, memoizing values).

The real skill here isn't "use a library" — it's judgment: local useState is still correct for state only one component cares about; Context is still fine for rarely-changing values (theme, current user); a dedicated store earns its complexity specifically for state that's both shared across distant components AND changes frequently. Reaching for global state by default, for everything, is its own kind of over-engineering.`,
          cheatsheet: `import { create } from 'zustand';

const useCartStore = create((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
}));

// In any component, no provider needed:
const items = useCartStore(state => state.items);          — subscribe to just this slice
const addItem = useCartStore(state => state.addItem);       — grab an action

When to reach for it: shared across distant components AND changes often
When NOT to: state only one component needs (useState), rarely-changing values (Context is fine)`,
          codeExamples: [
            {
              title: 'A typed Zustand cart store',
              language: 'tsx',
              code: `import { create } from 'zustand';

interface CartItem { id: number; name: string; price: number; }
interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: number) => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter((i) => i.id !== id),
  })),
}));`,
            },
            {
              title: 'Reading only the slice a component needs',
              language: 'tsx',
              code: `function CartBadge() {
  // Only re-renders when items.length actually changes, not on every store update
  const itemCount = useCartStore((state) => state.items.length);
  return <span>{itemCount}</span>;
}`,
            },
          ],
          quizQuestions: [
            { question: 'What specifically makes a single large AppContext holding many unrelated values a performance problem?', options: ['Context is always slow', 'Every consumer re-renders when ANY part of the provided value changes, even if it only reads an unrelated slice', 'Context cannot hold objects', 'It is not actually a problem'], correctIndex: 1, explanation: 'Context provides no built-in slicing — any change to the value object re-renders every consumer, regardless of which part of it they actually read.' },
            { question: 'In useCartStore((state) => state.items.length), why select just .length instead of the whole store?', options: ['It is required syntax', 'The component only re-renders when that specific selected value changes, not on every unrelated store update', 'It is faster to type', 'There is no difference'], correctIndex: 1, explanation: 'Selecting a narrow slice is what gives you the fine-grained re-render control that a single Context value cannot provide as easily.' },
            { question: 'When is plain useState still the right choice over a global store?', options: ['Never, global state is always better', 'When the state is only relevant to one component (or its direct children via props), not shared across distant parts of the tree', 'Only for boolean values', 'useState should be avoided entirely once a project uses Zustand'], correctIndex: 1, explanation: 'Reaching for global state for everything is over-engineering — local state remains the right, simpler tool when nothing distant actually needs it.' },
          ],
          miniProject: {
            title: 'Convert prop-drilled state to a store',
            description: 'Given a small app passing a "favorites" list and toggle function down through 3 levels of props, refactor it to a Zustand store that any component can read/update directly.',
            requirements: ['No favorites-related props are drilled through intermediate components after the refactor', 'Components select only the slice of state they actually need'],
          },
          interviewBank: [
            {
              pattern: 'create\\(\\(set\\)',
              difficulty: 'easy',
              experienceLevel: 'mid',
              question: 'Why did this app need a dedicated store instead of just lifting the favorites state to a top-level Context?',
              expectedAnswer: 'A justified answer names the actual symptom — either the state changes frequently enough that Context re-renders would be a real performance cost, or the components needing it are distant enough that prop-drilling or context-splitting would be awkward — not just "libraries are better than Context" as a blanket claim.',
              evaluationRubric: ['Gives a specific, real justification tied to this app, not a generic preference', 'Would defend Context as sufficient in a simpler case', 'Understands both are valid tools for different situations'],
            },
            {
              pattern: 'useCartStore\\(\\(state\\)',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'What would happen, performance-wise, if every component just called useCartStore() with no selector, instead of selecting a specific slice?',
              expectedAnswer: 'Every component using the store would re-render on any change to any part of the store\'s state, not just the parts it actually reads — effectively recreating the same over-broad re-render problem a single giant Context has, defeating the fine-grained subscription that is the actual reason to prefer Zustand here.',
              evaluationRubric: ['Correctly identifies this would cause unnecessary re-renders', 'Connects it back to the Context comparison from the node\'s content', 'Recommends selecting a specific slice as the fix'],
            },
            {
              pattern: 'set\\(\\(state\\)',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Your addItem action does set((state) => ({ items: [...state.items, item] })). Why read the previous state via a function instead of writing set({ items: [...items, item] }) directly?',
              expectedAnswer: 'The functional form guarantees you are updating from the actual current store state at the moment the update applies, which matters if multiple updates could be queued or called in quick succession — reading a captured `items` variable from an outer closure risks acting on stale state if it was captured before an earlier update applied.',
              evaluationRubric: ['Names the stale-closure risk specifically', 'Prefers the functional update form and can justify why', 'Draws the parallel to the same pattern in React\'s own setState if prompted'],
            },
          ],
          xpReward: 320,
          coinsReward: 160,
          skillMapping: { 'State Management': 30, React: 15 },
          careerDnaImpact: { 'Technical Mastery': 15, 'Problem Solving': 15 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a multi-feature shopping cart (add, remove, quantity update, running total) with shared state accessible from a product list, a cart badge in the nav, and a full cart page — no prop drilling.',
            requirements: [
              'component:CartBadge', 'component:CartPage', 'state:useState',
            ],
            resources: [{ title: 'Zustand — GitHub', url: 'https://github.com/pmndrs/zustand', type: 'doc' }],
            hints: [
              'Design the store\'s shape and actions before wiring up any components',
              'Each component should select only the slice of store state it actually needs',
            ],
            evaluationCriteria: [
              'Cart state is accessible from distant components with no prop drilling',
              'Adding, removing, and updating quantity all correctly update the running total',
              'Components subscribe to specific store slices, not the entire store unselectively',
            ],
            expectedSkills: ['State Management', 'React'],
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
      name: 'Performance & Rendering Optimization',
      description: 'Diagnosing real re-render problems with the Profiler, then fixing the actual cause — not guessing with memo everywhere.',
      difficulty: 'expert',
      estimatedDurationHours: 20,
      xpRequired: 4300,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Diagnosing and Fixing Re-renders',
          slug: 'react-performance-optimization',
          description: 'Using the DevTools Profiler to find a real performance problem, then applying the specific right fix.',
          learningObjectives: [
            'Use the React DevTools Profiler to identify which components are re-rendering and why',
            'Apply React.memo, useMemo, and useCallback correctly — and recognize when they do not help',
            'Split a large bundle with React.lazy and Suspense for a route that is not needed on first load',
          ],
          videos: [{ title: 'React Performance Optimization Full Course', url: 'https://www.youtube.com/watch?v=uojLJFt9SbY', type: 'video' }],
          officialDocs: [
            { title: 'React Profiler', url: 'https://react.dev/reference/react/Profiler', type: 'doc' },
            { title: 'memo – React.dev', url: 'https://react.dev/reference/react/memo', type: 'doc' },
          ],
          notes: `The Profiler tab in React DevTools records a render and shows exactly which components rendered, how long each took, and — critically — why (a highlighted "why did this render" reason: props changed, state changed, or a parent re-rendered). Guessing which component is slow and sprinkling memo on it blind is how you end up with more complexity and no actual improvement; the Profiler tells you where the real cost is before you touch anything.

React.memo prevents a component from re-rendering when its props haven't changed — but it does a shallow comparison, so passing a new inline object or arrow function as a prop on every parent render (onClick={() => doThing()}) defeats memo immediately, since that new function reference counts as "props changed" every time. useCallback memoizes a function reference across renders so it stays stable; useMemo memoizes a computed value. All three add their own overhead (memory for the cached value, a comparison cost) — using them on cheap components or values that were never actually the bottleneck can make things marginally worse, not better, which is exactly why profiling first matters.

Code-splitting with React.lazy(() => import('./AdminPanel')) wrapped in <Suspense fallback={<Spinner />}> defers loading a route's JavaScript until it's actually navigated to — a heavy admin section most users never visit doesn't need to be in the initial bundle everyone downloads on first load. This is a different kind of performance work from memoization: it's about what loads, not how often something re-renders.`,
          cheatsheet: `React DevTools → Profiler tab → record → interact → stop → inspect "why did this render"

const MemoizedCard = React.memo(ProductCard);          — skip re-render if props are shallow-equal
const total = useMemo(() => expensiveCalc(items), [items]);   — memoize a computed value
const handleClick = useCallback(() => doThing(id), [id]);     — memoize a function reference

const AdminPanel = React.lazy(() => import('./AdminPanel'));
<Suspense fallback={<Spinner />}><AdminPanel /></Suspense>

Passing a new inline function/object as a prop on every render defeats React.memo`,
          codeExamples: [
            {
              title: 'memo defeated by an inline handler, then fixed',
              language: 'tsx',
              code: `// Defeats memo — a new function reference every render
<ProductCard onSelect={() => handleSelect(product.id)} />

// Fixed — stable reference via useCallback
const handleSelect = useCallback((id: number) => { ... }, []);
<ProductCard onSelect={handleSelect} />

const ProductCard = React.memo(function ProductCard({ onSelect }: Props) {
  return <button onClick={onSelect}>Select</button>;
});`,
            },
            {
              title: 'Route-level code splitting',
              language: 'tsx',
              code: `import { lazy, Suspense } from 'react';

const AdminPanel = lazy(() => import('./AdminPanel'));

function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <Route path="/admin" element={<AdminPanel />} />
    </Suspense>
  );
}`,
            },
          ],
          quizQuestions: [
            { question: 'You wrapped ProductCard in React.memo, but it still re-renders every time its parent renders. What is the most likely cause?', options: ['React.memo does not work on function components', 'A prop being passed is a new object/array/function reference on every render (e.g. an inline arrow function), which fails memo\'s shallow comparison', 'The component has too many props', 'memo only works with class components'], correctIndex: 1, explanation: 'memo\'s shallow prop comparison sees a brand-new function/object reference as "changed" even if its contents are logically identical — inline handlers are the classic cause.' },
            { question: 'What should you do BEFORE reaching for useMemo/useCallback on a component you suspect is slow?', options: ['Add them everywhere just in case', 'Profile it with React DevTools to confirm it is actually a meaningful re-render cost, not guess', 'Rewrite it as a class component', 'Nothing, memoization is always safe to add'], correctIndex: 1, explanation: 'Memoization has its own cost (memory, comparison overhead) — applying it to something that was never actually slow can add complexity for zero benefit or even a small regression.' },
            { question: 'What is the actual benefit of React.lazy for a rarely-visited admin route?', options: ['It makes the admin route render faster once loaded', 'It defers downloading that route\'s JavaScript until a user actually navigates there, shrinking the initial bundle everyone downloads', 'It disables the route for most users', 'It has no real effect'], correctIndex: 1, explanation: 'Code-splitting is about what gets downloaded and when, not re-render frequency — it shrinks what most users pay for on first load.' },
          ],
          miniProject: {
            title: 'Profile and fix a janky list',
            description: 'Given a list component that visibly lags on every keystroke of an unrelated search box elsewhere on the page, use the Profiler to find the real cause and fix it.',
            requirements: ['Screenshot or written note of the Profiler\'s "why did this render" output before the fix', 'The specific, correct fix is applied — not memo applied everywhere as a blanket guess'],
          },
          interviewBank: [
            {
              pattern: 'Profiler|why did this render',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'Walk me through how you actually found this specific performance problem, tool by tool.',
              expectedAnswer: 'Opened the DevTools Profiler, recorded a render while reproducing the janky interaction, and used the "why did this render" reason on the flagged component to see the actual cause (e.g. a new prop reference) rather than guessing which component to optimize.',
              evaluationRubric: ['Names the Profiler specifically, not "I just looked at the code"', 'Describes using the render-reason output, not just render duration', 'Confirms the fix targeted the actual diagnosed cause'],
            },
            {
              pattern: 'React\\.memo',
              difficulty: 'medium',
              experienceLevel: 'mid',
              question: 'If I wrapped every single component in this app in React.memo right now, would that be a good idea?',
              expectedAnswer: 'No — memo adds a comparison cost on every render for components that may never have been a real bottleneck, and for cheap, frequently-changing components the comparison itself can cost more than just re-rendering would have; it is a targeted fix for a profiled, real problem, not a default to apply everywhere.',
              evaluationRubric: ['Correctly says no, not "more optimization is always better"', 'Names the comparison overhead as a real cost', 'Frames memo as a targeted fix, not a blanket default'],
            },
            {
              pattern: 'React\\.lazy|Suspense',
              difficulty: 'hard',
              experienceLevel: 'mid',
              question: 'You code-split the admin route with React.lazy. Does that change how often components on the admin page re-render once a user is actually on it?',
              expectedAnswer: 'No — code-splitting only affects what JavaScript gets downloaded and when (deferring the admin bundle until navigation), it has nothing to do with re-render frequency once mounted; re-render optimization (memo/useMemo/useCallback) is a completely separate concern from bundle-loading optimization (lazy/Suspense).',
              evaluationRubric: ['Correctly says no and explains why these are separate concerns', 'Does not conflate loading performance with rendering performance', 'Can name which tool solves which problem'],
            },
          ],
          xpReward: 340,
          coinsReward: 170,
          skillMapping: { Performance: 30, React: 15 },
          careerDnaImpact: { 'Technical Mastery': 15, 'Problem Solving': 15 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Take a deliberately janky dashboard (an unrelated search input causes a large, unmemoized list to lag on every keystroke) and fix it using profiler-driven diagnosis, plus code-split one rarely-used settings route.',
            requirements: [
              'component:Dashboard', 'component:SettingsPanel',
            ],
            resources: [{ title: 'React Profiler', url: 'https://react.dev/reference/react/Profiler', type: 'doc' }],
            hints: [
              'Profile before changing anything — do not guess where the cost actually is',
              'React.lazy the settings route specifically because most users never open it',
            ],
            evaluationCriteria: [
              'The list no longer visibly lags when typing in the unrelated search box',
              'The applied fix is a specific, justified change (e.g. memo + stable callback), not memo scattered everywhere',
              'The settings route is code-split and loads only on navigation, not in the initial bundle',
            ],
            expectedSkills: ['Performance', 'React'],
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
      name: 'Milestone: Type-Safe Analytics Dashboard',
      description: 'Milestone 1 capstone — TypeScript, tests, global state, and profiler-driven performance work, combined into one project.',
      difficulty: 'expert',
      estimatedDurationHours: 26,
      xpRequired: 5100,
      nodes: [
        {
          nodeNumber: 1,
          title: 'Milestone: Type-Safe Analytics Dashboard',
          slug: 'milestone-type-safe-analytics-dashboard',
          description: 'Integrated Milestone 1 challenge — everything from Levels 6-9 combined into one recruiter-facing project.',
          learningObjectives: [
            'Combine TypeScript, component/hook testing, global state, and profiler-driven performance work into one cohesive, integrated project',
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
              pattern: 'useMemo|React\\.memo',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'This dashboard is fully typed, tested, uses a global store, and is profiled/optimized. Which of those four would you cut first if you had half the time, and why?',
              expectedAnswer: 'A strong, senior-level answer reasons about actual risk and cost rather than treating all four as equally essential: TypeScript and tests protect against regressions and are cheap to keep once established; the state management architecture is foundational and expensive to retrofit later; performance work is the most deferrable in a genuine time crunch specifically because it can be added later against real profiling data once the feature set is stable, whereas skipping types/tests/architecture upfront tends to cost more to retrofit than it saved.',
              evaluationRubric: ['Makes a real, defensible tradeoff call, not "I would keep everything"', 'Reasons about cost-to-retrofit-later as the deciding factor', 'Shows judgment appropriate to a senior-level prioritization question'],
            },
            {
              pattern: 'interface|Props',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'Show me one place where TypeScript actually caught a real bug for you while building this, not just satisfied the compiler.',
              expectedAnswer: 'A concrete, specific example from their own submission — a prop that was actually missing at a call site, a state shape mismatch, an event type that revealed a wrong property access — demonstrating TypeScript provided real value here, not just ceremony added to satisfy the challenge\'s requirements.',
              evaluationRubric: ['Gives a specific, real example from their own code, not a hypothetical', 'The example is a genuine caught bug, not just "it compiled"', 'Can explain what would have happened without the type catching it'],
            },
            {
              pattern: 'useCartStore|create\\(\\(set\\)',
              difficulty: 'hard',
              experienceLevel: 'senior',
              question: 'The dashboard\'s metrics state lives in a global store. Walk me through exactly which components read it, which ones write to it, and why that split makes sense.',
              expectedAnswer: 'A strong answer names the actual components in their own submission and the specific slices each one selects, justifying the split by which data is genuinely shared/frequently-changing (store-worthy) versus which is local UI-only state that correctly stayed as plain useState — not everything in the app needed to move into the global store.',
              evaluationRubric: ['Traces real components and slices from their own code, not a hypothetical', 'Justifies what stayed as local state, not just what moved to the store', 'Shows the same judgment about over-using global state discussed back in Level 8'],
            },
          ],
          xpReward: 500,
          coinsReward: 250,
          skillMapping: { TypeScript: 10, Testing: 10, 'State Management': 10, Performance: 10, React: 10 },
          careerDnaImpact: { 'Technical Mastery': 20, 'Execution Focus': 15, 'Problem Solving': 10, 'Collaborative Sync': 5 },
          difficulty: 'expert',
          trustLevel: 'B',
          challenge: {
            objective: 'Build a fully typed analytics dashboard: typed components/state throughout, a real Testing Library test suite, shared metrics state via a global store, and at least one profiler-diagnosed performance fix, code-split from the main bundle.',
            requirements: [
              'file:tsconfig.json', 'component:Dashboard', 'component:MetricCard', 'state:useState',
            ],
            resources: [
              { title: 'TypeScript: Documentation - React', url: 'https://www.typescriptlang.org/docs/handbook/react.html', type: 'doc' },
              { title: 'React Testing Library', url: 'https://testing-library.com/docs/react-testing-library/intro/', type: 'doc' },
            ],
            hints: [
              'This is the Milestone 1 capstone — the AI Review stage weighs architecture and integration across all four skills, not any single one in isolation',
              'Profile before optimizing, and keep the profiler evidence (screenshot or notes) to reference in review',
            ],
            evaluationCriteria: [
              'No `any` type appears anywhere in the codebase',
              'A real test suite covers at least the dashboard\'s core interactions, using Testing Library queries',
              'Shared dashboard state is managed through a global store, not prop-drilled',
              'At least one specific, profiler-justified performance fix is present and documented',
            ],
            expectedSkills: ['TypeScript', 'Testing', 'State Management', 'Performance'],
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
