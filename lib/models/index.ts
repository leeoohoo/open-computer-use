import { FREE_MODELS_IDS } from "../config"
import { bedrockModels } from "./data/bedrock"
import { ModelConfig } from "./types"

// All models are Bedrock models
const STATIC_MODELS: ModelConfig[] = [...bedrockModels]

// Dynamic models cache
let dynamicModelsCache: ModelConfig[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getAllModels(): Promise<ModelConfig[]> {
  const now = Date.now()

  if (dynamicModelsCache && now - lastFetchTime < CACHE_DURATION) {
    return dynamicModelsCache
  }

  dynamicModelsCache = [...STATIC_MODELS]
  lastFetchTime = now
  return dynamicModelsCache
}

export async function getModelsWithAccessFlags(): Promise<ModelConfig[]> {
  const models = await getAllModels()

  const freeModels = models
    .filter((model) => FREE_MODELS_IDS.includes(model.id))
    .map((model) => ({
      ...model,
      accessible: true,
    }))

  const proModels = models
    .filter((model) => !freeModels.map((m) => m.id).includes(model.id))
    .map((model) => ({
      ...model,
      accessible: false,
    }))

  return [...freeModels, ...proModels]
}

export async function getModelsForProvider(
  provider: string
): Promise<ModelConfig[]> {
  const models = STATIC_MODELS

  const providerModels = models
    .filter((model) => model.providerId === provider)
    .map((model) => ({
      ...model,
      accessible: true,
    }))

  return providerModels
}

export async function getModelsForUserProviders(
  providers: string[]
): Promise<ModelConfig[]> {
  const providerModels = await Promise.all(
    providers.map((provider) => getModelsForProvider(provider))
  )

  const flatProviderModels = providerModels.flat()

  return flatProviderModels
}

export function getModelInfo(modelId: string): ModelConfig | undefined {
  if (dynamicModelsCache) {
    return dynamicModelsCache.find((model) => model.id === modelId)
  }
  return STATIC_MODELS.find((model) => model.id === modelId)
}

// For backward compatibility
export const MODELS: ModelConfig[] = STATIC_MODELS

export function refreshModelsCache(): void {
  dynamicModelsCache = null
  lastFetchTime = 0
}
