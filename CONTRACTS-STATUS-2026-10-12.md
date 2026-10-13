# CofferHouse — ascenso y rewards, 12 octubre 2026

## Colección existente

Arc, ERC721 SeaDrop, dirección 0xBdAAD4B289b65B572E231e548278B9451A13f0FE.
El 10 de octubre se comparó el bytecode enviado por el usuario con el artefacto
local: código ejecutable idéntico, metadata Solidity diferente. No es una nueva
lectura RPC ni verificación oficial en el explorador. OpenSea Studio administra
esta colección; el calendario del 23 de octubre es tentativo, guardado como
borrador según instrucciones. Reserva única de 100 incluye marketing/comunidad.

NO sustituir ni volver a desplegar el NFT. Sus funciones de ascenso ya están
incorporadas. La fuente de esa colección se conserva sin modificaciones.
Ascenso debe permanecer desactivado hasta revelar y configurar token/costes/URI.

## Ascenso existente

N0 → N1: activate, pago en token del proyecto a DEAD.
N1 → N2 → N3 → N4 → N5: ascend, un nivel por operación.
Sacrificio: sobreviviente activo, dueño de todas las membresías, sacrificados
homogéneos, cantidad = nivel objetivo − nivel sacrificado. Ejemplo N3:
1 N2 o 2 N1 o 3 N0. No sirve para activar N0. Se conserva el sobreviviente y
se queman los demás de forma atómica. No reabre plazas de mint.

Enviar ERC20 a DEAD retira de circulación, pero NO reduce totalSupply ERC20.
El usuario confirmó conservar los costes de Merry AIgents: 20,000 / 80,000 / 320,000 / 1,000,000 / 2,000,000 COFFERS por paso. Mi propuesta alternativa queda descartada. Confirmar decimales reales al configurar.
`empower` añade 30 días por cualquier importe positivo: sin política aprobada,
NO exponerlo ni darle peso adicional en rewards. No tiene desactivación individual
si se habilita todo el ascenso; esta limitación forma parte del contrato existente.

## Nuevo CofferHouseRewards

Distribuidor ERC20 independiente ligado de forma inmutable a la colección.
Cada periodo fija root, token, presupuesto, bloque del snapshot y hash del
manifiesto. Requiere fondos previos suficientes para todos los periodos pendientes.
Periodo sin caducidad, root sin reemplazo ni cancelación. Espera de revisión de
24 horas antes de reclamar. La pausa administrativa puede detener reclamaciones;
no permite retirar su respaldo. Ownership en dos pasos. Surplus solo excedente.

La wallet beneficiaria se fija en el snapshot. Transferir o quemar una membresía
DESPUÉS de ese bloque no cambia rewards ya asignados. No verifica nivel actual
al reclamar, para preservar ese derecho. Cualquiera puede enviar un claim válido,
pero el pago siempre va al beneficiario del comprobante, nunca al remitente.
Cada wallet reclama una vez por periodo. Hojas con doble hash y dominio de
chainId, distribuidor, colección, periodo y token para impedir reutilización.

El administrador sigue siendo responsable de snapshots, pesos y reparto. El
contrato NO prueba que el root incluya a todos ni que sus importes sean justos;
los manifiestos públicos permiten revisión. Un root mal construido no se corrige
ni libera: validar fuera de cadena y en ensayo ANTES de publicarlo. El límite de
presupuesto evita sobrepago total, pero un root cuyo total supera el presupuesto
haría fallar reclamaciones posteriores. Usar exclusivamente el generador probado.

Admite USDC ERC20, COFFERS u otro ERC20 estándar. NO recibe recompensas nativas,
no soporta rebasing ni tasas de transferencia. Los tokens con callbacks/bloqueos
requieren revisión adicional. Los fondos no se generan automáticamente: deben
venir de fees realmente recibidas y de la asignación aprobada. No hay APY prometido.
No se conectó Argus ni Morpho en esta entrega.

## Operación reproducible

