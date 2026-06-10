import { PieChart } from "lucide-react";
import ProjectSelector from "../../components/ProjectSelector";

export default function GlobalAnalyticsPage() {
  return <ProjectSelector title="Analytics" targetRoute="analytics" icon={<PieChart size={24} />} />;
}
