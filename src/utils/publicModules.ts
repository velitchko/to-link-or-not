export const publicModules = import.meta.glob([
  '../public/**/*.{mjs,js,mts,ts,jsx,tsx}',
  '!../public/**/*.test.{mjs,js,mts,ts,jsx,tsx}',
  '!../public/**/*.spec.{mjs,js,mts,ts,jsx,tsx}',
  '!../public/**/__tests__/**',
], {
  eager: true,
});
