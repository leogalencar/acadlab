## Cancelar Reserva

```mermaid
sequenceDiagram
  participant Actor as Autor/Administrador/Técnico
  participant UI as ReservationHistory
  participant Action as cancelReservationAction
  participant DB as Prisma DB
  participant Notif as NotificationTriggers

  Actor->>UI: Solicita cancelamento com motivo opcional
  UI->>Action: submit cancelReservation
  Action->>Action: validar payload e permissão
  Action->>DB: prisma.reservation.findUnique
  alt Reserva existente e pendente/confirmada
    Action->>DB: update status=CANCELLED, set cancelledAt, reason
    Action->>Notif: notifyReservationCancelled(user + affected)
    Action-->>UI: {status: success}
  else Reserva inválida
    Action-->>UI: {status: error}
  end
```
