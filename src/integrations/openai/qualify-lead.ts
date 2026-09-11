import { getBusinessConfig } from "@/lib/business-config";
import { getEnv } from "@/lib/env";
import type { InstagramProfileSnapshot } from "@/features/leads/types";
import { createTrackedResponse } from "./client";

export interface QualificationResult {
  fitsIcp: boolean;
  icpScore: number; // 0..1
  profileType: "store" | "employee" | "owner" | "decision_maker" | "unclear";
  matchedSegment: string | null;
  reasoning: string;
}

const QUALIFICATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    fits_icp: { type: "boolean" },
    icp_score: { type: "number" },
    profile_type: {
      type: "string",
      enum: ["store", "employee", "owner", "decision_maker", "unclear"],
    },
    matched_segment: { type: ["string", "null"] },
    reasoning: { type: "string" },
  },
  required: ["fits_icp", "icp_score", "profile_type", "matched_segment", "reasoning"],
} as const;

export async function qualifyLead(
  profile: InstagramProfileSnapshot,
  leadId?: number,
): Promise<QualificationResult> {
  const config = getBusinessConfig();
  const env = getEnv();

  const instructions = `Você qualifica leads do Instagram para a ${config.company.name}.
Perfil de cliente ideal (ICP):
- Segmentos: ${config.icp.segments.join("; ")}
- Palavras-chave associadas: ${config.icp.keywords.join(", ")}
- Geografia alvo: ${config.icp.geography}

Analise o perfil público do Instagram abaixo e responda apenas com o JSON pedido.
icp_score vai de 0 (não tem nada a ver) a 1 (encaixe perfeito).
profile_type: "store" (perfil de loja/negócio), "employee" (funcionário), "owner" (dono/sócio),
"decision_maker" (quem decide mas não é o dono, ex. gerente), ou "unclear" se não der pra saber.
Seja rigoroso: bio genérica ou sem sinal de operação manual/PME não deve pontuar alto só por estar
na mesma cidade ou nicho.`;

  const input = JSON.stringify({
    username: profile.username,
    full_name: profile.fullName,
    bio: profile.bio,
    category: profile.category,
    followers: profile.followers,
    following: profile.following,
    posts_count: profile.postsCount,
    external_url: profile.externalUrl,
    recent_captions: profile.recentCaptions,
  });

  const response = await createTrackedResponse({
    purpose: "qualify_lead",
    model: env.OPENAI_MODEL_FAST,
    leadId,
    input: {
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "lead_qualification",
          schema: QUALIFICATION_SCHEMA,
          strict: true,
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as {
    fits_icp: boolean;
    icp_score: number;
    profile_type: QualificationResult["profileType"];
    matched_segment: string | null;
    reasoning: string;
  };

  return {
    fitsIcp: parsed.fits_icp,
    icpScore: parsed.icp_score,
    profileType: parsed.profile_type,
    matchedSegment: parsed.matched_segment,
    reasoning: parsed.reasoning,
  };
}
