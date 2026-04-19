/** full re-export */
export * from './module-a';

/** named re-exports */
export { default as B, b1, b2, b3 } from './module-b';

/** type-only exports */
export type { TypeB } from './module-b';

/** mixed type and value exports */
export { b1 as b1Renamed, type InterfaceB } from './module-b';

/** re-export with renaming */
export { b2 as b2Renamed } from './module-b';

/** namespace exports */
export * as ModuleA from './module-a';
export * as ModuleB from './module-b';

/** default export in barrel */
export default {};

/** re-export with enums */
export * from './module-enum';
