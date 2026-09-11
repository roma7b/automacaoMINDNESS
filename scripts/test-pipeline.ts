import "dotenv/config";
import { qualifyLead } from "@/integrations/openai/qualify-lead";
import { draftFirstContactMessage } from "@/integrations/openai/draft-message";
import { upsertDiscoveredLead } from "@/features/leads/mutations";
import { getMonthToDateSpendUsd } from "@/integrations/openai/client";
import type { InstagramProfileSnapshot } from "@/features/leads/types";

const SAMPLE_PROFILES: InstagramProfileSnapshot[] = [
  {
    username: "oficina_do_joao_es",
    fullName: "Oficina do João",
    bio: "Oficina mecânica em Vila Velha 🔧 Orçamento no WhatsApp. Atendimento seg-sáb.\nAinda fazemos tudo no caderninho 😅",
    category: "Serviço automotivo",
    followers: 812,
    following: 340,
    postsCount: 96,
    externalUrl: null,
    recentCaptions: [
      "Mais um dia corrido aqui na oficina, perdendo tempo procurando orçamento antigo no caderno 📒",
      "Chegou peça nova! Bora atender a fila de hoje",
    ],
  },
  {
    username: "modacaprichosa.oficial",
    fullName: "Moda Caprichosa",
    bio: "Digital influencer | Parcerias: contato@agencia.com",
    category: "Criador de conteúdo",
    followers: 184000,
    following: 210,
    postsCount: 1420,
    externalUrl: "linktr.ee/modacaprichosa",
    recentCaptions: ["Look do dia ✨", "Sorteio fechado, parabéns às ganhadoras!"],
  },
];

async function main() {
  for (const profile of SAMPLE_PROFILES) {
    console.log(`\n=== @${profile.username} ===`);

    const qualification = await qualifyLead(profile);
    console.log("Qualificação:", qualification);

    const lead = await upsertDiscoveredLead("customer", profile, qualification, "test-pipeline");
    console.log("Lead salvo:", { id: lead.id, status: lead.pipelineStatus });

    if (qualification.fitsIcp) {
      const draft = await draftFirstContactMessage(profile, lead.id);
      console.log("Mensagem sugerida:\n" + draft.message);
      console.log("Referência usada:", draft.referencesProfileDetail);
    } else {
      console.log("Não gerou mensagem — fora do ICP.");
    }
  }

  const spent = await getMonthToDateSpendUsd();
  console.log(`\nGasto acumulado no mês: US$ ${spent.toFixed(4)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
