# Flujo de trabajo predeterminado

- Para cualquier peticion de implementar una funcionalidad o corregir un bug,
  trabaja en una rama distinta de `main` y crea una pull request con base `main`.
  El usuario no tiene que repetir esta indicacion en cada peticion.
- Si la tarea ya pertenece a una PR abierta, actualiza esa misma PR en lugar de
  crear otra. No cambies su base a una rama distinta de `main` sin autorizacion.
- No hagas commits ni pushes directamente a `main`. No fusiones PRs, no actives
  auto-merge y no despliegues manualmente en produccion salvo que el usuario lo
  pida explicitamente para esa operacion. Pedir implementar, corregir, terminar
  o probar un cambio no autoriza a fusionarlo ni a publicarlo en produccion.
- Deja la PR abierta para que el usuario pueda probar la preview desde el movil.
  Ejecuta `npm test` y `npm run build` antes de dar el cambio por terminado.
  Describe el cambio, las pruebas y cualquier limitacion en la PR.
- Consulta los checks y el comentario del bot con el enlace de preview. Si aun
  esta pendiente o requiere aprobacion, indicalo: no afirmes que esta publicada.
  No fusiones la PR para conseguir una preview.
- La fusion y el despliegue en produccion son una decision posterior del usuario.
  No modifiques ni desactives las protecciones de `main` para completar una tarea.

Para el funcionamiento de previews, datos y comandos del proyecto, consulta
[README.md](../README.md).
