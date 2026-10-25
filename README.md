# Deuda Abierta

Observatorio de la deuda espanola construido con Vue 3, TypeScript y Vite.
La aplicacion usa ficheros publicados por el Banco de Espana, sin datos simulados
ni servicios de terceros. Los catalogos de las fuentes oficiales estan organizados
por organismo en [catalogos](catalogos/README.md).

- [Web publicada](https://alejandrovaltierracarbonero.github.io/deuda-abierta/)
- [Repositorio](https://github.com/AlejandroValtierraCarbonero/deuda-abierta)

## Puesta en marcha

Requiere Node.js 22.12 o superior y npm.

```powershell
npm install
npm run dev
```

Abrir la direccion local que muestra Vite. Se incluye una descarga real de datos,
por lo que no es necesario acceder al BdE para consultar la aplicacion.

```powershell
npm run data:sync
npm test
npm run build
npm run preview
```

`build` ejecuta primero la comprobacion estricta de TypeScript. `preview` sirve
la compilacion de produccion. Se puede desplegar `dist` en un alojamiento estatico;
la navegacion por hash no requiere reglas de redireccion. Para subdirectorios,
definir `VITE_BASE_PATH` antes de compilar (por defecto `/`).

## Publicacion en GitHub Pages

El workflow [Deploy GitHub Pages](.github/workflows/deploy.yml) ejecuta las
pruebas, comprueba los tipos, compila y publica con cada push a `main`.
Tambien se puede lanzar manualmente desde Actions. En Settings > Pages,
la fuente de publicacion debe ser GitHub Actions.

La ruta base se obtiene de la configuracion de Pages para que los recursos,
los datos y las descargas funcionen bajo `/deuda-abierta/`.
El workflow publica los datos guardados en el repositorio; no los actualiza
automaticamente. Para publicar datos nuevos, ejecutar `npm run data:sync`,
validar, guardar los cambios y subirlos a `main`. Si las pruebas o la
compilacion fallan, no se despliega y se conserva la web anterior.

## Funcionalidades

- Resumen trimestral: saldo consolidado, deuda/PIB, variacion interanual del
  saldo y cambio de ratio en puntos porcentuales. Avance mensual separado.
- Evolucion historica con rango temporal, unidad alternativa, tabla y CSV.
- Comparacion de dos fechas, con cambio de saldo y de ratio.
- Subsectores de las AAPP y comparador de 17 comunidades en euros y PIB regional.
- Tenedores, instrumentos y plazos residuales verificados.
- Cascada de conciliacion trimestral entre deficit y variacion de deuda.
- Emisiones brutas/netas de las AAPP y rendimientos de bonos y obligaciones.
- Explorador de todas las series integradas con busqueda, filtros, metadatos,
  descarga y enlaces compartibles que conservan la seleccion.
- Fuentes y metodologia, originales descargados y catalogos de informacion del BdE,
  la IGAE, el Tesoro y Eurostat.
- Diseno responsive, navegacion por teclado, tablas alternativas y estados de error.

## Pedir cambios y probarlos desde GitHub Mobile

1. En GitHub Mobile, abre Copilot > New Session y selecciona este repositorio,
   o crea una issue y asignala a Copilot si tu cuenta tiene acceso al agente.
2. Describe solamente el cambio, por ejemplo: "Anade un filtro por comunidad".
   Las [instrucciones del repositorio](.github/copilot-instructions.md) indican
   que debe crear una PR contra `main` y dejarla abierta, sin fusionar ni activar
   auto-merge. No necesitas repetir esa indicacion en cada tarea.
3. En la PR, espera a **Tests and build**. Las ejecuciones de Copilot o de
   colaboradores pueden requerir que apruebes los workflows desde GitHub.
4. El bot publica un comentario **Vista de prueba**, con un enlace como
   `https://alejandrovaltierracarbonero.github.io/deuda-abierta-previews/pr-12/`.
   Abre el enlace en el navegador del movil y comprueba el commit del aviso superior.
5. Pide ajustes con `@copilot` en la PR. Cada nuevo commit validado actualiza la preview.
6. Cuando estes conforme, fusiona la PR. Solo entonces se actualiza produccion.
   Si la cierras sin fusionar, produccion no cambia y la preview se retira.

### Arquitectura y permisos

- `pr-checks.yml` ejecuta codigo de PR con token de lectura, sin secretos y sin
  credenciales Git persistidas. Los PR de forks pasan CI pero no reciben preview.
- `preview-publish.yml` se ejecuta con herramientas de `main`, nunca scripts de
  la PR. Comprueba que la PR esta abierta, procede de este repositorio y que el
  SHA sigue vigente. Copia solamente el resultado estatico; nunca lo ejecuta.
- Una clave SSH de despliegue con escritura esta limitada al repositorio
  `deuda-abierta-previews`. Su parte privada es el secreto `PREVIEW_DEPLOY_KEY`;
  no se almacena en el codigo. No permite modificar el repositorio de produccion.
- El repositorio de previews usa Pages desde su rama `main`, sin ejecutar
  workflows aportados en los artefactos. El publicador rechaza archivos ocultos
  y enlaces simbolicos y limita el tamano de cada preview a 50 MB.
- Se serializa la publicacion para conservar previews simultaneas. Al cerrar una
  PR se retiran las carpetas de PR cerradas. Si una ejecucion queda pendiente
  por concurrencia, se puede reconciliar con **Publish pull request preview >
  Run workflow**; esta accion manual limpia, no construye PRs.
- Las previews son publicas y comparten el origen `github.io` de esta cuenta
  con produccion aunque esten en otro repositorio. No hay aislamiento de
  seguridad por dominio: no usar para cambios de autores no confiables, login,
  secretos ni informacion sensible. Para aislar origen se necesita otro dominio
  o proveedor de previews.
- Pages puede tardar unos minutos en actualizar el contenido. Una compilacion
  fallida no reemplaza la ultima preview valida: revisa siempre el SHA mostrado.

`main` exige la comprobacion **Tests and build** y una PR. No se exige una
aprobacion de otro usuario para permitir el trabajo individual; el propietario
administrador puede saltarse la proteccion. El acceso a Copilot y sus cuotas
dependen de la cuenta, independientemente de que Pages sea gratuito.

## Datos y actualizaciones

[Sincronizador](scripts/sync-data.mjs) descarga 12 cuadros oficiales y publica
[snapshot](public/data/snapshot.json) solo cuando toda la descarga se ha completado
correctamente. No necesita proxy CORS en el navegador: la descarga ocurre en Node.
Antes de publicar se verifican la cobertura requerida y las identidades contables
de instrumentos, tenedores y conciliacion de los ultimos 40 trimestres.
No hay actualizacion automatica en el cliente ni se presenta informacion en tiempo
real. Ejecutar `npm run data:sync` manualmente o en una tarea programada y volver
a compilar/desplegar para publicar los datos nuevos.

Los originales se conservan bajo `public/data/raw`, agrupados por descarga, con
huella SHA-256. Cada sincronizacion compara observaciones existentes y registra
revisiones y retiradas en el nuevo snapshot. Una descarga fallida no reemplaza la
ultima version valida; el comando termina con error. Los originales parciales
de una descarga fallida pueden permanecer para diagnostico.

Se distingue **fecha de descarga** de **periodo de observacion**. Los CSV utilizados
no proporcionan una fecha de publicacion inequivoca; `publishedAt` es `null`.
Los datos pueden revisarse. El snapshot es un resultado generado: no editar a mano.

## Cuadros utilizados

| Cuadro | Contenido |
| --- | --- |
| 11.b | Avance mensual |
| 11.1, 11.2 | Deuda, pasivos y PIB |
| 11.4 | Subsectores |
| 11.8 | Conciliacion deficit-deuda |
| 11.12 | Instrumentos |
| 11.13 | Tenedores, moneda y plazo residual |
| 13.9, 13.10 | Comunidades autonomas y PIB regional |
| 21.8, 21.9 | Emisiones brutas y netas |
| 22.7 | Negociacion y rendimientos del mercado secundario |

Los recuentos del explorador incluyen series repetidas entre cuadros: la clave
es `(cuadro, codigo)`. No representan 156 conceptos independientes.

## Reglas de interpretacion

- Importes del BdE conservados en unidad original; graficos monetarios convertidos
  a miles de millones de euros. Un billon equivale a 10^12 euros.
- Los valores ausentes no se convierten en cero ni se rellenan con el periodo anterior.
- Las tarjetas usan un mismo trimestre para saldo y ratio.
- El Banco de Espana esta incluido dentro de instituciones financieras en el cuadro
  11.13: no se suma de nuevo al construir la composicion.
- Los saldos de subsectores no se suman sin ajustes de consolidacion.
- El waterfall usa necesidad de financiacion + adquisicion neta total de activos +
  ajustes deficit-deuda del cuadro 11.8. No suma subcomponentes superpuestos.
- Los tramos residuales de valores y prestamos no incluyen efectivo/depositos
  ni constituyen un calendario exacto de vencimientos.
- Rendimientos de mercado no equivalen a intereses pagados o coste medio.
- No se suman deuda externa, privada y publica como bloques independientes.

## Alcance

Implementadas las vistas de deuda publica, composicion, conciliacion, mercados y
explorador. No integrados: deuda privada/externa, microdatos BELab, ayuntamientos
individuales ni calendario exacto por emision. El catalogo incluye referencias a
estos ambitos, no una promesa de que esten disponibles en los paneles.

Proyecto independiente, sin afiliacion al Banco de Espana. Consultar las
[condiciones de uso del BdE](https://www.bde.es) antes de una publicacion comercial.

## Pruebas

`npm test` comprueba CSV y codificaciones, ausencias frente a ceros, periodos,
variaciones interanuales, exportacion, integridad de originales, cobertura
territorial y las identidades de composicion y conciliacion de los ultimos
40 trimestres con datos reales. `npm run build` comprueba tipos y produce el sitio.
