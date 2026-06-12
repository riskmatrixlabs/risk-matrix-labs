# Risk Matrix Labs — Setup Guide
## Plain English. Step by Step. No Rush.

---

## BEFORE YOU START — What is Claude Code?

Claude Code is a tool you run on your computer (not in a browser).
You type commands in a black "terminal" window, and Claude Code reads your
CLAUDE.md file and helps you build your app file by file.

Think of it like having a developer sitting next to you who:
- Reads your rulebook (CLAUDE.md) before every session
- Builds one piece at a time
- Explains everything it does
- Remembers your brand, colors, and structure

---

## STEP 1 — Install the tools you need

You only need to do this once.

### Install Node.js
Node.js is the engine that runs your app locally on your computer.
Think of it like installing a game engine before playing a game.

1. Go to: https://nodejs.org
2. Click the big green "LTS" download button (LTS = Long Term Stable = safest)
3. Install it like any normal program
4. To confirm it worked: open Terminal and type:
   node --version
   You should see something like: v20.x.x

### Install Claude Code
Claude Code is a command-line tool from Anthropic.
1. In your Terminal, type:
   npm install -g @anthropic/claude-code
2. Follow the login instructions to connect your Anthropic account

---

## STEP 2 — Create your project folder

Think of this like creating a brand new empty house for your app to live in.

1. On your computer, create a folder called:
   risk-matrix-labs

2. Put it somewhere easy to find, like your Desktop or Documents folder

3. Inside that folder, create these subfolders now:
   public/
   public/brand/
   src/

That's it for now. We'll add more folders as we build each piece.

---

## STEP 3 — Copy your brand images into the project

Your brand images are your reference material.
Claude Code will look at them to keep the design consistent.

Copy these 4 images into: public/brand/

Rename them to these exact names:
- brand-sheet.png        (the full brand guide with colors/fonts)
- dashboard-v2.png       (the full dashboard screenshot)
- logo-labs.png          (the Risk Matrix Labs logo)
- logo-dashboard.png     (the Risk Matrix Dashboard logo)

Why does naming matter?
Because CLAUDE.md tells Claude Code exactly where to find them.
If the names don't match, Claude Code won't know which image is which.

---

## STEP 4 — Add CLAUDE.md to your project

CLAUDE.md is the most important file in your project.
It's the instruction manual Claude Code reads before every session.

1. Copy the CLAUDE.md file into the ROOT of your project folder
   (root means the main folder, not inside any subfolder)

Your folder should now look like this:
risk-matrix-labs/
├── public/
│   └── brand/
│       ├── brand-sheet.png
│       ├── dashboard-v2.png
│       ├── logo-labs.png
│       └── logo-dashboard.png
├── src/
└── CLAUDE.md          ← HERE

---

## STEP 5 — Initialize your React project

This is where we turn your empty folder into a real React app.
React is the tool we use to build the interactive dashboard.

1. Open Terminal
2. Navigate to your project folder:
   cd Desktop/risk-matrix-labs
   (adjust the path to wherever you put it)

3. Run this command to create the React app:
   npm create vite@latest . -- --template react
   (The dot means "create it in the current folder")

4. When it asks questions, choose:
   - Framework: React
   - Variant: JavaScript (not TypeScript — we keep it simple)

5. Then run:
   npm install

This downloads all the tools your app needs.
You'll see a node_modules folder appear — that's normal.

---

## STEP 6 — Install Tailwind CSS

Tailwind CSS is the styling system.
Instead of writing complex CSS, you add short words to your components
like "text-green-400" to make text green, or "p-4" to add padding.

Run these commands in your Terminal one at a time:

npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

Then open tailwind.config.js and replace everything with:

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

Then open src/index.css and replace everything with:

@tailwind base;
@tailwind components;
@tailwind utilities;

---

## STEP 7 — Start Claude Code for the first time

1. Open Terminal
2. Navigate to your project:
   cd Desktop/risk-matrix-labs

3. Start Claude Code:
   claude

4. Claude Code will read your CLAUDE.md automatically
5. You'll see a prompt — now you can start building

Your first message to Claude Code should be:
"Read the CLAUDE.md and tell me what Phase 1 tasks we need to complete first."

---

## STEP 8 — What Claude Code will build first

In your first real session, ask Claude Code to:
1. Set up the CSS variables (brand colors and fonts)
2. Build the App shell (header + basic layout)
3. Build the first StatCard component

That's it. Nothing more in session 1.

---

## FILE NAMING RULES (important)

Always use these naming conventions:
- Components: PascalCase  →  StatCard.jsx, LadderTable.jsx
- Utilities: camelCase   →  bankrollCalc.js, formatters.js
- Pages: PascalCase      →  Dashboard.jsx, BetHistory.jsx
- CSS files: lowercase   →  globals.css

Why does this matter?
Consistent naming means Claude Code always knows where things are.
It also makes your project easier to read and maintain.

---

## WHAT NOT TO DO (common beginner mistakes)

❌ Don't build everything at once — one component at a time
❌ Don't skip CLAUDE.md — it keeps every session consistent
❌ Don't rename your brand images — Claude Code looks for exact names
❌ Don't commit your .env file — it contains secret keys
❌ Don't install packages you don't understand yet
❌ Don't start Phase 2 (database) until Phase 1 is complete

---

## QUICK COMMAND REFERENCE

| What you want | Command |
|---|---|
| Start the app locally | npm run dev |
| Start Claude Code | claude |
| Install a new package | npm install [package-name] |
| See what's installed | cat package.json |
| Check Node version | node --version |

---

## YOUR FIRST SESSION CHECKLIST

Before your first Claude Code session, confirm:
[ ] Node.js is installed (node --version works)
[ ] Claude Code is installed (claude --version works)
[ ] Your project folder exists
[ ] Brand images are in public/brand/ with correct names
[ ] CLAUDE.md is in the root folder
[ ] npm install has been run

Once all boxes are checked — you're ready.

---

*Risk Matrix Labs LLC | Operate With Discipline.*
