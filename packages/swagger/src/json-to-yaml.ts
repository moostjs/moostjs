const YAML_SPECIAL = /^[\s#!&*|>'{}\[\],?:@`-]|[:#]\s|[\n\r]|\s$/

function quoteString(str: string): string {
  if (str === '') return "''"
  if (YAML_SPECIAL.test(str) || str === 'true' || str === 'false' || str === 'null') {
    return JSON.stringify(str)
  }
  const num = Number(str)
  if (str.length > 0 && !Number.isNaN(num) && String(num) === str) {
    return JSON.stringify(str)
  }
  return str
}

function serializeValue(value: unknown, indent: number): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null'
  if (typeof value === 'string') return quoteString(value)

  const pad = '  '.repeat(indent)
  const childPad = '  '.repeat(indent + 1)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const lines: string[] = []
    for (const item of value) {
      if (isObject(item) || Array.isArray(item)) {
        // Serialize at child indent, then replace leading padding on first line with "- "
        const nested = serializeValue(item, indent + 1)
        lines.push(`${pad}- ${nested.slice(childPad.length)}`)
      } else {
        lines.push(`${pad}- ${serializeValue(item, 0)}`)
      }
    }
    return lines.join('\n')
  }

  if (isObject(value)) {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    const lines: string[] = []
    for (const [key, val] of entries) {
      const yamlKey = quoteString(key)
      if (isObject(val) || Array.isArray(val)) {
        const nested = serializeValue(val, indent + 1)
        if (nested === '[]' || nested === '{}') {
          lines.push(`${pad}${yamlKey}: ${nested}`)
        } else {
          lines.push(`${pad}${yamlKey}:\n${nested}`)
        }
      } else {
        lines.push(`${pad}${yamlKey}: ${serializeValue(val, 0)}`)
      }
    }
    return lines.join('\n')
  }

  return String(value)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function jsonToYaml(value: unknown): string {
  return serializeValue(value, 0) + '\n'
}
