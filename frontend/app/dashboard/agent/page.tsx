import { Cpu } from "lucide-react";
import ProjectSelector from "../../components/ProjectSelector";

export default function GlobalAgentPage() {
  return <ProjectSelector title="Agent" targetRoute="agent" icon={<Cpu size={24} />} />;
}
