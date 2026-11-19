import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return RGBColor(*(int(hex_str[i:i+2], 16) for i in (0, 2, 4)))

# Paleta de diseño institucional StudyMatch (Tokens semánticos Figma)
C_BG_DARK = hex_to_rgb('#090d16')       # Slate ultra profundo
C_HERO_BG = hex_to_rgb('#111827')       # Slate 900
C_CARD_BG = hex_to_rgb('#151e32')       # Slate 800 enriquecido
C_PRIMARY = hex_to_rgb('#4f46e5')       # Indigo 600
C_ACCENT = hex_to_rgb('#6366f1')        # Indigo 500
C_TEXT_LIGHT = hex_to_rgb('#f8fafc')    # Slate 50
C_TEXT_MUTED = hex_to_rgb('#94a3b8')    # Slate 400
C_SUCCESS = hex_to_rgb('#10b981')       # Emerald 500
C_WARNING = hex_to_rgb('#f59e0b')       # Amber 500
C_BORDER = hex_to_rgb('#26354f')        # Slate 700 refinado
C_BUTTON_PLAY = hex_to_rgb('#059669')   # Emerald 600

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DOCS_FIGMA = os.path.join(ROOT, 'docs', 'informe', 'figma')
OUT_DIR = os.path.abspath('D:/INTERACCION HOMBRE-COMPUTADOR/Presentables 2do proyecto')
os.makedirs(OUT_DIR, exist_ok=True)

# Rutas verificadas para video y póster
video_file = os.path.join(OUT_DIR, 'video_defensa_completo.mp4')
if not os.path.exists(video_file):
    video_file = os.path.join(OUT_DIR, 'videos_defensa', 'video_defensa_completo.mp4')

poster_file = os.path.join(OUT_DIR, 'poster_video.png')
if not os.path.exists(poster_file):
    poster_file = os.path.join(ROOT, 'videos_defensa', 'poster_video.png')

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
blank_layout = prs.slide_layouts[6]

def set_slide_background(slide):
    bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), prs.slide_width, prs.slide_height)
    bg.fill.solid()
    bg.fill.fore_color.rgb = C_BG_DARK
    bg.line.fill.background()
    return bg

def add_header(slide, tag_text, title_text, subtitle_text=None):
    tag_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.4), Inches(11.733), Inches(0.35))
    tf_tag = tag_box.text_frame
    tf_tag.word_wrap = True
    p_tag = tf_tag.paragraphs[0]
    p_tag.text = tag_text.upper()
    p_tag.font.size = Pt(11)
    p_tag.font.bold = True
    p_tag.font.color.rgb = C_ACCENT
    p_tag.font.name = 'Segoe UI'

    title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.72), Inches(11.733), Inches(0.65))
    tf_t = title_box.text_frame
    tf_t.word_wrap = True
    p_t = tf_t.paragraphs[0]
    p_t.text = title_text
    p_t.font.size = Pt(25)
    p_t.font.bold = True
    p_t.font.color.rgb = C_TEXT_LIGHT
    p_t.font.name = 'Segoe UI'

    if subtitle_text:
        sub_box = slide.shapes.add_textbox(Inches(0.8), Inches(1.35), Inches(11.733), Inches(0.45))
        tf_s = sub_box.text_frame
        tf_s.word_wrap = True
        p_s = tf_s.paragraphs[0]
        p_s.text = subtitle_text
        p_s.font.size = Pt(12)
        p_s.font.color.rgb = C_TEXT_MUTED
        p_s.font.name = 'Segoe UI'

def add_card(slide, left, top, width, height, title, items, icon="🔹", bg_color=C_CARD_BG, border_color=C_BORDER):
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = bg_color
    card.line.color.rgb = border_color
    card.line.width = Pt(1.5)

    tf = card.text_frame
    tf.word_wrap = True
    tf.margin_left = Inches(0.25)
    tf.margin_right = Inches(0.25)
    tf.margin_top = Inches(0.22)
    tf.margin_bottom = Inches(0.22)

    p0 = tf.paragraphs[0]
    p0.text = f"{icon}  {title}"
    p0.font.size = Pt(14)
    p0.font.bold = True
    p0.font.color.rgb = C_TEXT_LIGHT
    p0.font.name = 'Segoe UI'
    p0.space_after = Pt(8)

    for item in items:
        p = tf.add_paragraph()
        p.text = f"•  {item}"
        p.font.size = Pt(11.5)
        p.font.color.rgb = C_TEXT_MUTED
        p.font.name = 'Segoe UI'
        p.space_after = Pt(5)

