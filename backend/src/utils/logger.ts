const ts = (): string => new Date().toISOString();

const logger = {
  info: (...args: unknown[]): void => console.log(`[INFO ] ${ts()}`, ...args),
  warn: (...args: unknown[]): void => console.warn(`[WARN ] ${ts()}`, ...args),
  error: (...args: unknown[]): void => console.error(`[ERROR] ${ts()}`, ...args),
  debug: (...args: unknown[]): void => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${ts()}`, ...args);
    }
  },
};

export default logger;
