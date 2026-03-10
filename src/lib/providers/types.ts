import type { LlmProviderName } from "../../types/index.js";

export interface LlmProvider {
  name: LlmProviderName;
  isAvailable(): Promise<boolean>;
  generate(prompt: string): Promise<string | null>;
}
