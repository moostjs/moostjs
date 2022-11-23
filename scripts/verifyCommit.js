import { dye } from '@prostojs/dye'
import fs from 'fs'
// Invoked on the commit-msg git hook by yorkie.
const msgPath = process.env.GIT_PARAMS
const msg = fs
  .readFileSync(msgPath, 'utf-8')
  .trim()

const commitRE = /^(revert: )?(feat|fix|docs|dx|style|refactor|perf|test|workflow|build|ci|chore|types|wip|release)(\(.+\))?: .{1,50}/

const s = {
  error: dye('white', 'bg-red', 'bold'),
  errorText: dye('red'),
  green: dye('green'),
}

if (!commitRE.test(msg)) {
  console.log()
  console.error(
    `  ${s.error(' ERROR ')} ${s.errorText(
      `invalid commit message format.`
    )}\n\n` +
      s.errorText(
        `  Proper commit message format is required for automated changelog generation. Examples:\n\n`
      ) +
      `    ${s.green(`feat(compiler): add 'comments' option`)}\n` +
      `    ${s.green(
        `fix(v-model): handle events on blur (close #28)`
      )}\n\n` +
      s.errorText(`  See .github/commit-convention.md for more details.\n`)
  )
  process.exit(1)
}