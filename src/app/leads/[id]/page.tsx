import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import {
  CHANNEL_LABELS_PT,
  formatIcpScore,
  PIPELINE_LABELS_PT,
  PROFILE_TYPE_LABELS_PT,
} from "@/features/leads/labels";
import { getLeadById } from "@/features/leads/queries";
import type { InstagramProfileSnapshot } from "@/features/leads/types";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadById(Number(id));
  if (!lead) notFound();

  const profile = lead.profileSnapshot as InstagramProfileSnapshot | null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/leads" className="text-sm text-neutral-500 hover:underline">
        ← Leads
      </Link>

      <div className="mt-2 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">@{lead.instagramUsername}</h1>
        <a
          href={`https://www.instagram.com/${lead.instagramUsername}/`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-blue-600 hover:underline"
        >
          ver no Instagram ↗
        </a>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Score ICP" value={formatIcpScore(lead.icpScore)} />
        <Field
          label="Tipo de perfil"
          value={lead.profileType ? (PROFILE_TYPE_LABELS_PT[lead.profileType] ?? lead.profileType) : "—"}
        />
        <Field label="Etapa" value={PIPELINE_LABELS_PT[lead.pipelineStatus] ?? lead.pipelineStatus} />
        <Field label="Canal" value={CHANNEL_LABELS_PT[lead.channelStatus] ?? lead.channelStatus} />
      </div>

      {lead.doNotContact && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Este perfil está marcado como <strong>não contatar</strong>
          {lead.doNotContactReason ? `: ${lead.doNotContactReason}` : "."}
        </div>
      )}

      <Section title="Bio">
        <p className="whitespace-pre-line text-sm text-neutral-700">{profile?.bio || "(vazia)"}</p>
      </Section>

      <Section title="Motivo da qualificação (IA)">
        <p className="text-sm text-neutral-700">{lead.icpReasoning || "—"}</p>
      </Section>

      {profile && profile.recentCaptions.length > 0 && (
        <Section title="Legendas recentes capturadas">
          <ul className="list-disc space-y-2 pl-5 text-sm text-neutral-600">
            {profile.recentCaptions.map((caption, i) => (
              <li key={i} className="whitespace-pre-line">
                {caption}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Dados do perfil">
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Field label="Seguidores" value={profile?.followers?.toLocaleString("pt-BR") ?? "—"} />
          <Field label="Seguindo" value={profile?.following?.toLocaleString("pt-BR") ?? "—"} />
          <Field label="Publicações" value={profile?.postsCount?.toLocaleString("pt-BR") ?? "—"} />
        </dl>
      </Section>

      <Section title="Origem">
        <p className="text-sm text-neutral-600">
          {lead.source ?? "—"} · descoberto em{" "}
          {new Date(lead.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        </p>
      </Section>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-neutral-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-neutral-500">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
