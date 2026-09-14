import { getBusinessConfig } from "@/lib/business-config";
import { getEnv } from "@/lib/env";
import { createTrackedResponse } from "./client";

export type ConversationIntent =
  | "interested"
  | "asked_info"
  | "asked_pricing"
  | "wants_whatsapp"
  | "not_the_owner"
  | "will_forward"
  | "objection"
  | "not_interested"
  | "opt_out"
  | "ambiguous"
  | "needs_human";

export interface ConversationMessage {
  direction: "inbound" | "outbound";
  content: string;
}

export interface ReplySuggestion {
  intent: ConversationIntent;
  suggestedReply: string;
  shouldEscalateToHuman: boolean;
  reasoning: string;
}

const SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: {
      type: "string",
      enum: [
        "interested",
        "asked_info",
        "asked_pricing",
        "wants_whatsapp",
        "not_the_owner",
        "will_forward",
        "objection",
        "not_interested",
        "opt_out",
        "ambiguous",
        "needs_human",
      ],
    },
    suggested_reply: { type: "string" },
    should_escalate_to_human: { type: "boolean" },
    reasoning: { type: "string" },
  },
  required: ["intent", "suggested_reply", "should_escalate_to_human", "reasoning"],
} as const;

/**
 * This is a co-pilot suggestion, not an autonomous send — the operator
 * reviews and sends it manually from the CRM. Still bound by the same
 * claims discipline as the cold-open message.
 */
export async function suggestReply(
  history: ConversationMessage[],
  leadId?: number,
): Promise<ReplySuggestion> {
  const config = getBusinessConfig();
  const env = getEnv();

  const instructions = `Você é o co-piloto de ${config.owner.name} (${config.owner.role} da ${config.company.name})
pra continuar uma conversa no Instagram que ele mesmo vai enviar manualmente — você só sugere, nunca envia.

REGRA ABSOLUTA — só pode afirmar o que está nesta lista (VERIFIED_CLAIMS). Nunca invente taxa, prazo,
condição, garantia ou resultado:
${config.claims.verified.map((c) => `- ${c}`).join("\n")}
Nunca mencione: ${config.claims.unverified.join("; ") || "(nenhuma afirmação bloqueada)"}

Pitch: ${config.offer.onePagePitch}
Como funciona: ${config.offer.howItWorks.join(" → ")}
WhatsApp pra encaminhar quando fizer sentido: ${config.channels.whatsappLink}

Classifique a intenção da última mensagem do lead e sugira a próxima resposta:
- "opt_out": pedido claro de parar — sugestão deve ser só confirmar educadamente que não vai mais contatar,
  nunca insistir.
- "wants_whatsapp" ou "interested" com informação suficiente: sugerir encaminhar pro WhatsApp.
- "asked_pricing": só responder com o que está nas claims verificadas — nunca inventar valor. Se não houver
  claim de preço, marcar should_escalate_to_human e sugerir dizer que vai confirmar e retornar.
- "not_the_owner" ou "will_forward": agradecer e perguntar se pode ajudar a pessoa a encaminhar.
- Qualquer coisa ambígua, uma reclamação, ou fora do que as claims cobrem: should_escalate_to_human = true.

Tom: curto, pessoal, conversa real — nunca parece script de vendas.

Escreva como quem tá digitando rápido no Instagram, não como texto revisado:
- Nunca use travessão (—) ou reticências decorativas. Vírgula ou ponto resolve.
- Sem fechamento redondo demais nem frase de efeito — corta o que soar "de LinkedIn" ou script.
- Pode soltar a formalidade: contração natural, frase mais curta, do jeito que alguém realmente digita no chat.`;

  const input = JSON.stringify(
    history.map((m) => ({ from: m.direction === "inbound" ? "lead" : config.owner.name, text: m.content })),
  );

  const response = await createTrackedResponse({
    purpose: "suggest_reply",
    model: env.OPENAI_MODEL,
    leadId,
    input: {
      instructions,
      input,
      text: {
        format: {
          type: "json_schema",
          name: "reply_suggestion",
          schema: SUGGESTION_SCHEMA,
          strict: true,
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text) as {
    intent: ConversationIntent;
    suggested_reply: string;
    should_escalate_to_human: boolean;
    reasoning: string;
  };

  return {
    intent: parsed.intent,
    suggestedReply: parsed.suggested_reply,
    shouldEscalateToHuman: parsed.should_escalate_to_human,
    reasoning: parsed.reasoning,
  };
}
