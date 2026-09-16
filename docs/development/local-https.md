# Local HTTPS (optional)

The repository does not keep a local certificate or HTTPS proxy helper. The
standard development command is `pnpm dev` over HTTP.

If a browser or identity-provider test requires HTTPS, create a temporary,
ignored certificate with [mkcert](https://github.com/FiloSottile/mkcert):

```powershell
mkcert -install
New-Item -ItemType Directory -Force .certs
mkcert -pkcs12 -p12-file .certs/localhost.pfx localhost 127.0.0.1 ::1
```

Do not commit `.certs/` or any certificate passphrase. Remove the generated
certificate after the local test is complete.
