import { NetworkGraph } from "@/components/analytics/network-graph"
import { Leaderboards } from "@/components/analytics/leaderboards"

export default function AnalyticsPage() {
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <NetworkGraph />
      <Leaderboards />
    </div>
  )
}