def set_slide_notes(slide, notes_text):
    notes = slide.notes_slide
    text_frame = notes.notes_text_frame
    text_frame.text = notes_text

print("Construyendo Diapositivas Ajustadas (Carátula Limpia + Figma Acortado)...")

# ==============================================================================
# DIAPOSITIVA 1: Portada Limpia y Elegante (Solo Datos Clave, Logo y Título)
# ==============================================================================
s1 = prs.slides.add_slide(blank_layout)
set_slide_background(s1)

# Barra Superior Institucional
inst_bar = s1.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0), Inches(0), prs.slide_width, Inches(0.65))
inst_bar.fill.solid()
inst_bar.fill.fore_color.rgb = hex_to_rgb('#0d1527')
inst_bar.line.color.rgb = hex_to_rgb('#1e2d4d')
inst_bar.line.width = Pt(1)

tf_inst = inst_bar.text_frame
tf_inst.word_wrap = True
p_inst = tf_inst.paragraphs[0]
p_inst.text = "🏛️ UNIVERSIDAD AUTÓNOMA GABRIEL RENÉ MORENO · FACULTAD DE CIENCIAS DE LA COMPUTACIÓN Y TELECOMUNICACIONES"
p_inst.font.size = Pt(11)
p_inst.font.bold = True
p_inst.font.color.rgb = hex_to_rgb('#93c5fd')
p_inst.font.name = 'Segoe UI'
p_inst.alignment = PP_ALIGN.CENTER

# Contenedor Central Hero (Limpio y Espacioso)
hero_container = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.8), Inches(1.2), Inches(9.733), Inches(3.5))
hero_container.fill.solid()
hero_container.fill.fore_color.rgb = C_HERO_BG
hero_container.line.color.rgb = C_BORDER
hero_container.line.width = Pt(1.5)

# Logo Centrado dentro del Contenedor Hero (Logo colocado por el usuario, aspect 4.42)
logo_path = os.path.join(DOCS_FIGMA, '01-logo.png')
if os.path.exists(logo_path):
    # ancho = 5.2 in -> alto = 5.2 / 4.42 = 1.18 in
    # centrado en el slide: (13.333 - 5.2) / 2 = 4.066 in
    s1.shapes.add_picture(logo_path, Inches(4.066), Inches(1.6), width=Inches(5.2))

# Título Principal y Subtítulo
title_box = s1.shapes.add_textbox(Inches(2.0), Inches(3.1), Inches(9.333), Inches(1.4))
tf_tit = title_box.text_frame
tf_tit.word_wrap = True

p1 = tf_tit.paragraphs[0]
p1.text = "StudyMatch: Plataforma Académica Colaborativa"
p1.font.size = Pt(27)
p1.font.bold = True
p1.font.color.rgb = C_TEXT_LIGHT
p1.font.name = 'Segoe UI'
p1.alignment = PP_ALIGN.CENTER
p1.space_after = Pt(4)

p2 = tf_tit.add_paragraph()
p2.text = "Diseño Centrado en el Usuario · Interacción Ética · Accesibilidad Universal"
p2.font.size = Pt(13.5)
p2.font.bold = True
p2.font.color.rgb = C_ACCENT
p2.font.name = 'Segoe UI'
p2.alignment = PP_ALIGN.CENTER

# Tarjeta Inferior de Datos de la Exposición (Expositor, Materia y Carrera)
meta_card = s1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(2.5), Inches(5.0), Inches(8.333), Inches(1.9))
meta_card.fill.solid()
meta_card.fill.fore_color.rgb = C_CARD_BG
meta_card.line.color.rgb = C_BORDER
meta_card.line.width = Pt(1.5)

tf_meta = meta_card.text_frame
tf_meta.word_wrap = True
tf_meta.margin_top = Inches(0.2)
tf_meta.margin_bottom = Inches(0.2)

p_mat = tf_meta.paragraphs[0]
p_mat.text = "📚 MATERIA: Interacción Hombre-Computador (IHC 2026-2)"
p_mat.font.size = Pt(13)
p_mat.font.bold = True
p_mat.font.color.rgb = hex_to_rgb('#818cf8')
p_mat.font.name = 'Segoe UI'
p_mat.alignment = PP_ALIGN.CENTER
p_mat.space_after = Pt(4)

