---
editLink: https://github.com/WittBulter/func/blob/master/docs/apis.md
---

# API

## Command

| Signature | Param structure | Description |
|----|----|----|
| `@Command(params: CommandParams)` | `CommandParams = { name: string, description?: string, alias?: string }` | create command |
| `@Option(params: OptionParams)` | `OptionParams = { name: string, type?: OptionType, description?: string, alias?: string }` | create option |
| `@SubOptions(params: Array<OptionParams>)` | ditto | create a suboption, usually used after `Command` |
| `@CommandNotFound()` | - | create a method to capture undeclared commands |
| `@CommandMajor()` | - | main command |

## Arguments

| Signature | Description |
|----|----|
| `CommandArgsProvider` | provide infos about the current command |
| `OptionArgsProvider` | provide infos about the current option |
| `RegisterProvider` | provide all registered metadata |


## support

 - `func-service dev`: Reset development environment, point `bin` to development.
 - `func-service build`: Bundle all files, point `bin` to production.
