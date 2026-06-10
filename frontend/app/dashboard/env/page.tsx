import { Variable } from "lucide-react";
import ProjectSelector from "../../components/ProjectSelector";

export default function GlobalEnvPage() {
  return <ProjectSelector title="Environment Variables" targetRoute="env" icon={<Variable size={24} />} />;
}