p_exp = tf_meta.add_paragraph()
p_exp.text = "👨‍💻 EXPOSITOR: Fernando Calani García"
p_exp.font.size = Pt(16)
p_exp.font.bold = True
p_exp.font.color.rgb = C_TEXT_LIGHT
p_exp.font.name = 'Segoe UI'
p_exp.alignment = PP_ALIGN.CENTER
p_exp.space_after = Pt(4)

p_car = tf_meta.add_paragraph()
p_car.text = "🏛️ CARRERA: Ingeniería Informática · FICCT - UAGRM"
p_car.font.size = Pt(12)
p_car.font.color.rgb = C_TEXT_MUTED
p_car.font.name = 'Segoe UI'
p_car.alignment = PP_ALIGN.CENTER
p_car.space_after = Pt(4)

p_def = tf_meta.add_paragraph()
p_def.text = "⏱️ Defensa Final de Proyecto 2 · Tiempo Límite: 10 Minutos"
p_def.font.size = Pt(12)
p_def.font.bold = True
p_def.font.color.rgb = C_SUCCESS
p_def.font.name = 'Segoe UI'
p_def.alignment = PP_ALIGN.CENTER

set_slide_notes(s1,
"GUION DE APERTURA (00:00 - 00:45) - MEMORIZAR ESTAS 2 FRASES:\n"
"1. 'Buenos días estimado docente y tribunal. Soy Fernando Calani García y hoy presento la defensa de StudyMatch.'\n"
"2. 'El 85% de los grupos de estudio universitarios colapsan en WhatsApp por desorden y amiguismo en los cupos. StudyMatch convierte ese caos en un contrato de interacción ético, transparente y predecible.'"
)

# ==============================================================================
# DIAPOSITIVA 2: Problema Real vs. Reglas Éticas de Interacción
# ==============================================================================
s2 = prs.slides.add_slide(blank_layout)
set_slide_background(s2)
add_header(s2, "Arquitectura de Interacción & Propuesta de Valor", "El Problema Real de los Estudiantes y las 4 Reglas Éticas", "Transformamos la informalidad de WhatsApp en un contrato de interacción transparente, predecible y equitativo")

add_card(s2, Inches(0.8), Inches(2.0), Inches(3.64), Inches(4.9), "Tarea 6 · Espera FIFO", [
    "Problema: Asignación arbitraria de cupos por amiguismo o lentitud en WhatsApp.",
    "Solución Ética: Fila ordinal estricta (#1, #2) auditada en backend.",
    "Ascenso Automático: Al cancelarse un cupo, el primero en espera asciende de inmediato.",
    "Transparencia: Contador de posición visible en tiempo real."
], "⏳")

add_card(s2, Inches(4.84), Inches(2.0), Inches(3.64), Inches(4.9), "Tarea 7 · Reprogramación", [
    "Problema: Cambios imprevistos de fecha que perjudican a inscritos organizados.",
    "Solución Ética: Motivo explicativo obligatorio y fecha estrictamente futura.",
    "Reconfirmación: Los inscritos retienen su plaza pero deciden si aceptan la nueva fecha.",
    "Bloqueo Preventivo: Impide reprogramar otra vez si hay confirmaciones pendientes."
], "📅")

add_card(s2, Inches(8.88), Inches(2.0), Inches(3.64), Inches(4.9), "Tareas 8, 9 & 10 · Asistencia y Salida", [
    "Tarea 8 (Asistencia): Registro inmutable y resolución formal de inasistencias con motivo.",
    "Tarea 9 (Cancelación): Aviso forzoso con motivo visible a los postulantes.",
    "Tarea 10 (Salida Honesta): Principio de la Clase 22: descarga íntegra en JSON/CSV.",
    "Bloqueo Protector: Impide borrar cuenta si hay compromisos activos."
], "🛡️")

set_slide_notes(s2,
"GUION PROBLEMA Y REGLAS (00:45 - 02:00) - 3 IDEAS CLAVE:\n"
"1. Fila FIFO: 'Equidad total. Nadie se salta la cola y el ascenso es automático.'\n"
"2. Reprogramación: 'Se respeta el tiempo ajeno. Motivo obligatorio y reconfirmación.'\n"
"3. Salida Honesta: 'Cero trampas. Si un usuario quiere irse, descarga sus datos en un clic.'"
)

