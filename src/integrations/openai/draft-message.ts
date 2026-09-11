import { getBusinessConfig } from "@/lib/business-config";
import { getEnv } from "@/lib/env";
import type { InstagramProfileSnapshot } from "@/features/leads/types";
import { createTrackedResponse } from "./client";

const DRAFT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    message: { type: "string" },
    references_profile_detail: { type: "string" },
  },
  required: ["message", "references_profile_detail"],
} as const;

export interface DraftedMessage {
  message: string;
  referencesProfileDetail: string;
}

export async function draftFirstContactMessage(
  profile: InstagramProfileSnapshot,
  leadId?: number,
): Promise<DraftedMessage> {
  const config = getBusinessConfig();
  const env = getEnv();

  const instructions = `Você escreve a primeira mensagem direta (DM) do Instagram em nome de
${config.owner.name}, ${config.owner.role} da ${config.company.name}.

Pitch da empresa: ${config.offer.onePagePitch}

REGRA ABSOLUTA — só pode afirmar o que está nesta lista (VERIFIED_CLAIMS). Nunca invente taxa,
condição, garantia, prazo, resultado financeiro, relação societária ou superlativo fora dela:
${config.claims.verified.map((c) => `- ${c}`).join("\n")}

Nunca mencione nada da lista de não verificadas: ${config.claims.unverified.join("; ") || "(nenhuma)"}

A mensagem deve:
- Ser curta (2-4 frases), pessoal, em português do Brasil, tom de conversa real — não parecer campanha.
- Citar algo REAL e específico do perfil (bio, categoria, ou legenda recente) para provar que não é copiar e colar.
- Nunca fingir ser cliente, nunca usar informação falsa pra puxar resposta.
- Não apresentar preço, agenda ou pedir dados sensíveis nessa primeira mensagem — é só abertura.
- Terminar com uma pergunta aberta e genuína relacionada ao que foi observado no perfil.`;

  const input = JSON.stringify({
    username: profile.username,
    full_name: profile.fullName,
    bio: profile.bio,
    category: profile.category,
    recent_captions: profile.recentCaptions,
  });

  const response = await createTrackedResponse({
    purpose: "draft_message",
    model: env.OPENAI_MODEL,
    leadId,
    input: {
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "first_contact_draft",
          schema: DRAFT_SCHEMA,
          strict: true,
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as {
    message: string;
    references_profile_detail: string;
  };

  return { message: parsed.message, referencesProfileDetail: parsed.references_profile_detail };
}
