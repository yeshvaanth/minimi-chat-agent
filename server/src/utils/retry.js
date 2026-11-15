
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const retryAsync = async (operation, maxAttempts = 3) => {
  if (typeof operation !== "function") {
    throw new TypeError("Operation must be a function");
  }

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("maxAttempts must be a positive integer");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const status = Number(error.status || error.code);

      // Retry only temporary server errors
      const isRetryable = [500, 502, 503, 504].includes(status);

      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }

      // Exponential backoff: 1 second, then 2 seconds
      const delay = 1000 * 2 ** (attempt - 1);

      console.warn(
        `API request failed. Retrying ${attempt}/${maxAttempts} in ${delay}ms`
      );

      await wait(delay);
    }
  }
};
