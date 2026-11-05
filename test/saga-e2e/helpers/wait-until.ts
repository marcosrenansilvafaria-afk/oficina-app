/**
 * Espera uma condicao assincrona ficar verdadeira, repetindo `check()` em
 * intervalos regulares. Usado para absorver a latencia de entrega do SQS
 * (long-poll de até 20s) entre um evento ser publicado por um servico e o
 * outro reagir - sem isso os testes seriam instaveis (flaky) por natureza.
 */
export async function waitUntil<T>(
  check: () => Promise<T | undefined | null>,
  options: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 1_000;
  const deadline = Date.now() + timeoutMs;

  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result !== undefined && result !== null) {
        return result;
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const label = options.label ? ` (${options.label})` : '';
  throw new Error(
    `Timeout apos ${timeoutMs}ms esperando condicao${label}.${
      lastError ? ` Ultimo erro: ${(lastError as Error).message}` : ''
    }`,
  );
}
