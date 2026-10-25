# Catalogos de informacion sobre deuda publica

Inventario de publicaciones, conjuntos de datos y recursos estadisticos oficiales
del Banco de Espana, la IGAE, el Tesoro Publico y Eurostat. Los catalogos describen
lo que publica cada organismo; no implican que esos datos esten ya integrados en
la aplicacion, que actualmente se alimenta de series del Banco de Espana.

## Estructura

| Organismo | Contenido |
| --- | --- |
| [Banco de Espana](banco-de-espana/) | Catalogo de conjuntos de datos, boletin estadistico del capitulo 11 y ficheros tabulares previos. |
| [IGAE](igae/catalogo_notificacion_pde.json) | Notificaciones de deficit y deuda al Procedimiento de Deficit Excesivo (PDE), cuadros y metodologia. |
| [Tesoro Publico](tesoro/catalogo_estadisticas_mensuales.json) | Boletin mensual: deuda en circulacion, tenedores, financiacion, vencimientos y mercado secundario. |
| [Eurostat](eurostat/catalogo_deficit_deuda_pde.json) | Dataset armonizado `gov_10dd_edpt1`, indicadores y dimensiones de consulta. |

## Criterios de lectura

- El inventario del Tesoro recoge los enlaces de PDF y XLSX publicados en su pagina
  de estadisticas mensuales. Sus ficheros cambian con cada edicion; la pagina oficial
  es la referencia para la version vigente.
- Las notificaciones de la IGAE se actualizan dos veces al ano. La catalogacion
  describe los contenidos y el marco de notificacion, no fija una lista de nombres
  de archivo que puede variar entre ediciones.
- Eurostat armoniza las cifras para comparacion entre paises. El dataset PDE expresa
  la deuda bruta consolidada a valor nominal al cierre del ano; no debe confundirse
  con la deuda del Estado ni con un calendario de vencimientos de titulos.
- La deuda del Estado publicada por el Tesoro tiene un ambito institucional e
  instrumentos distintos de la deuda PDE del conjunto de las Administraciones
  Publicas. No sumar ni comparar sus saldos como si tuvieran el mismo perimetro.
- Los catalogos son inventarios de recursos, no descargas historicas congeladas.
  Las frecuencias, periodos y enlaces de descarga deben comprobarse en la fuente.

## Fuentes oficiales

- [IGAE: notificacion de deficit y deuda a la UE](https://www.igae.pap.hacienda.gob.es/sitios/igae/es-ES/Contabilidad/ContabilidadNacional/Publicaciones/Paginas/ianotificaciondeficit.aspx)
- [Tesoro: estadisticas mensuales](https://www.tesoro.es/deuda-publica/estad%C3%ADsticas-mensuales)
- [Eurostat: dataset gov_10dd_edpt1](https://ec.europa.eu/eurostat/databrowser/view/gov_10dd_edpt1/default/table)
- [Eurostat: metadatos de deficit y deuda publicos](https://ec.europa.eu/eurostat/cache/metadata/en/gov_10dd_esms.htm)
