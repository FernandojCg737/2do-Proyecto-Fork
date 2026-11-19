# Diff Coverage
## Diff: upstream/main...HEAD, staged and unstaged changes

- backend/app/analitica&#46;py (100%)
- backend/app/config&#46;py (100%)
- backend/app/database&#46;py (100%)
- backend/app/modelos_db&#46;py (100%)
- backend/app/models&#46;py (100%)
- backend/app/repositorio&#46;py (98.9%): Missing lines 916,1136,1192,1292-1294
- backend/app/routes&#46;py (96.8%): Missing lines 535,577,600-601,629
- backend/app/services&#46;py (100%)
- backend/seed_data&#46;py (100%)
- frontend/src/analitica&#46;js (100%)
- frontend/src/analiticapage&#46;jsx (100%)
- frontend/src/api&#46;js (100%)
- frontend/src/app&#46;jsx (100%)
- frontend/src/approutes&#46;jsx (100%)
- frontend/src/asistenciacomponents&#46;jsx (93.0%): Missing lines 226-227,246,678,680-681,700-701
- frontend/src/auth&#46;jsx (100%)
- frontend/src/components&#46;jsx (100%)
- frontend/src/createsesionpage&#46;jsx (100%)
- frontend/src/dashboard&#46;jsx (60.0%): Missing lines 14-16,18-19,135-142,144,146,151-158,162-164,166,168,173-180,184-186,188,190,677-679,692-693,883-884,925-926
- frontend/src/fechas&#46;js (93.3%): Missing lines 29
- frontend/src/historialpage&#46;jsx (77.8%): Missing lines 173-174
- frontend/src/layout&#46;jsx (100%)
- frontend/src/main&#46;jsx (100%)
- frontend/src/misdatospage&#46;jsx (100%)
- frontend/src/navpills&#46;jsx (100%)
- frontend/src/sesionspage&#46;jsx (97.9%): Missing lines 92,956-957

## Summary

- **Total**: 1658 lines
- **Missing**: 75 lines
- **Coverage**: 95%



## backend/app/repositorio&#46;py

Lines 912-920

```python
  912         raise ValueError("La sesión de estudio no existe.")
  913 
  914     # REGLA DE SEGURIDAD: Solo el organizador puede finalizar la sesión
  915     if sesion.usuario_id != usuario_id:
! 916         raise PermissionError("Solo el organizador de la sesión tiene permisos para finalizarla.")
  917 
  918     sesion.finalizada = True
  919     sesion.inscripciones_abiertas = False
  920     db.commit()
```


---


Lines 1132-1140

```python
  1132         raise ValueError("La sesión de estudio no existe.")
  1133 
  1134     inscripcion = db.get(Inscripcion, (estudiante_id, sesion_id))
  1135     if not inscripcion:
! 1136         raise ValueError("No estás inscrito en esta sesión.")
  1137 
  1138     # REGLA DE ESTADOS: Solo los ausentes pueden justificar inasistencia
  1139     if inscripcion.asistencia != "ausente":
  1140         raise ValueError("Solo los estudiantes registrados como ausentes pueden presentar una justificación.")
```


---


Lines 1188-1196

```python
  1188         raise ValueError("La sesión de estudio no existe.")
  1189 
  1190     # REGLA DE SEGURIDAD: Solo el organizador puede resolver justificaciones
  1191     if sesion.usuario_id != organizador_id:
! 1192         raise PermissionError("Solo el organizador de la sesión puede aceptar o rechazar justificaciones.")
  1193 
  1194     inscripcion = db.get(Inscripcion, (estudiante_id, sesion_id))
  1195     if not inscripcion:
  1196         raise ValueError("El estudiante no está inscrito en esta sesión.")
```


---


Lines 1288-1298

```python
  1288     ).all()
  1289 
  1290     afectados = 0
  1291     for insc in inscripciones:
! 1292         if insc.estado in ("aceptada", "pendiente", "en_espera", "pendiente_reconfirmacion"):
! 1293             insc.estado = "cancelada"
! 1294             afectados += 1
  1295 
  1296     db.commit()
  1297 
  1298     return {
```


---



## backend/app/routes&#46;py

Lines 531-539

```python
  531     try:
  532         finalizar_sesion(db, sesion_id, usuario.id)
  533         return {"mensaje": "Sesión dada por concluida exitosamente."}
  534     except PermissionError as e:
! 535         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
  536     except ValueError as e:
  537         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
  538 
```


---


Lines 573-581

```python
  573     """
  574     try:
  575         return registrar_asistencia_batch(db, sesion_id, usuario.id, data.asistencias)
  576     except PermissionError as e:
! 577         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
  578     except ValueError as e:
  579         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
  580 
```


