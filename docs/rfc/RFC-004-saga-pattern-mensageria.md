# RFC-004 - Saga Pattern coreografado e mensageria serverless (SNS/SQS) para a decomposicao em microsservicos

Data: 27/10/2026
Status: Aceita

## Resumo

Adotar um Saga Pattern **coreografado** (nao orquestrado) para coordenar a
transacao distribuida entre os 3 microsservicos da Fase 4 (OS Service,
Billing Service, Execution Service), usando AWS SNS (topico FIFO) + SQS
(fila FIFO + DLQ por servico) como infraestrutura de mensageria, provisionada
no novo repositorio `oficina-messaging-infra`.

## Motivacao

O monolito atual trata criacao de OS, orcamento/pagamento e execucao do
reparo como uma unica transacao local (tudo dentro de uma `OrdemServico`
no mesmo banco). Ao decompor em 3 servicos com bancos de dados proprios,
essa transacao passa a ser distribuida - nenhum dos 3 servicos pode fazer
um commit/rollback atomico que abranja os outros dois. Um Saga Pattern e
necessario para: (a) definir a sequencia de passos que leva a transacao ao
estado final consistente (fluxo feliz), e (b) definir como desfazer
(compensar) passos ja executados quando uma etapa posterior falha (ex:
pagamento recusado depois do orcamento gerado).

## Alternativas consideradas

1. **Saga Orquestrado (um 4º servico coordenador)**: mais facil de
   auditar (estado da transacao centralizado num unico lugar, maquina de
   estados explicita), mas exige criar, hospedar e manter um servico
   adicional so para coordenacao - custo e complexidade desproporcionais
   para um fluxo majoritariamente linear com um unico ponto de ramificacao
   real (pagamento aprovado vs. recusado).
2. **RabbitMQ auto-hospedado no cluster EKS**: descartado por custo - o
   cluster EKS da Fase 3 foi destruido justamente para eliminar o custo
   fixo de um node rodando 24/7; hospedar um broker proprio reintroduziria
   exatamente esse custo so para a mensageria.
3. **Saga Coreografado com AWS SNS+SQS (escolhida)**: cada servico publica
   um evento ao concluir sua etapa e reage a eventos de outros servicos via
   filas proprias, sem coordenador central. Mensageria serverless (SNS+SQS)
   nao tem custo ocioso - so cobra por mensagem publicada/entregue,
   consistente com a logica de custo ja aplicada em toda a Fase 3.

## Decisao

1. **1 topico SNS FIFO** (`oficina-saga-events.fifo`) para todos os 7
   tipos de evento do Saga - evita criar um topico por evento. FIFO (nao
   *standard*) com `MessageGroupId = ordemServicoId` garante ordem de
   entrega por Ordem de Servico, essencial no Saga (ex:
   `ExecucaoIniciadaEvent` nao pode ser processado antes de
   `PagamentoAprovadoEvent` por causa de retry/entrega fora de ordem).
2. **1 fila SQS FIFO + 1 DLQ por servico consumidor** (os-service,
   billing-service, execution-service), cada uma inscrita no topico com
   uma *filter policy* por atributo de mensagem `eventType` - cada servico
   so recebe os eventos que realmente consome.
3. **`raw_message_delivery = true`** nas subscriptions: a mensagem entregue
   na fila e o JSON do evento puro (o proprio evento ja carrega seu
   envelope, `SagaEventEnvelope`), sem o wrapping adicional do SNS.
4. **Isolamento de credenciais por servico**: 3 IAM policies autonomas
   (`aws_iam_policy`, nao roles, ja que os repositorios dos 3 servicos
   ainda nao existem nesta sprint) - cada uma so com `sns:Publish` no
   topico e `sqs:ReceiveMessage`/`DeleteMessage`/`GetQueueAttributes` na
   propria fila. Quando os repositorios de servico forem criados, suas IAM
   Roles de CI/runtime so precisam dar `attach` na policy correspondente.
5. **Contratos versionados** (TypeScript + JSON Schema draft-07) em
   `oficina-messaging-infra/contracts/`, com campo `eventVersion` no
   envelope para suportar evolucao de schema sem quebrar consumidores em
   produção.
6. **`CompensarOSEvent` como evento de compensacao generico**: em vez de um
   evento especifico por tipo de falha, qualquer servico que detecte uma
   falha downstream publica `CompensarOSEvent` com um campo `origemFalha`
   (`"PAGAMENTO"` ou `"EXECUCAO"`) - os consumidores decidem a acao com base
   nesse campo, sem precisar conhecer todos os tipos de falha possiveis dos
   outros servicos.

## Consequencias

- Positivas: nenhum custo ocioso de infraestrutura de mensageria (SNS/SQS
  serverless); acoplamento minimo entre os futuros servicos (so via
  contrato de evento, nunca chamada direta); ordem de entrega garantida por
  OS (FIFO) mesmo com multiplos consumidores concorrentes.
- Negativas: debugar uma saga coreografada exige correlacionar eventos
  espalhados entre os logs/filas dos 3 servicos (nao ha um unico lugar
  central mostrando "em que passo a saga X esta agora") - mitigado por
  `correlationId = ordemServicoId` em todo evento, permitindo filtrar logs
  por OS especifica.
- Pendencia conhecida: os 3 repositorios de servico (`oficina-os-service`,
  `oficina-billing-service`, `oficina-execution-service`) ainda nao
  existem - as IAM policies criadas nesta sprint ficam sem nenhuma role
  anexada até a proxima sprint, quando os repositorios forem criados e
  passarem a consumir os contratos de `oficina-messaging-infra/contracts/`.

Relacionado ao PR #fase4-rfc-004
