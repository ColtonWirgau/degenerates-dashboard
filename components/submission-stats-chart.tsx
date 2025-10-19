'use client'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { PieChart, Pie, Cell, Label } from 'recharts'
import { CheckCircle, Clock } from 'lucide-react'

type SubmissionStatsChartProps = {
  submitted: number
  notSubmitted: number
  total: number
}

export function SubmissionStatsChart({ submitted, notSubmitted, total }: SubmissionStatsChartProps) {
  const chartData = [
    { name: 'Submitted', value: submitted, fill: '#00D9FF' },
    { name: 'Pending', value: notSubmitted, fill: '#FF69B4' },
  ]

  const chartConfig = {
    submitted: {
      label: 'Submitted',
      color: '#00D9FF',
    },
    pending: {
      label: 'Pending',
      color: '#FF69B4',
    },
  }

  const submittedPercent = total > 0 ? (submitted / total) * 100 : 0

  return (
    <div className="glass-card p-4 flex flex-col h-full">
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
                            fill="#00D9FF"
                          >
                            {total > 0 ? `${submittedPercent.toFixed(0)}%` : '0%'}
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
            <CheckCircle className="h-4 w-4" />
            {submitted} Submitted
          </span>
          <span className="text-sm font-medium flex items-center gap-1" style={{ color: '#FF69B4' }}>
            <Clock className="h-4 w-4" />
            {notSubmitted} Pending
          </span>
        </div>
      </div>
    </div>
  )
}
