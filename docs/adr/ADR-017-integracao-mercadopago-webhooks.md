# ADR-017 - Integracao Mercado Pago via webhook, com gateway fake para dev/CI

Data: 04/11/2026
Status: Aceita

## Contexto
O Billing Service precisa processar pagamentos reais de forma assincrona:
o cliente aprova ou recusa a cobranca fora do controle da aplicacao (app do
banco, Pix, cartao), e o resultado so chega depois, via notificacao. O
projeto nao tem acesso a credenciais de produtor real do Mercado Pago em
ambiente de dev/CI, e os testes (unitarios, BDD, E2E) nao podem depender de
uma chamada de rede real a uma API de terceiro.

## Alternativas consideradas
1. **Polling do status do pagamento** (sem webhook): mais simples de
   implementar, mas introduz latencia (intervalo de polling) e custo de
   chamadas repetidas a API do Mercado Pago sem necessidade.
2. **Confiar no corpo do webhook recebido**: mais rapido de implementar,
   mas webhooks sao publicos e falsificaveis - um corpo de requisicao HTTP
   nunca deveria ser tratado como fonte de verdade de que um pagamento foi
   de fato aprovado.
3. **Webhook + consulta ao pagamento real antes de decidir + gateway fake
   para dev/CI (escolhida)**: webhook funciona como *gatilho* de que algo
   mudou, nao como fonte de verdade do resultado.

## Decisao
- **Porta** (`application/ports/mercado-pago-gateway.ts`) com 2
  implementacoes:
  - **Real** (`infraestructure/mercadopago/mercadopago-gateway.service.ts`),
    usando o SDK oficial `mercadopago` v2, ativa quando
    `MERCADOPAGO_ACCESS_TOKEN` esta configurado.
  - **Fake** (`FakeMercadoPagoGateway`), usada por padrao em dev local e
    CI (sem a env var), com status configuravel em runtime - inclusive via
    um seam de teste dedicado (`POST /test/mercadopago/proximo-status`,
    habilitado apenas com `ENABLE_SAGA_E2E_TEST_ENDPOINTS=true`, usado pela
    suite E2E do Saga da Sprint 5).
- **Webhook** (`POST /webhooks/mercadopago`, rota publica):
  1. Valida o header `x-signature` (HMAC-SHA256) usando
     `MERCADOPAGO_WEBHOOK_SECRET`.
  2. **Nunca confia no corpo da notificacao** para decidir o resultado -
     sempre consulta o pagamento real via gateway (`consultarPagamento`)
     antes de aprovar/recusar, mesmo que o corpo do webhook já diga qual é
     o novo status.
  3. Registra TODO webhook recebido em `WebhookLog` (DynamoDB,
     append-only), inclusive com assinatura invalida - auditoria completa
     de notificacoes recebidas, aprovadas ou nao.
- **Resultado do pagamento dispara o Saga**: aprovado -> `PagamentoAprovadoEvent`;
  recusado -> `PagamentoRecusadoEvent` + `CompensarOSEvent` (ver
  SAGA_PATTERN_SPEC.md, Cenario 1).

## Consequencias
- Positivas: resistente a webhooks falsificados (assinatura invalida ou
  corpo divergente do estado real do pagamento nunca aprova nada
  indevidamente); testavel de ponta a ponta sem rede externa, via o
  gateway fake - usado tanto nos testes unitarios/BDD quanto na suite E2E
  real do Saga (Sprint 5); trilha de auditoria completa de notificacoes.
- Negativas: uma chamada de rede extra ao Mercado Pago por webhook
  recebido (a consulta de confirmacao), em vez de confiar direto no corpo -
  aceito como custo necessario de seguranca; o seam de teste
  (`ENABLE_SAGA_E2E_TEST_ENDPOINTS`) so existe para viabilizar simulacao de
  recusa de pagamento sem uma conta de teste do Mercado Pago - fica inerte
  (404) por padrao, mas e uma superficie de codigo que so existe por causa
  de testes.

Relacionado ao PR #fase4-sprint6-1-documentacao
