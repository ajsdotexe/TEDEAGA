# Sincronizar o PC com o celular

Há duas formas. Use uma ou as duas.

## 1) Por Wi-Fi, direto (sem conta, sem internet) — a mais simples
Ideal em casa: o celular e o PC trocam os dados pela rede local.

**No PC (TEDEAGA Windows)**
1. Abra Ajustes > "Sincronizar com o celular (Wi-Fi)" e marque **Ativar**.
2. Na primeira vez o Windows pergunta sobre o Firewall: clique em **Permitir** em "Redes privadas".
3. Anote o **endereço** (ex.: `192.168.0.12:47821`) e o **PIN** de 6 números que aparecem ali.
   O app do PC precisa ficar aberto (pode ficar na bandeja, perto do relógio).

**No celular (TEDEAGA Android)**
1. Conecte o celular ao mesmo Wi-Fi do PC.
2. Abra Ajustes > "Sincronizar com o PC (Wi-Fi)", digite o endereço (só o IP já basta) e o PIN, e toque em **Salvar**.
3. Pronto: ele sincroniza na hora. Depois disso, com "Sincronizar automaticamente" ligado, os dois se atualizam
   ao abrir o app e cerca de 25 segundos depois de cada mudança (quando o PC estiver ligado e na mesma rede).

**Botões**
- **Sincronizar agora:** traz a versão mais nova e, se a do celular for mais nova, envia ao PC.
- **Enviar ao PC / Buscar do PC:** forçam o sentido (pedem confirmação antes de substituir).
- Se os dois mudaram ao mesmo tempo, o app pergunta qual versão manter.

**Segurança:** só aceita conexões da rede local, exige o PIN (bloqueia por 1 minuto após 5 erros),
mas os dados trafegam sem criptografia no Wi-Fi. Use só em rede de casa ou de confiança.
Para trocar o PIN: botão "Gerar novo PIN" no PC.

**Não conecta?** Confira: mesmo Wi-Fi (sem "isolamento de clientes"/rede de visitantes), TEDEAGA aberto no PC,
Firewall permitido, endereço digitado corretamente (o IP pode mudar; veja de novo no PC).

## 2) Pela conta Google — funciona de qualquer lugar
Entre com a **mesma conta Google** nos dois (Ajustes > Conta Google). A sincronização e o backup diário
usam a pasta oculta do seu Google Drive. Veja `GOOGLE.md` (PC) e `GOOGLE-ANDROID.md` (celular).
Crie as duas credenciais (Desktop e Android) **no mesmo projeto** do Google Cloud para os dois enxergarem os mesmos dados.

## 3) Manual (sempre disponível)
Ajustes > Backup > "Baixar backup" em um aparelho e "Restaurar" no outro.
