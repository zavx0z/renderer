import {plugin} from "bun"
import {realpathSync} from "node:fs"
import {dirname, relative, resolve, sep} from "node:path"
import {createTemplateJsxBunPlugin} from "@zavx0z/template/bun"

const packageRoot = resolve(import.meta.dir, "..")
const probe = resolve(packageRoot, "src/event-modifier.ts")
let physicalRoot = realpathSync.native(probe)
for (const _segment of relative(packageRoot, probe).split(sep).filter(Boolean)) {
  physicalRoot = dirname(physicalRoot)
}
const sourceRoots = physicalRoot === packageRoot ? [packageRoot] : [packageRoot, physicalRoot]

plugin(createTemplateJsxBunPlugin({
  persistent: true,
  sourceRoots,
  styleSourceRootIds: sourceRoots.map(() => "@zavx0z/dom"),
}))
