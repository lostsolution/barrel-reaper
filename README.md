> WIP

# BARREL REAPER

Barrel imports create significant development performance issues. For instance A simple barrel import forces development tools to process the entire barrel exports instead of just the needed modules.

As dev-tools don't tree-shake, every barrel import loads hundreds of unused modules, increasing memory usage and slowing hot reloads. **BARREL REAPER converts barrel imports to direct imports**, eliminating the performance overhead at its source.
