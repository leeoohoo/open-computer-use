import type { Provider, SupportedModel } from "./types"

export function getProviderForModel(model: SupportedModel): Provider {
  return "bedrock"
}