---


Lines 596-605

```python
  596     try:
  597         return presentar_justificacion(db, sesion_id, usuario.id, data.justificacion)
  598     except PermissionError as e:
  599         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
! 600     except ValueError as e:
! 601         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
  602 
  603 
  604 @router.post("/sesiones/{sesion_id}/usuarios/{estudiante_id}/responder-justificacion")
  605 def endpoint_responder_justificacion(
```


---


Lines 625-633

```python
  625             decision=data.decision,
  626             motivo=data.motivo,
  627         )
  628     except PermissionError as e:
! 629         raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
  630     except ValueError as e:
  631         raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
  632 
```


---



## frontend/src/asistenciacomponents&#46;jsx

```
  222   // Evalúa y responde una justificación con motivo obligatorio
  223   async function responderJustificacion(estudianteId, decision) {
  224     const motivo = (motivosResolucion[estudianteId] || "").trim();
  225     if (!motivo || motivo.length < 3) {
! 226       setError("Debes indicar un motivo explicativo de al menos 3 caracteres.");
! 227       return;
  228     }
  229 
  230     setProcesandoJustificacion(`${estudianteId}-${decision}`);
  231     setError("");
```


---


```
  242       setMotivosResolucion((prev) => ({ ...prev, [estudianteId]: "" }));
  243       await cargarDatos();
  244       if (onUpdated) onUpdated();
  245     } catch (err) {
! 246       setError(err.message);
  247     } finally {
  248       setProcesandoJustificacion(null);
  249     }
  250   }
```


---


```
  674   async function enviar(e) {
  675     e.preventDefault();
  676     const texto = justificacion.trim();
  677     if (texto.length < 5) {
! 678       setError("La justificación debe tener al menos 5 caracteres explicativos.");
  679       // TAREA 9: Registro de error de validación en el embudo
! 680       track("justificacion_fallida", { sesion_id: sesionId, motivo: "texto_muy_corto" });
! 681       return;
  682     }
  683 
  684     setEnviando(true);
  685     setError("");
```


---


```
  696       if (onSuccess) onSuccess(res.mensaje);
  697       onClose();
  698     } catch (err) {
  699       // Error que frena la tarea (Diapositiva 11/13)
! 700       track("justificacion_fallida", { sesion_id: sesionId, motivo: "error_servidor" });
! 701       setError(err.message);
  702     } finally {
  703       setEnviando(false);
  704     }
  705   }
```


---



## frontend/src/dashboard&#46;jsx

```
  10 } from "./AsistenciaComponents";
  11 import { formatearFecha } from "./fechas";
  12 
  13 // Formatea marca de tiempo ISO a fecha y hora de Bolivia
! 14 function formatearHora(fechaIso) {
! 15   if (!fechaIso) return "";
! 16   const fecha = new Date(fechaIso);
  17   // Un valor que no es una fecha se muestra tal cual en lugar de «Invalid Date».
! 18   if (Number.isNaN(fecha.getTime())) return String(fechaIso);
! 19   return fecha.toLocaleDateString("es-BO", {
  20     day: "2-digit",
  21     month: "2-digit",
  22     year: "numeric",
  23     hour: "2-digit",
```


---


```
  131     }
  132   }
  133 
  134   // --- TAREA 7: Reconfirmar asistencia tras reprogramación ---
! 135   async function reconfirmarAsistencia(sesionId) {
! 136     setProcesando(`reconfirmar-${sesionId}`);
! 137     setError("");
! 138     setMensaje("");
! 139     try {
! 140       const res = await apiRequest(`/sesiones/${sesionId}/reconfirmar`, { method: "POST" });
! 141       setMensaje(res.mensaje || "Has reconfirmado tu asistencia exitosamente.");
! 142       setActualizacion((v) => v + 1);
  143     } catch (err) {
! 144       setError(err.message);
  145     } finally {
! 146       setProcesando(null);
  147     }
  148   }
  149 
  150   // --- TAREA 7: Guardar reprogramación desde el organizador ---
! 151   async function guardarReprogramacion(e) {
! 152     e.preventDefault();
! 153     if (!modalReprogramar) return;
! 154     setGuardandoReprog(true);
! 155     setError("");
! 156     setMensaje("");
! 157     try {
! 158       const res = await apiRequest(`/sesiones/${modalReprogramar.id}/reprogramar`, {
  159         method: "POST",
  160         body: JSON.stringify({ nueva_fecha: reprogFecha, motivo: reprogMotivo }),
  161       });
! 162       setMensaje(res.mensaje || "Sesión reprogramada correctamente.");
! 163       setModalReprogramar(null);
! 164       setActualizacion((v) => v + 1);
  165     } catch (err) {
! 166       setError(err.message);
  167     } finally {
! 168       setGuardandoReprog(false);
  169     }
  170   }
  171 
  172   // --- TAREA 9: Confirmar cancelación de sesión ---
! 173   async function confirmarCancelacionSesion(e) {
! 174     e.preventDefault();
! 175     if (!modalCancelar) return;
! 176     setCancelando(true);
! 177     setError("");
! 178     setMensaje("");
! 179     try {
! 180       const res = await apiRequest(`/sesiones/${modalCancelar.id}/cancelar`, {
  181         method: "POST",
  182         body: JSON.stringify({ motivo: motivoCancelacion }),
  183       });
! 184       setMensaje(res.mensaje || "Sesión cancelada formalmente.");
! 185       setModalCancelar(null);
! 186       setActualizacion((v) => v + 1);
  187     } catch (err) {
! 188       setError(err.message);
  189     } finally {
! 190       setCancelando(false);
  191     }
  192   }
  193 
  194   const pendientesOrganizador = solicitudesOrganizador.filter((s) => s.estado === "pendiente");
```


