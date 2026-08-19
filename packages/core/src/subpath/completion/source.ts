import { SYSTEM } from '@func/contracts/core-errors'
import type { CompletionResult, CompletionShell } from './interfaces'
import { InternalException } from '../../shared/errors'

export const completionEnvironmentVariable = (bin: string): string => {
  validateBin(bin)
  return `_${bin.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_COMPLETE`
}

export const completionSource = (bin: string, shell: CompletionShell): string => {
  const environment = completionEnvironmentVariable(bin)
  const functionName = `_${bin.replace(/[^A-Za-z0-9_]/g, '_')}_completion`
  switch (shell) {
    case 'bash':
      return bashSource(bin, environment, functionName)
    case 'elvish':
      return elvishSource(bin, environment)
    case 'fish':
      return fishSource(bin, environment, functionName)
    case 'nushell':
      return nushellSource(bin, environment, functionName)
    case 'powershell':
      return powershellSource(bin, environment)
    case 'zsh':
      return zshSource(bin, environment, functionName)
    default:
      throw new InternalException(SYSTEM.INVALID_COMPLETION_SHELL, {
        details: { shell },
      })
  }
}

export const formatCompletionResult = (
  result: CompletionResult,
  shell: CompletionShell,
): string => {
  const header = `${result.fallback}\t${result.appendSpace ? '1' : '0'}`
  const lines = result.items.flatMap(candidate => {
    if (
      candidate.value.includes(String.fromCharCode(0)) ||
      /[\t\r\n]/.test(candidate.value)
    )
      return []
    const description = normalizeDescription(candidate.description)
    if (shell === 'zsh')
      return [`${escapeZsh(candidate.value)}:${escapeZsh(description)}`]
    return [`${candidate.value}\t${description}`]
  })
  return `${[header, ...lines].join('\n')}\n`
}

const bashSource = (
  bin: string,
  environment: string,
  functionName: string,
): string => `# bash completion for ${bin}
${functionName}() {
  local current="\${COMP_WORDS[COMP_CWORD]}"
  local -a committed=()
  local -a response=()
  local line value fallback append_space index

  if (( COMP_CWORD > 1 )); then
    committed=("\${COMP_WORDS[@]:1:$((COMP_CWORD - 1))}")
  fi
  while IFS= read -r line; do
    response+=("$line")
  done < <(env ${environment}=bash_complete ${quotePosix(bin)} "\${committed[@]}" "$current" 2>/dev/null)
  if (( \${#response[@]} == 0 )); then
    return 0
  fi

  IFS=$'\\t' read -r fallback append_space <<< "\${response[0]}"
  COMPREPLY=()
  for (( index = 1; index < \${#response[@]}; index += 1 )); do
    IFS=$'\\t' read -r value _ <<< "\${response[index]}"
    COMPREPLY+=("$value")
  done
  if [[ "$fallback" == "file" ]]; then
    compopt -o default 2>/dev/null
  else
    compopt +o default 2>/dev/null
  fi
  if [[ "$append_space" == "0" ]]; then
    compopt -o nospace 2>/dev/null
  fi
}

complete -o default -F ${functionName} -- ${quotePosix(bin)}
`

const elvishSource = (bin: string, environment: string): string =>
  `# Elvish completion for ${bin}
use str

set edit:completion:arg-completer[${quoteElvish(bin)}] = {|@words|
  var response = [(env ${environment}=elvish_complete ${quoteElvish(bin)} (all $words[1..-1]) $words[-1] 2>/dev/null)]
  if (== (count $response) 0) {
    return
  }

  var header = [(str:split "\t" $response[0])]
  var fallback = $header[0]
  var suffix = ''
  if (== $header[1] 1) {
    set suffix = ' '
  }
  if (> (count $response) 1) {
    each {|line|
      var fields = [(str:split "\t" $line)]
      var value = $fields[0]
      var description = ''
      if (> (count $fields) 1) {
        set description = $fields[1]
      }
      var display = $value
      if (not-eq $description '') {
        set display = $value'  '$description
      }
      edit:complex-candidate $value &display=$display &code-suffix=$suffix
    } $response[1..]
    return
  }
  if (== $fallback file) {
    edit:complete-filename $words[-1]
  }
}
`

const fishSource = (
  bin: string,
  environment: string,
  functionName: string,
): string => `# fish completion for ${bin}
function ${functionName}
  set -l committed (commandline -opc)
  if test (count $committed) -gt 0
    set -e committed[1]
  end
  set -l current (commandline -ct)
  set -l response (env ${environment}=fish_complete ${quotePosix(bin)} $committed "$current" 2>/dev/null)
  if test (count $response) -eq 0
    return
  end

  set -l header (string split (printf '\\t') -- $response[1])
  if test (count $response) -gt 1
    printf '%s\\n' $response[2..-1]
    return
  end
  if test "$header[1]" = file
    __fish_complete_path "$current"
  end
end

complete -c ${quotePosix(bin)} -f -a '(${functionName})'
`

