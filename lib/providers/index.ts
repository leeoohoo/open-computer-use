export type Provider = {
  id: string
  name: string
  available: boolean
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

// Single Bedrock provider — individual model icons are handled via ModelConfig.icon
export const PROVIDERS: Provider[] = [
  {
    id: "bedrock",
    name: "Amazon Bedrock",
    available: true,
    icon: () => null,
  },
]
