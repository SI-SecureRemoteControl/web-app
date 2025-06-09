# Self-signed certificate for local development
# Pokreni PowerShell kao administrator!
# Ova skripta generira cert.pem i localhost.pfx u backend/

$cert = New-SelfSignedCertificate -DnsName "localhost" -CertStoreLocation "cert:\LocalMachine\My"
$pwd = ConvertTo-SecureString -String "password" -Force -AsPlainText
Export-PfxCertificate -Cert "cert:\LocalMachine\My\$($cert.Thumbprint)" -FilePath "backend\localhost.pfx" -Password $pwd
Export-Certificate -Cert "cert:\LocalMachine\My\$($cert.Thumbprint)" -FilePath "backend\cert.pem"

Write-Host "\nSada pokreni ovu naredbu u PowerShellu (nakon što instaliraš OpenSSL):"
Write-Host "openssl pkcs12 -in backend/localhost.pfx -nocerts -nodes -out backend/key.pem -password pass:password"
Write-Host "Ako nemaš OpenSSL, skini ga s https://slproweb.com/products/Win32OpenSSL.html"