const nushellSource = (
  bin: string,
  environment: string,
  functionName: string,
): string => `# Nushell completion for ${bin}
def ${functionName} [spans: list<string>] {
  let arguments = ($spans | skip 1)
  let current = ($arguments | last | default '')
  let committed = ($arguments | drop 1)
  let response = (
    with-env { ${environment}: 'nushell_complete' } {
      ^${quoteNushell(bin)} ...$committed $current | ignore --stderr
    }
    | lines
  )
  if ($response | is-empty) {
    return []
  }

  let header = ($response | first | split row (char tab))
  let fallback = ($header | first)
  let candidates = (
    $response
    | skip 1
    | each {|line|
        let fields = ($line | split row (char tab))
        {
          value: ($fields | first)
          description: ($fields | get -o 1 | default '')
        }
      }
  )
  if (($candidates | is-empty) and $fallback == 'file') {
    return null
  }
  $candidates
}

@complete ${functionName}
extern ${quoteNushell(bin)} []
`

const powershellSource = (bin: string, environment: string): string =>
  `# PowerShell completion for ${bin}
Register-ArgumentCompleter -Native -CommandName ${quotePowerShell(bin)} -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)

  $committed = @()
  $currentStart = $cursorPosition - $wordToComplete.Length
  foreach ($element in @($commandAst.CommandElements | Select-Object -Skip 1)) {
    if ($element.Extent.EndOffset -gt $currentStart) {
      continue
    }
    if ($null -ne $element.Value) {
      $committed += [string]$element.Value
      continue
    }
    $committed += [string]$element
  }

  $previous = [Environment]::GetEnvironmentVariable(${quotePowerShell(environment)}, 'Process')
  try {
    [Environment]::SetEnvironmentVariable(${quotePowerShell(environment)}, 'powershell_complete', 'Process')
    $response = @(& ${quotePowerShell(bin)} @committed $wordToComplete 2>$null)
  } finally {
    [Environment]::SetEnvironmentVariable(${quotePowerShell(environment)}, $previous, 'Process')
  }
  if ($response.Count -eq 0) {
    return
  }

  $header = @($response[0] -split "\u0060t", 2)
  if ($response.Count -eq 1 -and $header[0] -eq 'file') {
    [System.Management.Automation.CompletionCompleters]::CompleteFilename($wordToComplete)
    return
  }
  foreach ($line in @($response | Select-Object -Skip 1)) {
    $parts = @($line -split "\u0060t", 2)
    $value = $parts[0]
    $description = if ($parts.Count -gt 1 -and $parts[1]) { $parts[1] } else { $value }
    $completionText = if ($value -match '\\s') { "'" + $value.Replace("'", "''") + "'" } else { $value }
    [System.Management.Automation.CompletionResult]::new(
      $completionText,
      $value,
      [System.Management.Automation.CompletionResultType]::ParameterValue,
      $description
    )
  }
}
`

const zshSource = (
  bin: string,
  environment: string,
  functionName: string,
): string => `#compdef ${bin}
${functionName}() {
  local current_word="\${words[CURRENT]}"
  local header fallback
  local -a committed response candidates

  if (( CURRENT > 2 )); then
    committed=("\${words[2,CURRENT-1]}")
  fi
  response=("\${(@f)$(env ${environment}=zsh_complete ${quotePosix(bin)} "\${committed[@]}" "$current_word" 2>/dev/null)}")
  if (( \${#response[@]} == 0 )); then
    return 0
  fi

  header="\${response[1]}"
  fallback="\${header%%$'\\t'*}"
  if (( \${#response[@]} > 1 )); then
    candidates=("\${response[2,-1]}")
    _describe 'values' candidates
    return
  fi
  if [[ "$fallback" == "file" ]]; then
    _files
  fi
}

compdef ${functionName} ${quotePosix(bin)}
`

const normalizeDescription = (value?: string): string =>
  value?.replace(/\s+/g, ' ').trim() ?? ''

const escapeZsh = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/:/g, '\\:')

const quotePosix = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`

const quoteElvish = (value: string): string => `'${value.replace(/'/g, "''")}'`

const quoteNushell = (value: string): string => `'${value.replace(/'/g, "''")}'`

const quotePowerShell = (value: string): string => `'${value.replace(/'/g, "''")}'`

const validateBin = (bin: string) => {
  if (
    typeof bin !== 'string' ||
    !bin.length ||
    bin.includes(String.fromCharCode(0)) ||
    /\s/.test(bin)
  )
    throw new InternalException(SYSTEM.INVALID_COMPLETION_BIN, {
      details: { bin },
    })
}
