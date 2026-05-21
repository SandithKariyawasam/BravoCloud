import { Gauge } from "lucide-react";
import ProjectSelector from "../../components/ProjectSelector";

export default function GlobalSpeedInsightsPage() {
  return <ProjectSelector title="Speed Insights" targetRoute="speed-insights" icon={<Gauge size={24} />} />;
}
