import { GitMerge } from "lucide-react";
import ProjectSelector from "../../components/ProjectSelector";

export default function GlobalWorkflowsPage() {
  return <ProjectSelector title="Workflows" targetRoute="workflows" icon={<GitMerge size={24} />} />;
}
