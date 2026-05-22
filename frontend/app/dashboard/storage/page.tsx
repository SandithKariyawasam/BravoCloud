import { Database } from "lucide-react";
import ProjectSelector from "../../components/ProjectSelector";

export default function GlobalStoragePage() {
  return <ProjectSelector title="Storage" targetRoute="storage" icon={<Database size={24} />} />;
}
