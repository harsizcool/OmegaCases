"use client"

import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts"

interface Props {
  data: { date: string; price: number }[]
  color?: string
}

export default function SalesPriceChart({ data, color = "#1976d2" }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} width={50} />
        <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, "Price"]} />
        <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
