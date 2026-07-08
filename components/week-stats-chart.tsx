'use client'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieChart, Pie, Cell, Label } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface WeekStatsChartProps {
  wins: number
  losses: number
  pushes: number
  pending: number
}

export function WeekStatsChart({ wins, losses, pushes, pending }: WeekStatsChartProps) {
  const chartData = [
    { name: 'Wins', value: wins, fill: '#00D9FF' },
    { name: 'Losses', value: losses, fill: '#FF69B4' },
    ...(pushes > 0 ? [{ name: 'Pushes', value: pushes, fill: '#9CA3AF' }] : []),
    ...(pending > 0 ? [{ name: 'Pending', value: pending, fill: '#6B7280' }] : []),
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
      color: '#9CA3AF',
    },
    pending: {
      label: 'Pending',
      color: '#6B7280',
    },
  }

  const completedLegs = wins + losses + pushes
  const winPercentage = completedLegs > 0 ? (wins / completedLegs) * 100 : 0

  // Determine win percentage color based on performance
  // 70%+ = green (excellent), 55-69% = blue (good), 40-54% = cyan (okay), <40% = pink (poor)
  const getWinPercentageColor = (rate: number) => {
    if (rate >= 70) return '#39FF14' // neon-green
    if (rate >= 55) return '#00D9FF' // neon-blue
    if (rate >= 40) return '#00CED1' // dark-cyan
    return '#FF69B4' // neon-pink
  }

  const winPercentageColor = getWinPercentageColor(winPercentage)

  return (
    <div className="glass-card p-4 flex flex-col">
      <p className="text-xs text-muted-foreground mb-3">This Week</p>
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
                            fill={winPercentageColor}
                          >
                            {completedLegs > 0 ? `${winPercentage.toFixed(0)}%` : '0%'}
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
        <div className="flex items-center justify-center gap-4 mt-4 flex-wrap">
          <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#00D9FF' }}>
            <TrendingUp className="h-4 w-4" />
            {wins} Wins
          </span>
          <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#FF69B4' }}>
            <TrendingDown className="h-4 w-4" />
            {losses} Losses
          </span>
          {pushes > 0 && (
            <span className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
              {pushes} Pushes
            </span>
          )}
          {pending > 0 && (
            <span className="text-sm font-medium" style={{ color: '#6B7280' }}>
              {pending} Pending
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
