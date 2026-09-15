# RFC-002 - Escolha do banco de dados gerenciado (PostgreSQL no RDS)

Data: 15/09/2026
Status: Aceita

## Resumo

Migrar o PostgreSQL, que na Fase 2 rodava como `Deployment`/`Service`
dentro do proprio cluster Kind, para uma instancia gerenciada Amazon RDS,
em VPC privada dedicada, provisionada via Terraform no Repositorio 1
(`oficina-db-infrastructure`).

## Motivacao

Rodar o banco de dados como um Pod dentro do cluster Kubernetes tem
problemas conhecidos: sem backup automatico gerenciado, sem patch de
seguranca automatico do engine, acoplamento entre o ciclo de vida do banco
e o ciclo de vida do cluster (destruir o cluster apagaria os dados), e
nenhuma separacao de responsabilidade entre "quem administra o banco" e
"quem administra o compute". A Fase 3 exige explicitamente um banco de
dados gerenciado, independente do cluster de compute.

## Alternativas consideradas

1. **Manter Postgres in-cluster (StatefulSet)**: descartado - nao atende ao
   requisito de banco gerenciado, e reintroduz o acoplamento ciclo de
   vida banco/cluster que a Fase 3 pede para eliminar.
2. **Amazon Aurora PostgreSQL**: mais caro que RDS Postgres padrao (cobranca
   por I/O e por storage distribuido) e com recursos de alta disponibilidade
   avancados que nao sao necessarios para o volume deste projeto. Descartado
   por custo desproporcional ao beneficio no contexto do free tier.
3. **DynamoDB ou outro banco NoSQL gerenciado**: descartado - o dominio (OS,
   clientes, veiculos, itens, relacionamentos) e fortemente relacional, e o
   time ja tinha o schema Prisma/SQL modelado desde a Fase 2 (ADR-006,
   ADR-011), migrar para NoSQL exigiria remodelar o dominio inteiro sem
   ganho claro.
4. **RDS PostgreSQL (escolhida)**: mesma engine ja usada na Fase 2 (zero
   mudanca de schema/queries), com backup automatico, patching gerenciado,
   e dentro do free tier (`db.t3.micro`, single-AZ) para a maior parte do
   uso esperado neste projeto.

## Decisao

Provisionar RDS PostgreSQL 16.4 (`db.t3.micro`, 20GB, single-AZ) em uma VPC
dedicada com subnets privadas, Security Group restrito por CIDR/SG (sem
`0.0.0.0/0` em nenhuma regra), Parameter Group forcando SSL
(`rds.force_ssl=1`), e credenciais publicadas no AWS Systems Manager
Parameter Store (SecureString) em vez de AWS Secrets Manager, para evitar o
custo fixo mensal do Secrets Manager no Repositorio 1 (custo reintroduzido
pontualmente no Repositorio 2, ver ADR correspondente daquele repo).

Ajustes feitos apos descobrir limitacoes reais da conta AWS usada:

- `backup_retention_period` reduzido de 7 para 1 dia -
  `FreeTierRestrictionError` ao tentar valores maiores.
- `multi_az`, Performance Insights e Enhanced Monitoring mantidos
  desligados deliberadamente (custo adicional nao coberto pelo free tier).

## Consequencias

- Positivas: zero mudanca de schema/ORM em relacao a Fase 2; backup e
  patching geridos pela AWS; banco desacoplado do ciclo de vida do cluster
  EKS (Repositorio 3) e da Lambda (Repositorio 2), ambos acessando via
  Security Group dedicado.
- Negativas: `db.t3.micro` tem recursos limitados (2 vCPU compartilhada,
  1GB RAM) - adequado para o volume deste projeto, mas exigiria upgrade de
  classe de instancia para uso com carga real de producao.
- Trade-off aceito: sem alta disponibilidade (single-AZ) e com apenas 1 dia
  de retencao de backup, adequado para um ambiente de estudo/demonstracao,
  nao para producao real.

Relacionado ao PR #fase3-rfc-002