# ==============================================================================
# DIAPOSITIVA 3: Figma y Accesibilidad WCAG (ACORTADO, VISUAL Y FÁCIL DE MEMORIZAR)
# ==============================================================================
s3 = prs.slides.add_slide(blank_layout)
set_slide_background(s3)
add_header(s3, "Tokens de Diseño & Accesibilidad Universal", "Diseño en Figma y Calidad WCAG 2.1 AA", "Tokens semánticos sincronizados al 100% y puntuación perfecta (100/100) en Lighthouse")

# Columna Izquierda: Tokens Semánticos (Acortado a 3 viñetas concisas)
add_card(s3, Inches(0.8), Inches(2.0), Inches(5.7), Inches(2.3), "Tokens Semánticos (Figma ↔ CSS)", [
    "Mapeo 1:1: Variables de Figma traducidas directo a tokens.css.",
    "Cero Colores Fijos: Ningún color hexadecimal hardcodeado en React.",
    "Modo Claro y Oscuro: Alternancia dinámica instantánea y fluida."
], "🎨")

# Imagen de botones en columna izquierda (Dimensionada: alto 2.2 in, ancho 4.42 in)
f_btn = os.path.join(DOCS_FIGMA, '05-boton-3-tipos-6-estados.png')
if os.path.exists(f_btn):
    s3.shapes.add_picture(f_btn, Inches(1.44), Inches(4.5), width=Inches(4.42), height=Inches(2.2))

# Columna Derecha: Accesibilidad WCAG 2.1 AA (Acortado a 3 viñetas concisas)
add_card(s3, Inches(6.8), Inches(2.0), Inches(5.7), Inches(2.3), "Accesibilidad WCAG 2.1 AA", [
    "100/100 Google Lighthouse: Máxima nota en accesibilidad.",
    "Contraste > 4.5:1: Legibilidad verificada para todo usuario.",
    "Navegación por Teclado: Foco visual visible (outline 2px) en cada control."
], "♿")

# Imagen de tema claro/oscuro en columna derecha
f_tema = os.path.join(DOCS_FIGMA, '08-tema-claro-oscuro.png')
if os.path.exists(f_tema):
    s3.shapes.add_picture(f_tema, Inches(7.06), Inches(4.5), width=Inches(5.18), height=Inches(1.2))

# Barra KPI de métricas en columna derecha
kpi_bar = s3.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6.8), Inches(5.85), Inches(5.7), Inches(0.85))
kpi_bar.fill.solid()
kpi_bar.fill.fore_color.rgb = hex_to_rgb('#064e3b')
kpi_bar.line.color.rgb = C_SUCCESS
kpi_bar.line.width = Pt(1.5)

tf_kpi = kpi_bar.text_frame
tf_kpi.word_wrap = True
p_kpi = tf_kpi.paragraphs[0]
p_kpi.text = "🎯 Google Lighthouse: 100 / 100 en Accesibilidad"
p_kpi.font.size = Pt(12)
p_kpi.font.bold = True
p_kpi.font.color.rgb = hex_to_rgb('#a7f3d0')
p_kpi.font.name = 'Segoe UI'
p_kpi.alignment = PP_ALIGN.CENTER

p_kpi2 = tf_kpi.add_paragraph()
p_kpi2.text = "Contraste > 4.5:1  ·  Foco Teclado 2px  ·  Roles ARIA Nativos"
p_kpi2.font.size = Pt(10)
p_kpi2.font.color.rgb = C_TEXT_LIGHT
p_kpi2.font.name = 'Segoe UI'
p_kpi2.alignment = PP_ALIGN.CENTER

set_slide_notes(s3,
"GUION FIGMA Y ACCESIBILIDAD (02:00 - 02:45) - MEMORIZAR ESTOS 3 PUNTOS:\n"
"1. 'Diseñamos primero en Figma y trasladamos cada variable directamente a tokens.css; no hay colores fijos en código.'\n"
"2. 'Soportamos Modo Claro y Oscuro de manera nativa e instantánea.'\n"
"3. 'Obtuvimos 100 sobre 100 en Google Lighthouse Accesibilidad, garantizando navegación total por teclado y contrastes legibles.'"
)

# ==============================================================================
# DIAPOSITIVA 4: Demostración Integral en Video (06:43 min con botones de acción)
# ==============================================================================
s4 = prs.slides.add_slide(blank_layout)
set_slide_background(s4)
add_header(s4, "Demostración Interactiva del Sistema · 06:43 min", "Demostración Integral en Video de los 8 Flujos", "Recorrido funcional continuo con cursor interactivo, clics guiados y separadores de título por flujo evaluado")

