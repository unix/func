const assert = require('node:assert/strict')
const func = require('func')

const systemError = new func.Exception('INVALID_TOKEN', {
  details: { source: 'ecosystem' },
  message: 'system probe',
  scope: func.ErrorScope.SYSTEM,
})
assert.ok(systemError instanceof func.Exception)
assert.equal(func.isException(systemError), true)
assert.equal(systemError.code, 'F_SYSTEM_INVALID_TOKEN')
assert.equal(systemError.details.source, 'ecosystem')

assert.equal(func.Catch, undefined)
assert.equal(func.UseFilters, undefined)

class AppModule {}
func.Module({ commands: [] })(AppModule)
assert.ok(func.createApp(AppModule) instanceof func.Container)

console.log(
  JSON.stringify({
    status: 'ok',
    systemScope: func.ErrorScope.SYSTEM,
  }),
)
