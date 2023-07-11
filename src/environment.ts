export function isUsingNode(): boolean {
  return typeof process !== 'undefined' && process.release && process.release.name === 'node'
}