if os.path.exists(video_file) and os.path.exists(poster_file):
    try:
        s4.shapes.add_movie(
            movie_file=video_file,
            left=Inches(0.8),
            top=Inches(1.9),
            width=Inches(7.8),
            height=Inches(4.4),
            poster_frame_image=poster_file,
            mime_type='video/mp4'
        )
    except Exception as e:
        s4.shapes.add_picture(poster_file, Inches(0.8), Inches(1.9), width=Inches(7.8), height=Inches(4.4))
else:
    if os.path.exists(poster_file):
        s4.shapes.add_picture(poster_file, Inches(0.8), Inches(1.9), width=Inches(7.8), height=Inches(4.4))

# Botón 1 de Respaldo: Reproducir Video Externo en Pantalla Completa (1 Clic)
btn_play = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(0.8), Inches(6.45), Inches(4.3), Inches(0.65))
btn_play.fill.solid()
btn_play.fill.fore_color.rgb = C_BUTTON_PLAY
btn_play.line.color.rgb = hex_to_rgb('#34d399')
btn_play.line.width = Pt(1.5)
btn_play.click_action.hyperlink.address = "videos_defensa/video_defensa_completo.mp4"

tf_bp = btn_play.text_frame
tf_bp.word_wrap = True
p_bp = tf_bp.paragraphs[0]
p_bp.text = "▶ REPRODUCIR VIDEO EN PANTALLA COMPLETA"
p_bp.font.size = Pt(11)
p_bp.font.bold = True
p_bp.font.color.rgb = RGBColor(255, 255, 255)
p_bp.font.name = 'Segoe UI'
p_bp.alignment = PP_ALIGN.CENTER

# Botón 2 de Respaldo: Abrir Diapositivas Interactivas Web (HTML5)
btn_web = s4.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(5.3), Inches(6.45), Inches(3.3), Inches(0.65))
btn_web.fill.solid()
btn_web.fill.fore_color.rgb = C_PRIMARY
btn_web.line.color.rgb = C_ACCENT
btn_web.line.width = Pt(1.5)
btn_web.click_action.hyperlink.address = "presentacion_interactiva.html"

tf_bw = btn_web.text_frame
tf_bw.word_wrap = True
p_bw = tf_bw.paragraphs[0]
p_bw.text = "🌐 ABRIR EN NAVEGADOR (HTML5)"
p_bw.font.size = Pt(11)
p_bw.font.bold = True
p_bw.font.color.rgb = RGBColor(255, 255, 255)
p_bw.font.name = 'Segoe UI'
p_bw.alignment = PP_ALIGN.CENTER

# Panel Lateral de Capítulos Evaluados
add_card(s4, Inches(8.88), Inches(1.9), Inches(3.64), Inches(5.2), "Capítulos Evaluados en el Video", [
    "01. Login y Catálogo reactivo",
    "02. Tarea 6 · Fila de Espera FIFO",
    "03. Tarea 7 · Reprogramación Ética",
    "04. Tarea 8 · Asistencia e inasistencias",
    "05. Tarea 9 · Cancelación transparente",
    "06. Clase 22 · Cero falsa urgencia",
    "07. Tarea 10 · Salida honesta (JSON/CSV)",
    "08. Responsivo móvil (Menú 390px)"
], "📑")

set_slide_notes(s4,
"GUION VIDEO (02:45 - 07:30) - GUÍA VISUAL:\n"
"'Ahora veremos la demostración en video con cursor guiado cubriendo los 8 flujos del proyecto:'\n"
"1. Catálogo con filtros reactivos.\n"
"2. Fila FIFO: ver el indicador #1 y el ascenso automático.\n"
"3. Reprogramación: motivo obligatorio y reconfirmación.\n"
"4. Asistencia: justificaciones con causa.\n"
"5. Cancelación con aviso público.\n"
"6. Clase 22: cálculo real de cupos sin falsa urgencia.\n"
"7. Tarea 10: descarga de expediente en un clic.\n"
"8. Móvil: menú hamburguesa y botones accesibles en 390px."
)

# ==============================================================================
# DIAPOSITIVA 5: Decisiones de Interacción y Clase 22 (Diseño Ético)
# ==============================================================================
s5 = prs.slides.add_slide(blank_layout)
set_slide_background(s5)
add_header(s5, "Principios de Diseño & Ética en IHC", "Decisiones de Interacción y Erradicación de Patrones Oscuros", "Fundamentación teórica en Leyes de Fitts, Hick, Nielsen y Principio de Honestidad (Clase 22)")

