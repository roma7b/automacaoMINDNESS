export const PIPELINE_LABELS_PT: Record<string, string> = {
  discovered: "Descoberto",
  qualified: "Qualificado",
  contacted: "Abordado",
  replied: "Respondeu",
  interested: "Interessado",
  whatsapp_handoff: "Encaminhado ao WhatsApp",
  registered: "Cadastrado",
  active_customer: "Cliente ativo",
  joined_affiliate_group: "Entrou no grupo",
  active_affiliate: "Afiliado ativo",
  generated_customer: "Gerou cliente",
  closed: "Encerrado",
};

export const CHANNEL_LABELS_PT: Record<string, string> = {
  browser_contact_pending: "Aguardando 1º contato",
  browser_contact_sent: "1ª DM enviada",
  waiting_inbound_reply: "Aguardando resposta",
  api_eligible: "Elegível pra API",
  api_active: "Conversa ativa (API)",
  api_window_closed: "Janela da API fechada",
  human_review_required: "Requer revisão humana",
  do_not_contact: "Não contatar",
  blocked: "Bloqueado",
  completed: "Concluído",
};

export const PROFILE_TYPE_LABELS_PT: Record<string, string> = {
  store: "Loja",
  employee: "Funcionário",
  owner: "Dono(a)",
  decision_maker: "Decisor(a)",
  unclear: "Indefinido",
};

export function formatIcpScore(score: number | null): string {
  if (score === null) return "—";
  return score.toFixed(2);
}
