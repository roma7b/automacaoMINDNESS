# Buscando 1 Milhão — Mindness

Sistema de prospecção autônoma no Instagram pra Mindness: descoberta de leads por hashtag, qualificação por IA, primeira DM automática pelo Chrome do operador, e um copiloto que lê respostas e sugere o que responder — sem enviar nada sozinho depois da primeira mensagem.

Ver [PROMPT.md](PROMPT.md) (spec original) e o histórico de commits pra entender as decisões (bastante coisa mudou do plano original testando contra o Instagram real — ver mensagens de commit, elas documentam cada bug achado ao vivo).

## Arquitetura, resumida

1. **Descoberta** (`discover_hashtag`): varre uma hashtag, extrai perfis, qualifica cada um contra o ICP em `config/business.json` via OpenAI.
2. **Primeiro contato** (`browser_first_contact`): pra leads qualificados, gera e envia a 1ª DM pelo Chrome real logado do operador. Sempre em dry-run a menos que `dryRun:false` explícito.
3. **Copiloto de resposta** (`check_inbox`): não envia nada — só lê a conversa periodicamente, detecta resposta nova, e sugere o que responder no painel (`/leads/[id]`). Você sempre envia manualmente.

**Por quê não tem envio automático da conversa inteira**: decisão consciente, não é limitação técnica. Automatizar a conversa inteira é sinal de bot muito mais forte que uma DM de abertura isolada, e integrar a API oficial da Meta exigiria App Review + Verificação de Empresa (dias a semanas de espera). Ver commits de 2026-09-14 pra mais contexto.

## Rodando do zero (depois de reinstalar Windows, trocar de PC, etc.)

```bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env                                    # preencha as chaves reais
cp config/business.example.json config/business.json    # preencha os dados reais da Mindness
pnpm run db:migrate
```

**Isso só funciona se você copiou a pasta inteira do projeto** (não só o que tá no GitHub) — `.env`, `config/business.json`, `data/app.db` (o banco com todos os leads e conversas) e `.chrome-profile/` (sessão logada do Instagram) estão todos no `.gitignore` de propósito, só existem localmente. Sem eles, dá pra reconstruir o código do zero mas **perde todo o histórico de leads e precisa logar no Instagram de novo**.

## Uso do dia a dia

Isso é rodado manualmente, de propósito — dá controle sobre quando o sistema (e o gasto de IA) está ativo. Toda sessão nova precisa:

```bash
# 1. Chrome com o perfil dedicado (sessão do Instagram já fica salva em .chrome-profile/)
# Windows PowerShell:
Start-Process "C:\Program Files\Google\Chrome\Application\chrome.exe" -ArgumentList "--remote-debugging-port=9222","--remote-debugging-address=127.0.0.1","--user-data-dir=`"$PWD\.chrome-profile`""

# 2. Painel (opcional, pra ver o CRM)
pnpm dev   # abre http://localhost:3000/leads

# 3. Worker (processa a fila de jobs — descoberta, envio, checagem de resposta)
pnpm run worker
```

## Scripts úteis

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe o painel Next.js (`/leads` é a lista de leads) |
| `pnpm run worker` | Processa a fila de jobs |
| `pnpm run discover <hashtag> [maxNewLeads] [maxPosts]` | Enfileira uma busca de descoberta |
| `pnpm run first-contact <leadId> [--send]` | Enfileira o 1º contato (sem `--send` é dry-run) |
| `pnpm run db:studio` | Abre o Drizzle Studio pra inspecionar o banco |
| `pnpm run typecheck` / `pnpm run lint` / `pnpm run test` | Verificações |

## Status (2026-09-16)

- 45 leads descobertos, 14 qualificados/contatados
- 6 primeiras DMs enviadas de verdade, nenhuma resposta ainda
- Copiloto de resposta rodando (leitura a cada ~20min, nunca envia sozinho)
- Sem integração com WhatsApp ainda (cogitado usar assinatura existente do Datafy)
