import * as func from 'func'
import * as funcgo from 'funcgo'

const publicEntries = library => {
  return Object.keys(library)
    .filter(
      name =>
        name !== 'default' && name !== '__esModule' && name !== 'module.exports',
    )
    .sort()
    .map(name => [name, typeof library[name]])
}

console.log(
  JSON.stringify({
    func: Object.fromEntries(publicEntries(func)),
    funcgo: Object.fromEntries(publicEntries(funcgo)),
  }),
)
