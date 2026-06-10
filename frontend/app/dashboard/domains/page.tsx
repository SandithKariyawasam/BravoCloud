import { Globe2 } from "lucide-react";
import ProjectSelector from "../../components/ProjectSelector";

export default function GlobalDomainsPage() {
  return <ProjectSelector title="Domains" targetRoute="domains" icon={<Globe2 size={24} />} />;
}
