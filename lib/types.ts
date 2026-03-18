export type Rarity = "Common" | "Uncommon" | "Rare" | "Legendary" | "Omega"

export interface User {
  id: string
  username: string
  password?: string
  profile_picture: string | null
  balance: number
  admin: boolean
  plus: boolean
  cases: number
  cases_remaining: number
  created_at: string
}

export interface Item {
  id: string
  name: string
  image_url: string
  rarity: Rarity
  likelihood: number
  market_price: number
  rap: number
  limited_time: boolean
  created_at: string
}

export interface InventoryItem {
  id: string
  user_id: string
  item_id: string
  obtained_at: string
  items: Item
}

export interface Listing {
  id: string
  seller_id: string
  item_id: string
  inventory_id: string
  price: number
  status: "active" | "sold" | "cancelled"
  created_at: string
  items: Item
  users: User
}

export interface Sale {
  id: string
  item_id: string
  seller_id: string
  buyer_id: string
  price: number
  sold_at: string
  items: Item
}

export interface Deposit {
  id: string
  user_id: string
  payment_id: string | null
  amount_usd: number | null
  crypto: string | null
  status: "pending" | "confirmed" | "failed"
  created_at: string
}

export interface Withdrawal {
  id: string
  user_id: string
  amount_usd: number
  fee_usd: number
  net_usd: number
  crypto: string
  wallet_address: string
  status: "pending" | "processed" | "rejected"
  created_at: string
}

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: "#9e9e9e",
  Uncommon: "#4caf50",
  Rare: "#2196f3",
  Legendary: "#ff9800",
  Omega: "#f44336",
}

export const RARITY_GLOW: Record<Rarity, string> = {
  Common: "0 0 8px #9e9e9e88",
  Uncommon: "0 0 12px #4caf5088",
  Rare: "0 0 16px #2196f388",
  Legendary: "0 0 20px #ff980088",
  Omega: "0 0 24px #f4433688",
}

export type CasePrice = { qty: number; price: number }

export const CASE_PRICES: CasePrice[] = [
  { qty: 10, price: 0.39 },
  { qty: 100, price: 2.99 },
  { qty: 1000, price: 9.99 },
]

// Only these rarities count toward inventory value
export const VALUE_RARITIES: Rarity[] = ["Legendary", "Omega"]

export const ACCEPTED_CRYPTOS = ["BTC", "LTC", "SOL", "BCH"]
