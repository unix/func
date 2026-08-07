const func = require('func')
const funcgo = require('funcgo')

console.log(
  JSON.stringify({
    func: Object.fromEntries(
      Object.keys(func)
        .sort()
        .map(name => [name, typeof func[name]]),
    ),
    funcgo: Object.fromEntries(
      Object.keys(funcgo)
        .sort()
        .map(name => [name, typeof funcgo[name]]),
    ),
  }),
)
