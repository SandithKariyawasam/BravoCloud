import { List } from "lucide-react";
import ProjectSelector from "../../components/ProjectSelector";

export default function GlobalLogsPage() {
  return <ProjectSelector title="Logs" targetRoute="logs" icon={<List size={24} />} />;
}
