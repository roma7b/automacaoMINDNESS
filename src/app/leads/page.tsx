import Link from "next/link";
import {
  CHANNEL_LABELS_PT,
  formatIcpScore,
  PIPELINE_LABELS_PT,
  PROFILE_TYPE_LABELS_PT,
} from "@/features/leads/labels";
import { listLeads } from "@/features/leads/queries";

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leads</h1>
          <p className="mt-1 text-sm text-neutral-500">{leads.length} lead(s) no total</p>
        </div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Painel
        </Link>
      </div>

      {leads.length === 0 ? (
        <p className="mt-8 text-sm text-neutral-400">
          Nenhum lead ainda. Rode <code>pnpm run discover &lt;hashtag&gt;</code> pra começar.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3">Instagram</th>
                <th className="px-4 py-3">Funil</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Etapa</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      @{lead.instagramUsername}
                    </Link>
                    {lead.hasSuggestion && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        sugestão pendente
                      </span>
                    )}
                    {lead.doNotContact && (
                      <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                        não contatar
                      </span>
                    )}
                    <div className="max-w-xs truncate text-xs text-neutral-400">{lead.bio}</div>
                  </td>
                  <td className="px-4 py-3">{lead.funnel === "customer" ? "Cliente" : "Afiliado"}</td>
                  <td className="px-4 py-3 font-mono">{formatIcpScore(lead.icpScore)}</td>
                  <td className="px-4 py-3">
                    {lead.profileType ? (PROFILE_TYPE_LABELS_PT[lead.profileType] ?? lead.profileType) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {PIPELINE_LABELS_PT[lead.pipelineStatus] ?? lead.pipelineStatus}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">
                    {CHANNEL_LABELS_PT[lead.channelStatus] ?? lead.channelStatus}
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{lead.source ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
