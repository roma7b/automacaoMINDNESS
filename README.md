# Buscando 1 Milhão

Sistema de prospecção autônoma no Instagram — descoberta, qualificação, primeiro contato via navegador, continuação pela API oficial da Meta, motor de conversação com OpenAI e CRM em PT-BR.

Ver [PROMPT.md](PROMPT.md) (repositório original) para a especificação completa.

## Rodando local

```bash
pnpm install
cp .env.example .env        # preencha as chaves
cp config/business.example.json config/business.json   # preencha os dados reais do negócio
pnpm run db:migrate
pnpm dev
```

Abra http://localhost:3000.

## Scripts

| Comando | O que faz |
|---|---|
| `pnpm dev` | Sobe o painel Next.js |
| `pnpm run db:generate` | Gera migração a partir de `src/db/schema.ts` |
| `pnpm run db:migrate` | Aplica migrações no banco local |
| `pnpm run db:studio` | Abre o Drizzle Studio pra inspecionar o banco |
| `pnpm run worker` | Sobe o worker de jobs (ainda não implementado) |
| `pnpm run typecheck` / `pnpm run lint` / `pnpm run test` | Verificações |

## Status

Em construção — ver progresso no histórico de commits.
