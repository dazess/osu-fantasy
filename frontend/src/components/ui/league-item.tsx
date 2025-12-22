"use client"

import { Card, CardContent } from "@/components/ui/card"


interface LeagueItemProps {
  leagueName: string
  onClick?: () => void
}

export function LeagueItem({ leagueName, onClick }: LeagueItemProps) {
  const handleClick = () => {
    console.log("[v0] League clicked:", leagueName)
    if (onClick) {
      onClick()
    } else {
      // Default behavior: navigate or show details
      alert(`Navigating to ${leagueName}`)
    }
  }

  return (
    <div className="fixed top-0 right-0 p-4 bg-[#302E38]" >
      <Card
        className="w-[300px] h-[100px] cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-[#302E38]"
        onClick={handleClick}
      >
        <CardContent className="flex items-center gap-4 p-6 h-full">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-foreground">{leagueName}</h3>
        
          </div>
          <div className="flex size-32 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
            {/* 128x128 image placeholder */}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}