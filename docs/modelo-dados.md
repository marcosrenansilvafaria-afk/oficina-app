# Modelo de Dados — Justificativa e ERD

## Por que PostgreSQL

O dominio da oficina (clientes, veiculos, ordens de servico, itens de
servico/peca, historico de status) e fortemente relacional: toda consulta
relevante do negocio (SLA de atendimento, ordens por status, historico de
transicoes) depende de `JOIN`s entre entidades com integridade referencial
garantida pelo banco. PostgreSQL foi escolhido (ver
[RFC-002](rfc/RFC-002-postgresql-rds.md) e
[ADR-011](adr/ADR-011-Transição-PostgreSQL-Prisma-ORM.md)) por:

- Suporte nativo a chaves estrangeiras, enums e indices — usados
  diretamente no schema (`StatusOrdemServico`, `TipoItem`, `@@index`).
- Maturidade do driver (`pg`) e do adapter usado (`@prisma/adapter-pg`),
  ja validados desde a Fase 2.
- Disponibilidade como serviço gerenciado (RDS) com o mesmo engine, sem
  exigir migração de schema/queries entre fases.

## Diagrama ERD

```mermaid
erDiagram
    CLIENTE ||--o{ ORDEM_SERVICO : possui
    VEICULO ||--o{ ORDEM_SERVICO : "e alvo de"
    ORDEM_SERVICO ||--o{ ITEM_ORDEM_SERVICO : contem
    ORDEM_SERVICO ||--o{ ORDEM_SERVICO_STATUS_HISTORICO : "registra transicoes em"

    CLIENTE {
        string id PK
        string nome
        string documento UK "CPF usado no login via Lambda"
    }

    VEICULO {
        string id PK
        string placa UK
        string modelo
        string marca
        int ano
    }

    SERVICO {
        string id PK
        string nome "catalogo - sem FK direta em ItemOrdemServico"
        float preco
    }

    PECA {
        string id PK
        string nome "catalogo - sem FK direta em ItemOrdemServico"
        float preco
        int estoque
    }

    ORDEM_SERVICO {
        string id PK
        string clienteId FK
        string veiculoId FK
        enum status "RECEBIDA a ENTREGUE"
        float valorTotal
        datetime criadaEm
        datetime finalizadaEm "nullable"
    }

    ITEM_ORDEM_SERVICO {
        string id PK
        string ordemServicoId FK
        enum tipo "SERVICO ou PECA"
        string descricao "copia do catalogo no momento do lancamento"
        float preco
        int quantidade
    }

    ORDEM_SERVICO_STATUS_HISTORICO {
        string id PK
        string ordemServicoId FK
        enum status
        datetime alteradoEm "1 linha por transicao"
    }
```

## Relacionamentos

| Relacionamento | Cardinalidade | Observação |
|---|---|---|
| `Cliente` → `OrdemServico` | 1:N | Um cliente pode ter várias ordens de serviço ao longo do tempo. |
| `Veiculo` → `OrdemServico` | 1:N | Um veículo pode passar por várias ordens de serviço (revisões distintas). |
| `OrdemServico` → `ItemOrdemServico` | 1:N | Itens (peças/serviços) lançados na OS, com `onDelete: Cascade`. |
| `OrdemServico` → `OrdemServicoStatusHistorico` | 1:N | Uma linha por transição de status, com `onDelete: Cascade`. |

`Servico` e `Peca` funcionam como **catálogo** — `ItemOrdemServico` não tem
chave estrangeira para eles, e sim copia `descricao`/`preco` no momento do
lançamento. Essa é uma decisão deliberada (herdada da Fase 2): o preço de
um item já lançado numa OS não deve mudar retroativamente se o preço do
catálogo for atualizado depois.

## Por que a tabela `OrdemServicoStatusHistorico` (Fase 3)

O schema original (Fase 2) só tinha dois timestamps na OS: `criadaEm` e
`finalizadaEm` — suficientes para medir o tempo **total** de atendimento
(usado no endpoint `GET /os/sla-atendimento`, já existente desde a Fase 2),
mas **insuficientes** para medir quanto tempo uma OS passou em cada status
individual (`EM_DIAGNOSTICO`, `AGUARDANDO_APROVACAO`, `EM_EXECUCAO`, etc.) —
métrica explicitamente exigida pelo dashboard de observabilidade da Fase 3
("tempo médio de execução por status").

A tabela `ordens_servico_status_historico` resolve isso registrando **uma
linha por transição de status**, com o timestamp exato da mudança
(`alteradoEm`). A duração de cada status é calculada subtraindo o
`alteradoEm` de uma linha do `alteradoEm` da linha anterior para a mesma
OS — feito em runtime pelo `PrismaHistoricoStatusRepository`, que observa a
duração diretamente no histograma Prometheus
`oficina_ordem_servico_status_duration_seconds` a cada nova transição (ver
[ADR-015](adr/ADR-015-observabilidade-json-logs-metricas.md)).

**Limitação conhecida**: OS criadas antes desta migration (`20260915000000_ordem_servico_status_historico`)
não têm histórico de transições anteriores — receberam, no backfill da
migration, um único evento com o status atual e `alteradoEm = criadaEm`. A
métrica de duração por status só é precisa para transições ocorridas
**depois** do deploy desta mudança.

## Referências

