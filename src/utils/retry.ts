export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs?: number
): Promise<T> {
  let attempts = 0;

  while (attempts < retries) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempts + 1 < retries) {
        if (delayMs !== undefined) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        attempts += 1;
      } else {
        console.error(`Failed after ${retries} attempts: ${err.message}`);

        throw err;
      }
    }
  }

  throw new Error("Unexpected error");
}