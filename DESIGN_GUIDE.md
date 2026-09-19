# Ladelos Website Redesign - Design Guide

## 🎨 Guía de Diseño y Especificaciones

Este documento describe el mockup del rediseño de la website pública de Ladelos, creado como prototipo en React. Utiliza una combinación de los estilos de **Gian Mauros** (colorido y divertido) y **Malvon** (estructura clara y profesional).

---

## 📐 Estructura General

### 1. **Header Sticky**
- **Color**: Azul Claro (#6AA0CF)
- **Elementos**:
  - Logo "Ladelos" (tipografía cursiva italic, blanco)
  - Menú hamburguesa (mobile first)
  - Menú de navegación desktop (Inicio, Menú, Merch, Contacto)

### 2. **Hero Section**
- **Background**: Gradiente (Azul Claro → Azul Oscuro)
- **Contenido**:
  - Emoji grande (🌮)
  - Título: "Pastelillos Artesanales" (42px, italic, bold)
  - Subtítulo descriptivo
  - CTA Button: "Realizar tu pedido →" (Naranja, 100% width en mobile)

### 3. **Menu Section**
- **Título**: "Nuestro Menú 🤤" (36px, bold, azul oscuro)
- **Tabs de Categorías**: Clásicos, Gourmet, Especiales
  - Active: Naranja
  - Inactive: Turquesa
- **Grid de Productos**:
  - 3 columnas (auto-fit, min 280px)
  - Fondo: Crema (#FFFBCC)
  - Borde: Azul Claro (3px solid)
  - Contenido: Emoji (48px), Nombre, Descripción, Nota de tiempo

### 4. **Merch Section**
- **Título**: "Merch Oficial 👕" (36px, bold)
- **Nota**: "Envío inmediato a cualquier lugar"
- **Grid de Productos**:
  - 4 columnas (auto-fit, min 250px)
  - Borde: Turquesa (2px solid)
  - Botón "Comprar": Naranja → Azul Oscuro on hover

### 5. **Contact Section**
- **Background**: Azul Claro
- **Elementos**:
  - Título "Contáctanos 💬"
  - Enlaces: Teléfono, Instagram, Ubicación
  - CTA Button: "Escribir por WhatsApp"

### 6. **Footer**
- **Background**: Azul Oscuro
- **Contenido**: Copyright

---

## 🎨 Paleta de Colores

| Nombre | Código | Pantone | Uso |
|--------|--------|---------|-----|
| Azul Claro | #6AA0CF | 2170 C | Header, Hero gradient start, Contact bg |
| Azul Oscuro | #063994 | 661 C | Hero gradient end, Footer bg, Textos heading |
| Turquesa | #7ECBE2 | 2225 C | Tabs, Borders, Merch cards |
| Naranja | #FFA035 | 2011 C | CTAs, Buttons, Active states |
| Crema | #FFFBCC | 9140 C | Menu item cards background |
| Blanco | #FFFFFF | - | Texto sobre colores, backgrounds |

---

## 📱 Responsiveness

- **Mobile**: 1 columna, header hamburguesa, padding 1rem
- **Tablet**: 2 columnas, navegación adaptada
- **Desktop**: 3-4 columnas, menú horizontal

---

## 🔤 Tipografía

- **Fuente Principal**: Belanosima (serif elegante)
- **Pesos**: 400, 600, 700
- **Tamaños**:
  - H1/Títulos hero: 42-48px
  - H2/Secciones: 36px
  - Body: 16px
  - Small/Tags: 12-14px

---

## 🛠️ Cómo Usar Este Mockup

### En Desarrollo Local
```bash
# Ver la website pública
npm run dev

# Si quieres forzar mostrar la website (ignorando login)
# Edita .env y usa: VITE_SHOW_WEBSITE=true
```

### Adaptar a Shopify

1. **Header**: Usa el header de Shopify con tu logo y navegación personalizada
2. **Hero**: Crea una sección "Hero Banner" con tu gradiente de fondo
3. **Menú Section**: Usa una "Grid Section" donde cada producto es una tarjeta no-clickeable
4. **Merch Section**: Usa "Product Grid" de Shopify con tu colección de Merch
5. **Contacto**: Crea una sección de contacto con formulario o enlaces

---

## ✨ Características Clave del Diseño

✅ **Colorido y Divertido** (como Gian Mauros)
- Paleta vibrante de 5 colores
- Uso de emojis para agregar personalidad
- Tipografía cursiva italic en títulos

✅ **Estructura Clara** (como Malvon)
- Jerarquía visual clara
- Secciones bien definidas
- Navegación intuitiva
- Botones CTA destacados

✅ **E-Commerce Funcional**
- Catálogo ilustrativo SIN carrito (solo información)
- Merch con botones de compra directa
- Diferenciación clara: Menú (2 días anticipación) vs Merch (envío inmediato)

---

## 📝 Cambios Necesarios para Shopify

### Datos Dinámicos a Reemplazar
- [ ] Teléfono: +1 (787) 123-4567 → Tu número real
- [ ] Instagram: @ladelospr → Tu handle real
- [ ] Ubicación: San Juan, PR → Tu dirección
- [ ] Menú de productos: Actualizar con tus productos reales
- [ ] Merch items: Conectar con tu colección Shopify POD

### Configuraciones Necesarias
- [ ] Conectar colección de Merch a Shopify
- [ ] Configurar integración con POD (Printful, Gooten, etc.)
- [ ] Habilitar carrito para Merch
- [ ] Crear página de contacto/pedidos para Menú

---

## 🚀 Próximos Pasos

1. **Revisar mockup** en desarrollo local
2. **Dar feedback** sobre colores, estructura, contenido
3. **Exportar diseño a Shopify** usando este mockup como referencia
4. **Conectar datos reales** (productos, precios, links)
5. **Configurar integraciones** (POD, pagos, envíos)

---

**Creado para Ladelos Pastelillos con ❤️ y Python (Claude)**
