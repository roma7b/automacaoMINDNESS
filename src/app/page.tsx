import Link from "next/link";
import { PIPELINE_LABELS_PT } from "@/features/leads/labels";
import { countLeadsByPipelineStatus, countLeadsTotal } from "@/features/leads/queries";
import { getMonthToDateSpendUsd } from "@/integrations/openai/client";

export default async function DashboardPage() {
  const [totalLeads, byStatus, spentUsd] = await Promise.all([
    countLeadsTotal(),
    countLeadsByPipelineStatus(),
    getMonthToDateSpendUsd(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Painel — Buscando 1 Milhão</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Banco conectado. Estrutura inicial do CRM.
          </p>
        </div>
        <Link
          href="/leads"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Ver leads
        </Link>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Leads totais" value={totalLeads} />
        <StatCard label="Gasto de IA no mês" value={formatUsd(spentUsd)} />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-neutral-500">
          Leads por etapa do funil
        </h2>
        {byStatus.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">
            Nenhum lead ainda — a descoberta ainda não foi implementada.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-200">
            {byStatus.map((row) => (
              <li
                key={`${row.funnel}-${row.status}`}
                className="flex justify-between py-2 text-sm"
              >
                <span>
                  {PIPELINE_LABELS_PT[row.status] ?? row.status}{" "}
                  <span className="text-neutral-400">
                    ({row.funnel === "customer" ? "clientes" : "afiliados"})
                  </span>
                </span>
                <span className="font-medium">{row.total}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function formatUsd(value: number): string {
  const decimals = value > 0 && value < 0.01 ? 4 : 2;
  return `US$ ${value.toFixed(decimals).replace(".", ",")}`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
