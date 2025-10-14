'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieChart, Pie, Cell, Label } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface PerformanceChartProps {
  wins: number
  losses: number
  pushes: number
  winRate: number
}

export function PerformanceChart({ wins, losses, pushes, winRate }: PerformanceChartProps) {
  const chartData = [
    { name: 'Wins', value: wins, fill: '#00D9FF' },
    { name: 'Losses', value: losses, fill: '#FF69B4' },
    ...(pushes > 0 ? [{ name: 'Pushes', value: pushes, fill: '#FFD700' }] : []),
  ]

  const chartConfig = {
    wins: {
      label: 'Wins',
      color: '#00D9FF',
    },
    losses: {
      label: 'Losses',
      color: '#FF69B4',
    },
    pushes: {
      label: 'Pushes',
      color: '#FFD700',
    },
  }

  const total = wins + losses + pushes

  // Determine win rate color based on performance
  // 70%+ = gold (excellent), 55-69% = blue (good), 40-54% = cyan (okay), <40% = pink (poor)
  const getWinRateColor = (rate: number) => {
    if (rate >= 70) return '#FFD700' // gold
    if (rate >= 55) return '#00D9FF' // neon-blue
    if (rate >= 40) return '#00CED1' // dark-cyan
    return '#FF69B4' // neon-pink
  }

  const winRateColor = getWinRateColor(winRate)

  return (
    <div className="glass-card p-4 flex flex-col">
      <p className="text-xs text-muted-foreground mb-3">Win Rate</p>
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <div className="flex items-center justify-center w-full">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[250px] w-[250px]"
          >
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={100}
                strokeWidth={0}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="text-4xl font-bold"
                            fill={winRateColor}
                          >
                            {winRate.toFixed(1)}%
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-4">
          <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#00D9FF' }}>
            <TrendingUp className="h-4 w-4" />
            {wins} Wins
          </span>
          <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#FF69B4' }}>
            <TrendingDown className="h-4 w-4" />
            {losses} Losses
          </span>
          {pushes > 0 && (
            <span className="text-sm font-medium" style={{ color: '#FFD700' }}>
              {pushes} Pushes
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
