## Criar Reserva / Recorrência

```mermaid
sequenceDiagram
  participant Actor as Professor/Técnico/Admin
  participant UI as SchedulingBoard UI
  participant Action as createReservationAction
  participant Rules as getSystemRules
  participant Utils as SchedulingUtils
  participant DB as Prisma DB
  participant Notif as NotificationTriggers

  Actor->>UI: Seleciona laboratório, data e slots
  UI->>Action: submit formData
  Action->>Action: validar payload (zod)
  Action->>DB: prisma.laboratory.findUnique
  Action->>Rules: carregar regras (timeZone, períodos, nonTeachingDays)
  Action->>DB: getReservationsForDay
  Action->>Utils: buildDailySchedule + verificar conflitos
  alt Slots válidos
    Action->>DB: $transaction(criar ReservationRecurrence?, criar Reservation(s))
    Action->>Notif: notifyReservationConfirmed(occurrences)
    Action-->>UI: {status: success}
  else Conflito/dia não letivo
    Action-->>UI: {status: error, message}
  end
```
