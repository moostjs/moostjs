// Named exports (not `export *`): `onInfactEvent` is an internal event sink
// exported from './infact' for direct-invocation tests only.
export {
  defineInfactScope,
  getInfactScopeVars,
  getMoostInfact,
  getNewMoostInfact,
  setInfactLoggingOptions,
} from './infact'
export * from './moost-metadata'