---


```
  673                                         className="btn btn-sm btn-outline-info w-100 fw-semibold"
  674                                         disabled={tieneReconf}
  675                                         title={tieneReconf ? "Bloqueado: hay participantes reconfirmando." : "Reprogramar fecha y motivo"}
  676                                         onClick={() => {
! 677                                           setModalReprogramar(sesion);
! 678                                           setReprogFecha("");
! 679                                           setReprogMotivo("");
  680                                         }}
  681                                       >
  682                                         📅 Reprogramar sesión {tieneReconf ? "(Bloqueado)" : ""}
  683                                       </button>
```


---


```
  688                                       <button
  689                                         type="button"
  690                                         className="btn btn-sm btn-outline-danger w-100 fw-semibold"
  691                                         onClick={() => {
! 692                                           setModalCancelar(sesion);
! 693                                           setMotivoCancelacion("");
  694                                         }}
  695                                         title="Cancelar definitivamente esta sesión de estudio con motivo obligatorio"
  696                                       >
  697                                         🚫 Cancelar sesión
```


---


```
  879                     type="button"
  880                     className="btn-close btn-close-white"
  881                     aria-label="Cerrar"
  882                     onClick={() => {
! 883                       setModalCancelar(null);
! 884                       setMotivoCancelacion("");
  885                     }}
  886                   />
  887                 </div>
  888                 <form onSubmit={confirmarCancelacionSesion}>
```


---


```
  921                     <button
  922                       type="button"
  923                       className="btn btn-outline-secondary"
  924                       onClick={() => {
! 925                         setModalCancelar(null);
! 926                         setMotivoCancelacion("");
  927                       }}
  928                     >
  929                       Volver sin cancelar
  930                     </button>
```


---



## frontend/src/fechas&#46;js

```
  25   let str = String(fechaIso).trim();
  26   // El backend guarda en UTC. Si la marca no trae zona horaria (Z u offset +/-),
  27   // se agrega 'Z' para que el navegador la interprete como UTC y reste las 4 horas de Bolivia.
  28   if (!str.endsWith("Z") && !str.includes("+") && !str.slice(10).includes("-")) {
! 29     str = str + "Z";
  30   }
  31   const fecha = new Date(str);
  32   // Un valor que no es una fecha se muestra tal cual en lugar de «Invalid Date».
  33   if (Number.isNaN(fecha.getTime())) return String(fechaIso);
```


---



## frontend/src/historialpage&#46;jsx

```
  169           sesionId={modalJustificar.id}
  170           sesionNombre={modalJustificar.nombre}
  171           onClose={() => setModalJustificar(null)}
  172           onSuccess={(msg) => {
! 173             setMensaje(msg);
! 174             setActualizacion((v) => v + 1);
  175           }}
  176         />
  177       )}
  178     </div>
```


---



## frontend/src/sesionspage&#46;jsx

```
  88           setMaterias(listaMaterias);
  89 
  90           // TAREA 9 (PARTE A): Registrar telemetría de búsquedas o filtros sin resultados (Diapositiva 11/13)
  91           if (lista.length === 0 && consulta) {
! 92             track("busqueda_sin_resultados", {
  93               materia: (filtros.materia || "general").toLowerCase(),
  94             });
  95           }
  96         }
```


---


```
  952           sesionId={modalJustificar.id}
  953           sesionNombre={modalJustificar.nombre}
  954           onClose={() => setModalJustificar(null)}
  955           onSuccess={(msg) => {
! 956             setMensaje(msg);
! 957             setActualizacion((v) => v + 1);
  958           }}
  959         />
  960       )}
```


---


