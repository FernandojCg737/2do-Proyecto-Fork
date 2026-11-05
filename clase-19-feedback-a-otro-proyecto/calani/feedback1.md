# Feedback a otro proyecto - Clase 19

- **Nombre completo del evaluador:** 
- **Mi grupo y caso de estudio:** 
- **Grupo y caso de estudio evaluado:** Aranibar-Presupuesto Estudiantil
- **Integrantes del proyecto evaluado:** Carmen Jenifer Aranibar Fernandez
- **URL de la app y repositorio evaluado:** [https://github.com/Carmen21-A/FORK-PROYECTO2-IHC](https://github.com/Carmen21-A/FORK-PROYECTO2-IHC)
- **Fecha y versión/commit probado (si está disponible):** 04/11/2026 - Commit `d9281aabed84b2b83e44cb4c6da4fc4d73b01863`

---

## Primera impresión
¿Qué entendí al entrar? ¿Qué me confundió?

- **¿Qué entendí al entrar?:**  
  Al entrar con el usuario de prueba se entiende directo que es una app para que los universitarios gestionemos nuestro presupuesto. En la parte de arriba te muestra cuánto tienes de límite en el mes, lo que vas gastando y lo que te sobra con una barra visual, y abajo la lista con gastos en rojo e ingresos en verde.

- **¿Qué me confundió?:**  
  - Quise buscar directamente por categoría (Comida) y no la veía; tuve que buscar hasta darme cuenta de que estaba escondida dentro de un botón llamado `"Más filtros"`.
  - En la lista, cada movimiento tiene un cuadrito que dice `pendiente` o `pagado`. Parece una simple etiqueta de texto informativo, no se nota a primera vista que es un botón interactivo que cambia de estado al presionarlo.

---

## Funcionalidad asignada y resultado
Describir la tarea indicada por el docente.

### 📌 Funcionalidad 1 (Asignada por el docente)
**Descripción de la tarea:**  
Registrar un gasto con categoría y buscarlo con un filtro.  
*Resultado esperado:* El gasto aparece, el total cambia y el filtro permite encontrarlo.

**Marcar solo una opción:**
- [x] La completé sin ayuda.  
  *Detalle:* Le di al botón "+ Nuevo Movimiento", registré un gasto de 25.5 Bs en categoría "Comida" ("Almuerzo") y al guardar el total subió de 40 a 65.5 Bs de inmediato. Luego escribí "Almuerzo" en el buscador y el filtro me aisló solo ese gasto sin problemas.
- [ ] La completé con ayuda. ¿Cuál?
- [ ] No pude completarla. ¿Dónde me detuve?

---

### 📌 Funcionalidad 2 (Elegida por mí)
**Descripción de la tarea:**  
Definir un presupuesto por categoría y ver cómo se va consumiendo.

**Marcar solo una opción:**
- [x] La completé sin ayuda.  
  *Detalle:* Entré a "Presupuestos por Categoría", elegí "Comida" (que estaba sin presupuesto fijado) y le asigné 200 Bs. Al guardar, calculó al tiro el 33% consumido frente a los gastos que ya tenía y la barra de progreso se pintó en verde.
- [ ] La completé con ayuda. ¿Cuál?
- [ ] No pude completarla. ¿Dónde me detuve?

---

## Qué no funcionó
Pasos, resultado esperado y resultado observado.  
Si todo funcionó, indicarlo. Adjuntar captura si ayuda.

### 🔍 Funcionalidad 1 (Gasto con categoría y filtro)
1. **Filtro de categoría poco accesible:**  
   - *Pasos:* Querer filtrar la lista solo por gastos de "Comida".  
   - *Resultado esperado:* Tener las categorías a la mano en la pantalla principal.  
   - *Resultado observado:* Tienes que abrir obligatoriamente "Más filtros". Si cierras ese menú, no muestra ningún aviso de que hay un filtro activo puesto.
2. **Búsqueda vacía sin botón para volver:**  
   - *Pasos:* Buscar una palabra inexistente (ej. "Fotocopias").  
   - *Resultado esperado:* Un botón claro en medio de la pantalla para "Limpiar búsqueda".  
   - *Resultado observado:* Sale el texto "No hay movimientos...", pero te obliga a buscar una cruz chiquita arriba en un chip para quitar el filtro.

### 🔍 Funcionalidad 2 (Presupuesto por Categoría)
1. **Incómodo para volver al mes actual:**  
   - *Pasos:* Moverse varios meses atrás con las flechas `<` y `>`.  
   - *Resultado esperado:* Un botón rápido de "Mes actual" o "Hoy".  
   - *Resultado observado:* Tienes que dar clic hacia adelante mes por mes tantas veces como meses hayas retrocedido.
2. **Sin referencia de meses anteriores:**  
   - *Pasos:* Abrir el formulario para definir un presupuesto nuevo.  
   - *Resultado esperado:* Que te sugiera o muestre cuánto gastaste el mes pasado en esa categoría.  
   - *Resultado observado:* Sale en blanco, obligándote a recordar de memoria antes de poner el monto.

---

## Qué mejoraría y por qué
Una propuesta concreta relacionada con la experiencia.

1. **Chips directos de categorías debajo del buscador:**  
   Poner las categorías principales (Comida, Transporte, etc.) como botoncitos visibles sin tener que abrir "Más filtros", ya que como estudiante es lo que más se usa para filtrar.
2. **Botón "Limpiar búsqueda" en el estado vacío:**  
   Si una búsqueda no arroja resultados, colocar un botón centrado para restaurar la lista con un solo toque.
3. **Botón "Mes actual" en Presupuestos:**  
   Un enlace rápido al lado del mes para regresar al período en curso en un segundo tras revisar meses anteriores.

---

## Qué quitaría y por qué
Si no quitaría nada, explicar por qué.

- **Quitar el cartel emergente (modal) al cancelar un gasto:**  
  Al pasar un gasto a "cancelado" sale una ventana modal que interrumpe la navegación. Sería más ágil cancelarlo directamente y mostrar abajo un mensaje con botón de **"Deshacer"** por unos 5 segundos por si fue un clic por error.