- Schema completo: [`oficina-app/prisma/schema.prisma`](../prisma/schema.prisma)
- Migration da tabela de histórico: [`prisma/migrations/20260915000000_ordem_servico_status_historico/`](../prisma/migrations/20260915000000_ordem_servico_status_historico/migration.sql)
- [RFC-002 — Escolha do PostgreSQL/RDS](rfc/RFC-002-postgresql-rds.md)
- [ADR-011 — Transição PostgreSQL/Prisma ORM](adr/ADR-011-Transição-PostgreSQL-Prisma-ORM.md)
- [ADR-015 — Observabilidade](adr/ADR-015-observabilidade-json-logs-metricas.md)

## Fase 4 — Database-per-service

O modelo acima descreve o schema **do monolito** (`oficina-app`, Fase 2/3).
A partir da Fase 4, 3 microsserviços têm cada um seu próprio banco —
nenhum deles acessa o banco de outro diretamente (ver
[ADR-016](adr/ADR-016-database-per-service-hibrido.md) para a justificativa
completa de por que SQL em 2 serviços e NoSQL no terceiro).

### OS Service — PostgreSQL (database `os_service`)

Mesmo domínio relacional do monolito original, agora isolado em seu
próprio database (mesma instância RDS do Repositório 1, usuário/role
dedicado — ver `oficina-os-service/scripts/bootstrap-database.sql`):

```mermaid
erDiagram
    CLIENTE ||--o{ ORDEM_SERVICO : possui
    VEICULO ||--o{ ORDEM_SERVICO : "e alvo de"
    ORDEM_SERVICO ||--o{ ITEM_ORDEM_SERVICO : contem
    ORDEM_SERVICO ||--o{ ORDEM_SERVICO_STATUS_HISTORICO : "registra transicoes em"

    CLIENTE {
        string id PK
        string nome
        string documento UK
    }
    VEICULO {
        string id PK
        string placa UK
        string modelo
        string marca
        int ano
    }
    ORDEM_SERVICO {
        string id PK
        string clienteId FK "opcional"
        string veiculoId FK "opcional"
        enum status
        float valorTotal
        datetime criadaEm
        datetime finalizadaEm "nullable"
    }
    ITEM_ORDEM_SERVICO {
        string id PK
        string ordemServicoId FK
        enum tipo "SERVICO ou PECA"
        string descricao
        float preco
        int quantidade
    }
    ORDEM_SERVICO_STATUS_HISTORICO {
        string id PK
        string ordemServicoId FK
        enum status
        datetime alteradoEm
    }
```

`clienteId`/`veiculoId` são opcionais (correção aplicada na Sprint 5, ver
[SAGA_PATTERN_SPEC.md](SAGA_PATTERN_SPEC.md#resultado-da-execução-local)) —
uma OS pode ser aberta antes do cadastro completo do cliente/veículo estar
disponível.

### Execution Service — PostgreSQL (database `execution_service`)

Schema deliberadamente mínimo — o único agregado é a Execução em si:

```mermaid
erDiagram
    EXECUCAO ||--o{ HISTORICO_INTERVENCAO : registra

    EXECUCAO {
        string id PK
        string ordemServicoId UK "correlaciona com o OS Service via evento, nao FK"
        enum status "NA_FILA..CANCELADA"
        string mecanicoId "nullable"
        datetime entradaFilaEm
        datetime iniciadaEm "nullable"
        datetime concluidaEm "nullable"
    }
    HISTORICO_INTERVENCAO {
        string id PK
        string execucaoId FK
        enum status
        string observacao "nullable"
        datetime registradoEm
    }
```

`ordemServicoId` não é uma foreign key de banco — é uma referência lógica
preenchida a partir do `PagamentoAprovadoEvent` consumido do Saga; o
Execution Service nunca faz `JOIN` com dados do OS Service.

### Billing Service — DynamoDB (NoSQL)

Sem `JOIN`s: cada tabela é otimizada para os únicos padrões de acesso
reais do domínio (buscar por `ordemServicoId`, ou correlacionar um webhook
a um `mercadoPagoPaymentId`):

```mermaid
erDiagram
    ORCAMENTO {
        string ordemServicoId PK
        float valorTotal
        datetime geradoEm
    }
    PAGAMENTO {
        string id PK
        string ordemServicoId "GSI"
        string mercadoPagoPaymentId "GSI"
        enum status "PENDENTE..REEMBOLSADO"
        datetime criadoEm
    }
    WEBHOOK_LOG {
        string id PK
        string recebidoEm "sort key"
        string corpoBruto "append-only, auditoria"
        boolean assinaturaValida
    }
```

- `billing-orcamentos`: chave primária `ordemServicoId` — 1 orçamento por
  OS, acesso sempre direto por chave.
- `billing-pagamentos`: chave primária `id` (do pagamento), com GSIs em
  `ordemServicoId` (consulta do cliente/app) e `mercadoPagoPaymentId`
  (correlação de webhook).
- `billing-webhook-logs`: append-only — toda notificação recebida, válida
  ou não, para auditoria (ver [ADR-017](adr/ADR-017-integracao-mercadopago-webhooks.md)).

### Referências (Fase 4)

- [ADR-016 — Database-per-service híbrido](adr/ADR-016-database-per-service-hibrido.md)
- [ADR-017 — Integração Mercado Pago via webhook](adr/ADR-017-integracao-mercadopago-webhooks.md)
- [`oficina-os-service/prisma/schema.prisma`](https://github.com/marcosrenansilvafaria-afk/oficina-os-service/blob/main/prisma/schema.prisma)
- [`oficina-execution-service/prisma/schema.prisma`](https://github.com/marcosrenansilvafaria-afk/oficina-execution-service/blob/main/prisma/schema.prisma)
- [`oficina-billing-service/terraform/dynamodb.tf`](https://github.com/marcosrenansilvafaria-afk/oficina-billing-service/blob/main/terraform/dynamodb.tf)
