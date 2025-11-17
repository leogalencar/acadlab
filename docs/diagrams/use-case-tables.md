## Detailed Use Case Tables

| Use Case | Actor(s) | Preconditions | Main Flow | Postconditions |
| --- | --- | --- | --- | --- |
| Autenticar no sistema | Professor, Técnico, Administrador | Conta ativa; e-mail permitido pelo domínio configurado | Submete credenciais; NextAuth valida; sessão criada; redirect para `/dashboard` | Sessão autenticada; evento de login notificado |
| Solicitar recuperação de senha | Qualquer usuário | Usuário cadastrado | Envia e-mail; token é gerado e armazenado; link enviado (log) | Token válido associado ao usuário; mensagem de confirmação mostrada |
| Atualizar perfil e senha | Usuário autenticado | Sessão válida; senha atual correta para alteração | Valida payload; compara senha; atualiza user; revalida rotas | Dados persistidos; notificação de entidade atualizada |
| Cadastrar usuário | Administrador, Técnico (somente professor) | Sessão válida; domínio de e-mail permitido | Valida payload; cria usuário com senha temporária; dispara e-mail e notificação | Novo usuário ativo e auditado; dashboard revalidado |
| Editar/remover usuário | Administrador, Técnico | Sessão válida; não autoeditar/remover; papéis permitidos | Valida payload; aplica update/delete; dispara notificação e revalida rotas | Usuário atualizado/removido; auditoria registrada |
| Gerenciar laboratório | Administrador, Técnico | Sessão válida | Valida dados; cria/edita/exclui laboratório; associa softwares; revalida rotas | Laboratório persistido; vínculos de software criados/removidos |
| Manter catálogo de software | Administrador, Técnico | Sessão válida | Valida dados; cria/edita/exclui software; notifica ação; revalida rotas | Catálogo atualizado; auditoria e notificações registradas |
| Solicitar software | Professor, Técnico, Administrador | Sessão válida; laboratório existente | Valida solicitação; cria registro; avisa gestores; revalida rotas | Solicitação pendente; notificações para gestores e requerente |
| Aprovar/rejeitar solicitação | Administrador, Técnico | Sessão válida; permissão de gestor | Valida status; atualiza registro; registra reviewer; notifica requester; revalida rotas | Solicitação atualizada com reviewer e notas |
| Cancelar solicitação | Autor da solicitação | Sessão válida; status pendente | Valida; marca como cancelada; notifica gestores; revalida rotas | Solicitação cancela; histórico preservado |
| Criar reserva | Professor, Técnico, Administrador | Sessão válida; slots disponíveis; regras do sistema carregadas | Valida dados; verifica regras e conflitos; cria reserva(s) e recorrência; notifica | Reserva(s) confirmada(s); notificações emitidas; dashboard revalidado |
| Cancelar reserva | Autor ou gestor | Sessão válida; reserva existente | Valida; marca como cancelada; grava motivo; notifica envolvidos; revalida rotas | Reserva cancelada e historizada; notificações enviadas |
| Agendar período letivo completo | Administrador, Técnico | Sessão válida; professor válido; regras acadêmicas configuradas | Valida; avalia conflitos; cria reservas sequenciais; notifica professor | Série de reservas confirmada; agenda atualizada |
| Configurar regras do sistema | Administrador, Técnico (parcial) | Sessão válida | Valida cores, períodos, domínios, branding; grava regras em `SystemRule`; revalida rotas | Regras ativas; afeta metadados, calendários e validações |
