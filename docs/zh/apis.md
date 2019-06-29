# API 参考

## 命令

| 名称 | 参数 | 描述 |
|----|----|----|
| `@Command(params: CommandParams)` | `CommandParams = { name: string, description?: string, alias?: string }` | 创建 Command |
| `@Option(params: OptionParams)` | `OptionParams = { name: string, type?: OptionType, description?: string, alias?: string }` | 创建 option |
| `@SubOptions(params: Array<OptionParams>)` | ditto | 创建子命令, 只能用于 `Command` 之后 |
| `@CommandMissing()` | - | 创建用于兜底的命令 |
| `@CommandMajor()` | - | 主命令 |

## 参数

| 名称 | 描述 |
|----|----|
| `CommandArgsProvider` | Command 的参数 |
| `OptionArgsProvider` | Option 参数 |
| `RegisterProvider` | 所有的注册信息，可用于任何命令上 |


## 脚手架

 - `func-service dev`: 重置开发环境，运行一次即可
 - `func-service build`: 打包代码，并链接生成环境
