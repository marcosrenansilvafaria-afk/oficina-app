# ADR-016 - Database-per-Service hibrido (SQL + NoSQL)

Data: 03/11/2026
Status: Aceita

## Contexto
A decomposicao em 3 microsservicos (RFC-004) exige que cada servico seja
dono exclusivo dos seus dados - nenhum outro servico pode acessar o banco
de outro diretamente, mesmo que a instancia de infraestrutura seja
compartilhada por custo (AWS Academy). Cada um dos 3 servicos tem um
padrao de acesso a dados fundamentalmente diferente:

- **OS Service**: dominio relacional classico (Cliente, Veiculo,
  OrdemServico, ItemOrdemServico, historico de status), com integridade
  referencial e `JOIN`s usados diretamente em queries de negocio (ver
  [modelo de dados](../modelo-dados.md)).
- **Execution Service**: tambem relacional, porem com um schema muito mais
  simples (so `Execucao` + `HistoricoIntervencao`), sem necessidade de
  catalogos ou entidades externas.
- **Billing Service**: acesso quase sempre por chave (orcamento/pagamento
  de UMA ordem de servico por vez) ou por `ordemServicoId`/`mercadoPagoPaymentId`,
  sem necessidade de `JOIN`s entre entidades - padrao de acesso tipico de
  chave-valor.

## Alternativas consideradas
1. **PostgreSQL para os 3 servicos** (uniformidade de stack): mais simples
   operacionalmente (1 unico tipo de banco a manter/monitorar), mas
   subutiliza a RDS no caso do Billing Service, cujo padrao de acesso nao
   precisa de relacional nenhum, e paga o custo de modelar FKs/joins para
   um dominio que e naturalmente chave-valor.
2. **DynamoDB para os 3 servicos**: eliminaria a RDS compartilhada, mas o
   OS Service perderia `JOIN`s nativos e integridade referencial - teria
   que reimplementar no código o que o Postgres garante de graca, alem de
   custo de reescrever queries de relatorio (`GET /os/sla-atendimento`)
   que dependem de agregacao relacional.
3. **Database-per-service hibrido (escolhida)**: cada servico usa o banco
   mais adequado ao seu dominio, mantendo isolamento total entre eles.

## Decisao
- **OS Service** e **Execution Service**: PostgreSQL, cada um com um
  **database proprio** dentro da MESMA instancia RDS do Repositorio 1
  (`os_service` e `execution_service`), nao a instancia inteira
  compartilhada - cada um com seu proprio usuario/role, sem permissao de
  acesso ao database do outro (ver `scripts/bootstrap-database.sql` de
  cada repositorio). Prisma 7 + `@prisma/adapter-pg`, consistente com
  ADR-011.
- **Billing Service**: DynamoDB, 3 tabelas exclusivas (`billing-orcamentos`,
  `billing-pagamentos`, `billing-webhook-logs`), modo `PAY_PER_REQUEST`
  (sem custo ocioso - alinhado a decisao de custo de RFC-004 para a
  mensageria). GSIs por `ordemServicoId` e `mercadoPagoPaymentId` cobrem os
  unicos dois padroes de consulta reais do dominio (buscar
  orcamento/pagamento de uma OS; correlacionar um webhook do Mercado Pago a
  um pagamento existente).
- **Isolamento reforcado em 2 camadas**: (1) rede/infra - cada servico
  conecta com credenciais proprias, sem rota de rede para o banco de outro
  servico; (2) codigo - nenhum dos 3 repositorios importa cliente/driver do
  banco de outro servico; toda comunicacao cross-service e via eventos do
  Saga (RFC-004), nunca leitura direta de dados de outro dominio.

## Consequencias
- Positivas: cada dominio usa o modelo de dados que genuinamente precisa,
  sem forcar relacional onde e chave-valor nem o contrario; isolamento de
  dados por servico satisfeito tanto a nivel de infraestrutura quanto de
  codigo; custo controlado (RDS compartilhada entre 2 servicos + DynamoDB
  `PAY_PER_REQUEST` sem custo ocioso para o terceiro).
- Negativas: 2 tecnologias de persistencia distintas a operar/monitorar
  (Postgres + DynamoDB) em vez de uma so; qualquer relatorio que precisasse
  cruzar dados de mais de um servico (ex: "tempo total desde a criacao da
  OS até o pagamento") exige agregacao na camada de aplicacao ou em um
  servico de leitura dedicado, nao um `JOIN` de banco - nao ha esse
  requisito hoje, mas e uma limitacao conhecida do modelo.

Relacionado ao PR #fase4-sprint6-1-documentacao
