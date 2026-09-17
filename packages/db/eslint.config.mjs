import { baseConfig } from "@gieochu/config/eslint-preset";

export default [...baseConfig, { ignores: ["src/generated/**"] }];
