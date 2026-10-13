# Despliegue con Remix y MetaMask

El mint será en OpenSea. Este contrato personalizado es la colección que
incluye el sacrificio y el ascenso; la fábrica estándar de Studio no incorpora
esas funciones. El despliegue por sí solo no publica ni inicia la venta.

## Preparación sin transacciones

1. Abre https://remix.ethereum.org desde el navegador con MetaMask.
2. Sube `verification/CofferHouseSeaDrop.flattened.sol` con Upload File del
   explorador de archivos de Remix. Incluye las 24 fuentes necesarias; no
   descarga dependencias ni requiere instalar software.
3. Abre Solidity Compiler. Selecciona **0.8.17**, activa Optimization con
   **200 runs** y elige **London** en EVM Version. Deja **viaIR desactivado**.
4. Compila el archivo y selecciona **CofferHouseSeaDrop**. Las advertencias de
   funciones o parámetros no usados de las dependencias no son errores.
5. Abre Deploy & Run, selecciona **Browser Extension / MetaMask** (en algunas
   versiones aparece Injected Provider) y verifica **Arc Mainnet, 5042**.
   Conectar la wallet no despliega nada.

## Transacción de creación

El contrato no es actualizable. No se puede cambiar su código después de
desplegarlo. Nombre y símbolo quedan fijados. La wallet que despliega pasa a
ser propietaria y puede configurar venta, metadata, SeaDrop permitido y ascenso.
Usa una cuenta elegida para administrar CofferHouse.

Constructor:

```text
name_: CofferHouse
symbol_: COFFER
seaDrops: ["0x00005EA00Ac477B1030CE78506496e8C2dE24bf5"]
```

Confirma estos nombres antes del despliegue definitivo si quieres cambiarlos.
En el campo único de argumentos, el formato es:

```text
"CofferHouse","COFFER",["0x00005EA00Ac477B1030CE78506496e8C2dE24bf5"]
```

**Value debe quedar en 0.** Deploy solicita una transacción de creación de
contrato con gas, no un permiso ERC20 ni una transferencia de NFTs. No hay una
dirección de destinatario preexistente en un despliegue directo. El gas lo
estima MetaMask; no uses como estimación el costo de la fábrica estándar.
Revisa red, valor y costo antes de confirmar. Conserva hash de transacción y
dirección resultante. La firma la realiza únicamente el usuario en MetaMask.

## Revisión posterior antes de abrir la venta

1. Verifica fuente y configuración de compilación en el explorador. Para el
   archivo único usa Single File, solc 0.8.17, optimizer 200, London y los
   argumentos del constructor. `verification/standard-input.json` pertenece
   a la versión modular: no lo uses para verificar la metadata de un despliegue
   del archivo único.
2. Lee `owner()`, `maxSupply()` (4444), `ascensionEnabled()` (false), y
   el evento `AllowedSeaDropUpdated` de la creación (dirección indicada).
   La base oficial no expone un getter de esa lista. No hay NFTs acuñados aún.
3. Comprueba que OpenSea indexa la dirección y que Studio permite configurar
   su Drop. Soporte de Arc confirmado no equivale a comprobar esa colección
   personalizada. Si no aparece, conserva el contrato y resuelve el registro
   antes de vender; no crees una segunda colección definitiva como reemplazo.
4. Configura metadata oculta, destino del ingreso, fee recipient y condiciones
   que Studio solicite. La dirección oficial del fee recipient debe obtenerse
   del flujo real de OpenSea; no está inventada ni fijada en este paquete.
5. Acuña la reserva de 100 mediante la etapa gratuita preparada. Comprueba su
   propiedad antes de habilitar la etapa pública de 4344.
6. Haz una compra controlada y verifica valor recibido y fees antes del anuncio.
7. El ascenso permanece apagado hasta confirmar dirección de COFFERS, sus
   decimales, la tabla económica y la URL de metadata de niveles. El borrador
   conserva N0–N5 técnicos; no es una aprobación de precios o nombres públicos.

Los JSON reales de la colección, su almacenamiento y el servicio de metadata
dinámica no están alojados por este paquete. El generador de metadata preserva
las imágenes y atributos, reserva 13 especiales dentro de los mismos 100 y
mezcla los 4344 públicos. No publiques los archivos de revelación ni el mapa
privado antes de la revelación.

Las pruebas locales no son una auditoría ni acreditan disponibilidad de un
backend, distribución de rewards o conexión con Argus. No anuncies esas piezas
como operativas por haber desplegado este contrato.
