// eslint-config-next v16 ships native flat configs, so these are spread
// directly. Routing them through @eslint/eslintrc's FlatCompat crashes with
// "Converting circular structure to JSON".
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
