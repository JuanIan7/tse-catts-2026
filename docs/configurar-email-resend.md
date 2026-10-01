# Configurar os avisos por e-mail

1. Crie uma conta gratuita no [Brevo](https://www.brevo.com), crie uma chave de API e confirme um remetente.
2. No Vercel, abra o projeto do CATTS em **Settings → Environment Variables**.
3. Cadastre `BREVO_API_KEY` como **Secret** com a chave do Brevo.
4. Cadastre `BREVO_FROM` como **Config**, no formato `CATTS <seu-email-verificado@exemplo.com>`.
5. Cadastre `ADMIN_NOTIFICATION_EMAIL` com `juanhanzi@gmail.com`.
6. Marque Production e Preview, salve e faça um novo deploy.

O Brevo é usado automaticamente quando as duas variáveis `BREVO_*` estão presentes. `RESEND_API_KEY` e `RESEND_FROM` permanecem apenas como alternativa quando o Brevo ainda não foi configurado. Uma falha de entrega do Brevo é registrada; não há reenvio automático pelo Resend para evitar mensagens duplicadas.

Sem essas variáveis, o CATTS continua avaliando normalmente; o painel apenas registra que o e-mail está pendente.
