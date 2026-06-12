# Firma de QZ Tray para impresion silenciosa

La aplicacion usa la Edge Function `qz-sign` para firmar las solicitudes de QZ Tray con RSA SHA-512. El certificado se entrega a Angular, pero la llave privada permanece exclusivamente en los secretos de Supabase.

## 1. Generar el certificado en el computador de caja

Para el unico computador del MVP se puede usar el certificado demo asociado a esa instalacion de QZ Tray:

1. Abrir QZ Tray.
2. Ir a `Advanced` > `Site Manager`.
3. Pulsar `+` > `Create New` y completar el asistente.
4. QZ crea una carpeta `QZ Tray Demo Cert` en el escritorio.
5. Conservar estos archivos:
   - `digital-certificate.txt`: certificado publico.
   - `private-key.pem`: llave privada PKCS#8.

La llave `private-key.pem` no se copia al repositorio ni al proyecto Angular.

## 2. Cargar secretos en Supabase

En `Supabase Dashboard` > `Edge Functions` > `Secrets`, crear:

- `QZ_CERTIFICATE`: contenido completo de `digital-certificate.txt`.
- `QZ_PRIVATE_KEY`: contenido completo de `private-key.pem`.
- `QZ_ALLOWED_ORIGINS`: origen de la aplicacion publicada, por ejemplo `https://pos.moveonapp.com`. Para varios origenes, separarlos con coma.

Localmente, `http://localhost:4200` y `http://127.0.0.1:4200` ya estan permitidos.

Alternativa con Supabase CLI desde PowerShell:

```powershell
$cert = Get-Content -Raw "$HOME\Desktop\QZ Tray Demo Cert\digital-certificate.txt"
$key = Get-Content -Raw "$HOME\Desktop\QZ Tray Demo Cert\private-key.pem"
supabase secrets set QZ_CERTIFICATE="$cert" QZ_PRIVATE_KEY="$key" QZ_ALLOWED_ORIGINS="https://pos.moveonapp.com"
```

## 3. Desplegar la Edge Function

```powershell
supabase functions deploy qz-sign
```

La funcion mantiene `verify_jwt = true` y valida que el usuario tenga una relacion activa en `user_tiendas` antes de entregar el certificado o firmar.

## 4. Autorizar el certificado en QZ Tray

1. Cerrar y abrir la aplicacion POS.
2. Ejecutar `Imprimir prueba`.
3. Si QZ muestra una solicitud para confiar en el certificado nuevo, aceptarla y marcar `Remember this decision`.
4. Las impresiones siguientes deben salir sin el cuadro `Action Required`.

Si la Edge Function o sus secretos no estan disponibles, la aplicacion conserva temporalmente el flujo sin firma y QZ volvera a solicitar autorizacion manual.

## Referencias

- QZ Tray: https://qz.io/docs/signing
- Supabase Edge Function secrets: https://supabase.com/docs/guides/functions/secrets
- Supabase Edge Function authentication: https://supabase.com/docs/guides/functions/auth
