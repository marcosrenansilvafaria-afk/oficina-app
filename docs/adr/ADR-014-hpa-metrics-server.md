# ADR-014 - Uso de HPA com Metrics Server para resiliencia na nuvem

Data: 15/09/2026
Status: Aceita

## Contexto
O `HorizontalPodAutoscaler` (`autoscaling/v2`) ja estava modelado desde a
Fase 2 (`minReplicas: 2`, `maxReplicas: 5`, metas de 60% CPU / 70% memoria),
rodando sobre o Metrics Server instalado no cluster Kind local. Na Fase 3,
o EKS (Repositorio 3) e um cluster gerenciado novo, sem nenhum addon de
metricas por padrao - o HPA nao funciona sem uma fonte de metricas de
CPU/memoria por Pod.

## Decisao
- Instalar o Metrics Server via `helm_release` no proprio Terraform do
  Repositorio 3 (nao e um addon gerenciado nativo do EKS, ao contrario de
  `coredns`/`kube-proxy`/`vpc-cni`), como parte do mesmo `terraform apply`
  que cria o cluster.
- Reaproveitar o manifesto `HorizontalPodAutoscaler` da Fase 2 **sem
  nenhuma alteracao** no Repositorio 4 - mesmos limites, mesmo
  comportamento de scale up/down.
- Node group dimensionado (`t3.small`, min 1/max 2) considerando o teto de
  5 replicas do HPA e o request de 100m CPU / 128Mi por Pod.

## Consequencias
- Positivas: comportamento de autoscaling identico ao validado na Fase 2,
  sem retrabalho de tuning de thresholds; a mesma definicao de HPA serve
  tanto para Kind (Fase 2) quanto para EKS (Fase 3).
- Negativas: Metrics Server e mais um componente com ciclo de vida proprio
  dentro do Terraform do cluster (Repositorio 3) - se o `helm_release`
  falhar, o HPA fica sem fonte de metricas silenciosamente (mostra
  `<unknown>` no `kubectl get hpa`) ate o proximo apply corrigir.
- Descoberta na pratica: o provider `helm`/`kubernetes` autentica no
  cluster usando um token calculado uma unica vez no inicio do processo do
  `terraform apply` - criar o Access Entry de acesso ao cluster e tentar
  instalar o Metrics Server no MESMO apply falha ("the server has asked for
  the client to provide credentials"), exigindo dividir o apply em duas
  fases (cluster + Access Entries primeiro, addons depois), documentado no
  workflow do Repositorio 3.

Relacionado ao PR #fase3-adr-014
