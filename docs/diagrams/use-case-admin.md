## Administrative Use Cases

```mermaid
flowchart TB
  classDef actor fill:#f9f9f9,stroke:#333,stroke-width:1px,font-weight:bold;
  classDef usecase fill:#eef2ff,stroke:#6366f1,stroke-width:1px;

  Admin([Administrador]):::actor
  Technician([Técnico]):::actor

  UC1[[Gerenciar usuários (criar/editar/remover)]]:::usecase
  UC2[[Resetar senha ou perfil próprio]]:::usecase
  UC3[[Configurar regras do sistema (cores, branding, agenda, domínios)]]:::usecase
  UC4[[Manter regras acadêmicas (períodos, não-letivos)]]:::usecase
  UC5[[Consultar auditoria de ações]]:::usecase
  UC6[[Gerenciar notificações e e-mails]]:::usecase

  Admin --> UC1
  Admin --> UC2
  Admin --> UC3
  Admin --> UC4
  Admin --> UC5
  Admin --> UC6

  Technician --> UC1
  Technician --> UC4
  Technician --> UC5
```
