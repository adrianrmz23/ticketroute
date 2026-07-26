import { spawnSync } from "node:child_process";

const checks = [
  ["Pruebas", ["run", "test"]],
  ["TypeScript", ["run", "typecheck"]],
  ["ESLint", ["run", "lint"]],
  ["Producción", ["run", "build"]],
];

const spawnOptions = {
  stdio: "inherit",
  env: process.env,
};

/**
 * Ejecuta npm de forma compatible con Windows, macOS y Linux.
 *
 * Cuando el script se inicia mediante "npm run verify",
 * npm_execpath contiene la ruta directa al CLI de npm.
 */
function runNpm(args) {
  const npmExecPath = process.env.npm_execpath;

  if (npmExecPath) {
    return spawnSync(process.execPath, [npmExecPath, ...args], spawnOptions);
  }

  // Respaldo para cuando se ejecute directamente:
  // node scripts/verify.mjs
  if (process.platform === "win32") {
    const commandProcessor = process.env.ComSpec ?? "cmd.exe";
    const command = ["npm", ...args].join(" ");

    return spawnSync(
      commandProcessor,
      ["/d", "/s", "/c", command],
      spawnOptions,
    );
  }

  return spawnSync("npm", args, spawnOptions);
}

for (const [label, args] of checks) {
  console.log(`\nTicketRoute · ${label}`);

  const result = runNpm(args);

  if (result.error) {
    console.error(`\nNo se pudo iniciar la etapa: ${label}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.signal) {
    console.error(
      `\nLa etapa ${label} fue interrumpida por la señal: ${result.signal}`,
    );
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\nFalló la etapa: ${label}`);
    console.error(`Código de salida: ${result.status ?? "desconocido"}`);
    process.exit(result.status ?? 1);
  }
}

console.log("\nTicketRoute · verificación integral aprobada.");