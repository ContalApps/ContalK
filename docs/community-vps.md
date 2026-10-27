# Comunidade na VPS

O serviço roda no Coolify (projeto ConTalk) a partir de `deploy/community/compose.coolify.yml`, na branch `main`, com deploy automático. Não há chaves por pessoa nem armazenamento externo para configurar: as contas são criadas no aplicativo e tudo fica no volume da comunidade. Veja [Serviço de comunidade](community-service.md).

Variáveis usadas: `CONTALK_REALTIME_URL`, `CONTALK_MEDIA_PUBLIC_IP`, `CONTALK_TURN_URLS`, `CONTALK_TURN_SECRET`, `CONTALK_MEDIA_EXPOSE_INTERNAL_IP`, `CONTALK_AI_ALLOWED_HOSTS` e, opcionalmente, `CONTALK_FILE_QUOTA_MB`. Voz e TURN seguem [Meteor Cloud: comunicação WebRTC](meteor-voice.md). O perfil público com Caddy em `deploy/community/compose.yml` é só para instalação independente; não o ative nesta VPS, que já tem proxy nas portas 80/443.

Preserve o volume `community_data`: todos os dados ficam em `/app/data/contalk-v2`. Não há dados de versões anteriores no volume. `npm run community:setup` gera chaves por pessoa para o modelo antigo e não é mais necessário.
