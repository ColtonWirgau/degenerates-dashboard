import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // Unused code is an ERROR, not a warning.
    //
    // It sat at fifteen warnings for long enough that the number stopped
    // being read — and two of them were real: a pair of props that
    // callers were still computing values for, feeding a scroll
    // indicator that had been deleted. A warning nobody acts on is worse
    // than no rule, because it launders the ones that matter.
    //
    // The underscore escape hatch is deliberate: a genuinely unused
    // parameter you must name to reach the one after it is `_thing`.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
