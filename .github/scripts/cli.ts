import { pathToFileURL } from "node:url";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function directExecutionExitCode<Arguments extends unknown[]>(
  moduleUrl: string,
  scriptPath: string | undefined,
  run: (...argumentsList: Arguments) => number,
  argumentsList: Arguments,
  currentExitCode: number | undefined,
): number | undefined {
  return moduleUrl === pathToFileURL(scriptPath ?? "").href
    ? run(...argumentsList)
    : currentExitCode;
}

export async function directExecutionExitCodeAsync<Arguments extends unknown[]>(
  moduleUrl: string,
  scriptPath: string | undefined,
  run: (...argumentsList: Arguments) => Promise<number>,
  argumentsList: Arguments,
  currentExitCode: number | undefined,
): Promise<number | undefined> {
  return moduleUrl === pathToFileURL(scriptPath ?? "").href
    ? await run(...argumentsList)
    : currentExitCode;
}
