import { $ } from "bun"
import { join } from "path"

export const typegen = async (entrypoint: string, destination: string) => {
  const isTTY = process.stdout.isTTY
  if (isTTY) {
    let spinnerActive = true
    const spinnerFrames = ["|", "/", "-", "\\"]
    let spinnerIndex = 0
    process.stdout.write("   ")
    const spinner = setInterval(() => {
      process.stdout.write(`\r${spinnerFrames[spinnerIndex++ % spinnerFrames.length]}  Генерация типов...`)
    }, 120)

    // Включаем все необходимые типы для полноценного автодополнения
    await $`dts-bundle-generator --out-file ${destination} --export-referenced-types true --inline-declare-global true --inline-declare-externals true ${entrypoint}`.quiet()

    spinnerActive = false
    clearInterval(spinner)
    process.stdout.write("\r✅ Типы успешно сгенерированы!           \n")
  } else {
    console.log("🛠️  Генерация типов...")
    // Включаем все необходимые типы для полноценного автодополнения
    await $`dts-bundle-generator --out-file ${destination} --export-referenced-types true --inline-declare-global true --inline-declare-externals true ${entrypoint}`.quiet()
    console.log("✅ Типы успешно сгенерированы!")
  }
}

if (import.meta.main) {
  const fileName = "index"
  const entrypoint = `./${fileName}.ts`
  const distDir = "./dist"
  const typeDest = join(distDir, `${fileName}.d.ts`)

  await typegen(entrypoint, typeDest)
}
