import fetch from 'node-fetch';

async function run() {
    const res = await fetch('https://api.github.com/repos/SandithKariyawasam/BravoCloud/actions/runs');
    const data = await res.json() as any;
    data.workflow_runs.slice(0, 3).forEach((r: any) => {
        console.log(`Run ${r.id}: status=${r.status}, conclusion=${r.conclusion}, name=${r.name}, updated=${r.updated_at}`);
    });
}
run();