1. `npm install --ignore-scripts --omit=optional`; `npm test`.
2. Desplegar rewards primero en ensayo usando `wallet/rewards-artifact.json`;
   ABI en `abi`, bytecode en `evm.bytecode.object`. Solidity 0.8.17, optimizer 200,
   London. Constructor: colección de ensayo y wallet administradora de ensayo.
3. Snapshot: `node scripts/rewards-snapshot.mjs RPC NFT BLOCK snapshot.json`.
   Todos los ownerOf/tier se consultan en el MISMO bloque; burned NFTs se omiten
   únicamente por selector ERC721A conocido; errores RPC abortan. Usar bloque
   suficientemente confirmado y RPC con histórico. No se cuenta empower.
4. Input de generador: `{domain:{chainId,distributor,membership,epoch,token},
   snapshot:<JSON snapshot>,weights:["..." x6],budget:"unidades minimas"}`.
   Pesos de propuesta implementada: 0,2,4,7,10,16; el generador rechaza otras tablas. Los importes
   van como cadenas decimales en unidades mínimas (USDC ERC20 suele usar 6, verificar).
5. `node scripts/rewards.mjs input.json manifest.json`. Publicar los bytes exactos
   del manifiesto en HTTPS/IPFS durable. Guarda root, presupuesto total, totalPoints y hash.
   El redondeo se mantiene reservado hasta que se reclamen todos los puntos; después se libera como excedente recuperable.
6. Financiar y comprobar balance; publicar `publishEpoch(token,root,budget,
   snapshotBlock,manifestHash,totalPoints)`. Revisar antes de firmar. Esperar 24 horas.
7. Reclamar `claim(epoch,beneficiary,points,proof)`; sin approve para reclamar.
   `wallet/holder-actions.mjs` contiene adaptadores para ascenso/sacrificio/claim.
   Están preparados para integración; NO se ha modificado/desplegado Holder Center.

## Qué falta para activación real

- Confirmar dirección/decimales COFFERS ; costes N1–N5 ya aprobados sin cambios. Pesos aprobados: 1/2/3.5/5/8, escala interna 2.
- Confirmar fuente de fees, frecuencia de periodos y administrador/multisig.
- Hosting metadata revelada y manifiestos, dirección ERC20 reward en Arc.
- Conectar los adaptadores a la página real de Holder Center y probar su UI.
- Desplegar rewards en testnet, ensayo con wallets, verificación y revisión externa.
- Después: firmas de despliegue/configuración real. No se ejecutaron transacciones
  ni se activó ascenso. Las pruebas locales no son auditoría ni ensayo de red.

## Regla matemática aprobada e implementada, 12 octubre

Pesos N0..N5 = 0,2,4,7,10,16. Solo activadas participan.
Puntos de wallet = suma de pesos de sus membresías en el snapshot.
Puntos totales T = 2*n1 + 4*n2 + 7*n3 + 10*n4 + 16*n5.
Pago = floor(presupuesto * puntosWallet / T), calculado ONCHAIN con Math.mulDiv.
El comprobante contiene puntos, no un importe arbitrario. El presupuesto debe
ser al menos T en unidades mínimas para evitar reclamaciones de valor cero.
Cuando se reclaman todos los puntos, el residuo de redondeo deja de estar reservado.
Pesos visibles N1..N5: 1,2,3.5,5,8. POINT_SCALE=2; convertir los puntos internos dividiendo entre 2 SOLO para mostrarlos. No dividir importes ni pruebas. Los pesos son inmutables en esta versión; todavía no se desplegó.

IMPORTANTE: el contrato verifica la prueba de puntos y calcula el pago, pero
no reconstruye el histórico de propiedad/nivel. Publicar el snapshot y su suma
sigue siendo responsabilidad del administrador; un root incorrecto puede asignar
puntos incorrectos. No es reparto completamente autónomo ni una fuente de fees.
No se implementa exclusion de reserva del equipo: no fue aprobada por el usuario.
Si las reservas se activan, participan bajo las mismas reglas.
Costes Merry y reglas de sacrificio permanecen intactos.

Contratos para membresía+ascenso+rewards: 2 (NFT ya desplegado + rewards nuevo).
COFFERS ERC20 es un tercer contrato del ecosistema; vault futuro sería adicional.
