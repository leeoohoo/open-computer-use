import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock"
import type { LanguageModelV1 } from "@ai-sdk/provider"

export function openproviders(
  modelId: string,
  settings?: Record<string, unknown>,
  apiKey?: string
): LanguageModelV1 {
  const bedrock = createAmazonBedrock({
    region: process.env.AWS_REGION || "us-east-1",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  })

  return bedrock(modelId, settings)
}
