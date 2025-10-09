# Software e Manutenções

## Status
Módulo planejado (“Em breve”), destinado a acompanhar pedidos de instalação e manutenções de software nos laboratórios.

## Contas de mock geradas pela seed
- **Administrador**: `admin@acadlab.local`
- **Técnico**: `tech@acadlab.local`
- **Professor**: `prof@acadlab.local`
- **Senha padrão**: `ChangeMe123!`

## Passo a passo para preparar o ambiente
1. Defina `DATABASE_URL` no `.env`.
2. Instale pacotes com `npm install`.
3. Sincronize o schema: `npx prisma db push`.
4. Execute `npx prisma db seed` para criar as contas mock.
5. Inicie a aplicação: `npm run dev`.
6. Valide o acesso dos três perfis em `/dashboard/software` assim que a página for liberada.

## Checklist provisório
- Card “Software e Manutenções” deve aparecer para todos os perfis (admin, técnico, professor) e permanecer sinalizado como “Em breve”.
- Prepare casos de teste futuros:
  - Professor abrindo solicitações de software.
  - Técnico avaliando, aprovando ou rejeitando pedidos.
  - Administrador auditando o histórico.

## Observações futuras
- Documente neste arquivo os fluxos completos (CRUD de software, associação a laboratórios, controle de status) assim que os endpoints forem entregues.
- Seeds complementares deverão criar softwares de exemplo e relacionamentos com laboratórios para cenários de teste realistas.
