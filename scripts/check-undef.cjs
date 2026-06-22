#!/usr/bin/env node
/**
 * Pre-deploy guard: fail if any file in src/ references an undefined variable
 * (rule: no-undef). This is the exact class of bug that crashed the app when
 * <MoveArrow> was deleted but still referenced — it builds fine, then explodes
 * at runtime. Catching it here means a broken deploy never reaches users.
 *
 * We check ONLY no-undef (not the 200+ pre-existing style warnings), so this
 * stays a tight, trustworthy gate.
 */
const { ESLint } = require('eslint')

;(async () => {
  const eslint = new ESLint()
  const results = await eslint.lintFiles(['src'])
  const undef = []
  for (const r of results) {
    for (const m of r.messages) {
      if (m.ruleId === 'no-undef') {
        undef.push(`  ${r.filePath.replace(process.cwd() + '/', '')}:${m.line} — ${m.message}`)
      }
    }
  }
  if (undef.length) {
    console.error('\n❌ UNDEFINED VARIABLE(S) in src/ — do NOT deploy:\n' + undef.join('\n') + '\n')
    process.exit(1)
  }
  console.log('✓ no undefined variables in src/')
})().catch(e => { console.error(e); process.exit(1) })
