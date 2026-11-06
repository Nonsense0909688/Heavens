// heaven completion bash|zsh|powershell — print a shell completion script.
import { HeavenError } from '../core/errors.js';
import { VALUE_FLAGS, BOOL_FLAGS } from '../cli/flag-definitions.js';

const COMMANDS = ['get','post','put','patch','delete','head','options','save','run','list','ls','rm','env','history','replay','compare','flow','bench','init','import','export','mock','completion','help'];
const METHODS = ['get','post','put','patch','delete','head','options'];
const FLAGS = [
  ...Object.keys(VALUE_FLAGS).map(f => '--' + f),
  ...Object.keys(BOOL_FLAGS).map(f => '--' + f),
  ...Object.values(VALUE_FLAGS).map(v => v.short && '-' + v.short).filter(Boolean),
  ...Object.values(BOOL_FLAGS).map(v => v && '-' + v).filter(Boolean),
];

export function bashScript() {
  return `_heaven() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local cmds="${COMMANDS.join(' ')}"
  local flags="${FLAGS.join(' ')}"
  if [[ $COMP_CWORD -eq 1 ]]; then COMPREPLY=($(compgen -W "$cmds" -- "$cur")); else COMPREPLY=($(compgen -W "$flags" -- "$cur")); fi
}
complete -F _heaven heaven hv
`;
}

export function zshScript() {
  return `#compdef heaven
_heaven() {
  local -a cmds flags
  cmds=(${COMMANDS.map(c => `'${c}'`).join(' ')})
  flags=(${FLAGS.map(c => `'${c}'`).join(' ')})
  _arguments '*: :->args'
  case $state in
    args)
      if (( CURRENT == 2 )); then _values 'command' $cmds; else _values 'option' $flags; fi
      ;;
  esac
}
_heaven "$@"
`;
}

export function powershellScript() {
  return `Register-ArgumentCompleter -CommandName heaven,hv -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  '${COMMANDS.concat(FLAGS).join(' ')}' -split ' ' | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
    [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
  }
}
`;
}

export async function cmdCompletion(ctx) {
  const shell = String(ctx.pos[1] ?? '').toLowerCase();
  if (shell === 'bash') { ctx.out.write(bashScript()); return 0; }
  if (shell === 'zsh') { ctx.out.write(zshScript()); return 0; }
  if (shell === 'powershell' || shell === 'pwsh') { ctx.out.write(powershellScript()); return 0; }
  throw new HeavenError('Usage: heaven completion bash|zsh|powershell');
}
