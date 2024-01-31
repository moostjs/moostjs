export function formatParams(keys: string[]) {
  const names = [keys].flat()
  return names.map(n => (n.length === 1 ? `-${n}` : `--${n}`))
}