add_card(s5, Inches(0.8), Inches(2.0), Inches(5.7), Inches(4.9), "Psicología de IHC y Leyes Cognitivas", [
    "Ley de Fitts: Botones táctiles mínimos de 44px de alto para evitar errores en móvil.",
    "Ley de Hick: Búsqueda con 3 filtros simples (materia, modalidad, periodo) para agilizar decisiones.",
    "Heurística #1 de Nielsen: Visibilidad continua del estado con loaders y feedback en contexto.",
    "Ley de Proximidad de Gestalt: Agrupación visual lógica entre tarjetas y sus acciones directas."
], "🧠")

add_card(s5, Inches(6.8), Inches(2.0), Inches(5.7), Inches(4.9), "Erradicación de Patrones Oscuros (Clase 22)", [
    "Cero Falsa Urgencia: Prohibido mentir con '¡Quedan 2 cupos!'; disponibilidad matemática real.",
    "Cero Confirmshaming: Diálogos neutros y respetuosos; sin mensajes culpabilizadores al cancelar.",
    "Salida Honesta (Tarea 10): Descarga directa del expediente en JSON/CSV sin laberintos de baja.",
    "Telemetría Ética (/analitica): Monitoreo de deserciones sin recopilar datos personales invasivos."
], "⚖️")

set_slide_notes(s5,
"GUION LEYES IHC Y ÉTICA (07:30 - 08:30) - 2 IDEAS CLAVE:\n"
"1. 'Aplicamos Fitts con botones de 44px e Hick con filtros sencillos para reducir la carga mental.'\n"
"2. 'Aplicamos la Clase 22: No mentimos con cupos falsos y respetamos la libertad del estudiante con salida honesta.'"
)

# ==============================================================================
# DIAPOSITIVA 6: Resultados, Cobertura E2E 100% y Cierre de Impacto
# ==============================================================================
s6 = prs.slides.add_slide(blank_layout)
set_slide_background(s6)
add_header(s6, "Garantía de Calidad & Cierre Ejecutivo", "Resultados Técnicos, Cobertura E2E 100% y Conclusiones", "Verificación formal diff-cover al 100% y viabilidad del producto en el ecosistema universitario")

add_card(s6, Inches(0.8), Inches(2.0), Inches(5.7), Inches(4.9), "Cobertura Automatizada & Resiliencia Técnica", [
    "100% diff-cover verificado sobre todas las líneas modificadas en el repositorio fork.",
    "39 pruebas automáticas Playwright E2E cubriendo casos de éxito, límites y validaciones.",
    "Concurrencia validada: Pruebas multi-usuario simulado para ascensos en la fila FIFO.",
    "Evidencias auditables archivadas en el reporte HTML docs/cobertura/index.html."
], "🧪")

add_card(s6, Inches(6.8), Inches(2.0), Inches(5.7), Inches(4.9), "Por Qué StudyMatch es un Producto Ganador", [
    "Solución Inmediata: Elimina el desorden de WhatsApp en la facultad con un contrato justo.",
    "Fidelidad de Diseño: 100% de paridad con las maquetas y variables de Figma.",
    "Ingeniería Ética: Software educativo formal que respeta la dignidad del estudiante.",
    "¡Muchas gracias! Espacio abierto para preguntas y comentarios del tribunal evaluador."
], "🎯")

set_slide_notes(s6,
"GUION CIERRE (08:30 - 09:30) - FRASE FINAL:\n"
"'StudyMatch está respaldado por 100% de cobertura en diff-cover y 39 tests de Playwright. Demuestra que el software académico puede ser eficiente y a la vez profundamente ético. Quedo a su disposición para preguntas. ¡Muchas gracias!'"
)

out_pptx = os.path.join(OUT_DIR, 'Defensa_Proyecto2_IHC.pptx')
out_pptx_fork = os.path.join(ROOT, 'Defensa_Proyecto2_IHC.pptx')

prs.save(out_pptx)
prs.save(out_pptx_fork)

print(f"\n✓ Presentación PowerPoint regenerada exitosamente:")
print(f"  - Tamaño final: {os.path.getsize(out_pptx):,} bytes ({os.path.getsize(out_pptx)/(1024*1024):.2f} MB)")
print(f"  - Destino 1: {out_pptx}")
print(f"  - Destino 2: {out_pptx_fork}")
