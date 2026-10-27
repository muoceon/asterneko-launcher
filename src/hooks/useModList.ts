import { useState, useMemo } from "react"

export interface ModItem {
  slug: string
  title: string
  description: string
  author: string
  iconUrl: string
  downloads: number
  followers: number
  categories: string[]
  mcVersions: string[]
  loader: "forge" | "fabric" | "neoforge" | "quilt" | "any"
}

const MOCK_MODS: ModItem[] = [
  {
    slug: "sodium",
    title: "Sodium",
    description: "Minecraft 优化渲染引擎，大幅提升帧率",
    author: "jellysquid3",
    iconUrl: "",
    downloads: 12_500_000,
    followers: 5_200,
    categories: ["optimization", "fabric"],
    mcVersions: ["1.21.4", "1.21.1", "1.20.4", "1.20.1"],
    loader: "fabric",
  },
  {
    slug: "iris",
    title: "Iris Shaders",
    description: "光影加载器模组，兼容 OptiFine 光影包",
    author: "coderbot",
    iconUrl: "",
    downloads: 9_800_000,
    followers: 4_800,
    categories: ["shaders", "fabric"],
    mcVersions: ["1.21.4", "1.21.1", "1.20.4"],
    loader: "fabric",
  },
  {
    slug: "fabric-api",
    title: "Fabric API",
    description: "Fabric 模组加载器的核心 API 库",
    author: "modmuss50",
    iconUrl: "",
    downloads: 22_000_000,
    followers: 6_100,
    categories: ["library", "fabric"],
    mcVersions: ["1.21.4", "1.21.1", "1.20.6", "1.20.4"],
    loader: "fabric",
  },
  {
    slug: "jei",
    title: "Just Enough Items",
    description: "物品配方查看器，合成指南",
    author: "mezz",
    iconUrl: "",
    downloads: 18_000_000,
    followers: 5_500,
    categories: ["utility", "fabric", "forge", "neoforge"],
    mcVersions: ["1.21.4", "1.21.1", "1.20.4"],
    loader: "any",
  },
  {
    slug: "journeymap",
    title: "JourneyMap",
    description: "实时小地图与全屏大地图",
    author: "techbrew",
    iconUrl: "",
    downloads: 15_000_000,
    followers: 4_200,
    categories: ["map", "fabric", "forge"],
    mcVersions: ["1.21.1", "1.20.4", "1.20.1"],
    loader: "any",
  },
  {
    slug: "lithium",
    title: "Lithium",
    description: "通用优化模组，优化服务端/客户端逻辑",
    author: "jellysquid3",
    iconUrl: "",
    downloads: 8_500_000,
    followers: 3_800,
    categories: ["optimization", "fabric"],
    mcVersions: ["1.21.4", "1.21.1", "1.20.4"],
    loader: "fabric",
  },
  {
    slug: "phosphor",
    title: "Phosphor",
    description: "光照引擎优化，加速区块加载",
    author: "jellysquid3",
    iconUrl: "",
    downloads: 7_200_000,
    followers: 3_500,
    categories: ["optimization", "fabric"],
    mcVersions: ["1.21.1", "1.20.4", "1.20.1"],
    loader: "fabric",
  },
  {
    slug: "create",
    title: "Create",
    description: "机械动力，以齿轮和传送带为核心的科技模组",
    author: "simibubi",
    iconUrl: "",
    downloads: 16_000_000,
    followers: 7_200,
    categories: ["technology", "forge", "fabric"],
    mcVersions: ["1.20.1", "1.19.4"],
    loader: "any",
  },
  {
    slug: "xaeros-minimap",
    title: "Xaero's Minimap",
    description: "简洁实用的迷你小地图",
    author: "xaero96",
    iconUrl: "",
    downloads: 14_000_000,
    followers: 4_500,
    categories: ["map", "fabric", "forge"],
    mcVersions: ["1.21.4", "1.21.1", "1.20.4"],
    loader: "any",
  },
]

export type ModLoader = "all" | "forge" | "fabric" | "neoforge" | "quilt"

export function useModList() {
  const [loader, setLoader] = useState<ModLoader>("all")
  const [mcVersion, setMcVersion] = useState("1.21.1")
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    let list = MOCK_MODS

    if (loader !== "all") {
      list = list.filter(
        (m) => m.loader === loader || m.loader === "any",
      )
    }

    if (mcVersion) {
      list = list.filter((m) => m.mcVersions.includes(mcVersion))
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.author.toLowerCase().includes(q),
      )
    }

    return list
  }, [loader, mcVersion, search])

  return {
    mods: filtered,
    loader,
    setLoader,
    mcVersion,
    setMcVersion,
    search,
    setSearch,
  }
}

export function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}