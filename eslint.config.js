import globals from "globals";

export default [
  {
    ignores: ["dist/**", "dist/*/**", "node_modules/**"],
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        Buffer: "readonly",
        Promise: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        JSON: "readonly",
        URL: "readonly",
        WebSocket: "readonly",
        MutationObserver: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        Worker: "readonly",
        MessageChannel: "readonly",
        crypto: "readonly",
        BigInt: "readonly",
        Map: "readonly",
        Set: "readonly",
        Symbol: "readonly",
        WeakMap: "readonly",
        WeakSet: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn"
    }
  }
];
