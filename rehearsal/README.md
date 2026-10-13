# Ensayo de ascenso y rewards en Arc Testnet

Esta carpeta prueba funciones con fondos de testnet y contratos nuevos; no toca la colección de producción ni abre su mint. Para abrirla con MetaMask:

1. Descargar el repositorio (Code → Download ZIP) y extraerlo.
2. En su carpeta ejecutar `python3 -m http.server 8000 --bind 127.0.0.1`.
3. Abrir `http://127.0.0.1:8000/rehearsal/` en el navegador de MetaMask.
4. Añadir Arc Testnet, chainId 5042002, RPC https://rpc.testnet.arc.io, USDC, explorer https://explorer.testnet.arc.io.
5. Obtener USDC de testnet en https://faucet.circle.com, seleccionando Arc Testnet y tu dirección pública.
6. Conectar, desplegar los cuatro contratos, configurar cinco membresías, activar 1 y 4, ascender 1 con token de ensayo y ascender 4 sacrificando 2 y 3.
7. Financiar rewards con 1 USDC de testnet y publicar el periodo. N0 no aporta puntos; las dos N2 aportan 4 unidades internas cada una, total 8.
8. Esperar las 24 horas del contrato y reclamar. La espera no se acorta en testnet. Descargar evidencia y conservar las direcciones.

Los contratos adicionales de ensayo son TestMintRelay (emisor owner-only) y TestCOFFERS (18 decimales). Sus constructores rechazan cadenas distintas de Arc Testnet. El NFT es una copia del código de la colección existente. Rewards usa USDC real DE TESTNET en 0x3600000000000000000000000000000000000000, con 6 decimales en la interfaz ERC20. Native USDC es la misma moneda para gas, con 18 decimales en RPC: no sumar esos saldos como dos activos diferentes.

El relay NO es OpenSea SeaDrop. En la consulta del 12 octubre la dirección SeaDrop de mainnet no contenía código en testnet. No afirmar que este ensayo valida OpenSea Studio ni un mint oficial. Las pruebas locales existentes sí ejercitan SeaDrop.

La página guarda solo direcciones, manifiesto y hashes en localStorage bajo la wallet conectada. Cada envío requiere firma en MetaMask. No pide claves privadas. Si una operación falla, consultar su hash antes de repetirla. No activar contratos reales utilizando direcciones del ensayo.

Fuentes de red: https://docs.arc.io/arc/references/connect-to-arc y https://docs.arc.io/arc/references/contract-addresses. Se verificó por RPC chainId 5042002 y decimals() USDC=6; no se ha firmado ninguna transacción de testnet en esta entrega.
