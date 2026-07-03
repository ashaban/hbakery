import vuetifyConfig from 'eslint-config-vuetify'
import prettierConfig from 'eslint-config-prettier'

// eslint-config-vuetify ships its own formatting rules (quotes, indent,
// arrow-parens, closing-bracket placement, ...) that don't match this
// codebase's actual Prettier-produced style — including the `>text</tag\n>`
// dangling-bracket pattern used throughout components/*.vue. Running
// `eslint --fix` without disabling those rules first has been observed to
// corrupt .vue files (merged/garbled tags) because the two formatters
// disagree on the "correct" output for the same construct. Layering
// eslint-config-prettier last turns off every ESLint rule that conflicts
// with Prettier, so formatting is Prettier's job alone and ESLint --fix
// only touches non-stylistic rules (unused vars, etc).
export default [...vuetifyConfig, prettierConfig]
