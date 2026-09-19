import { useState } from 'react'
import { Menu, X } from 'lucide-react'

const BRAND_COLORS = {
  azulClaro: '#6AA0CF',
  azulOscuro: '#063994',
  turquesa: '#7ECBE2',
  naranja: '#FFA035',
  crema: '#FFFBCC',
  white: '#FFFFFF',
  dark: '#1a1a1a',
  rosaClaro: '#FFB6D9',
  verdeClaro: '#A8D8BA',
}

const MENU_ITEMS = {
  'Clásicos': [
    { id: 1, name: 'Pastelillo de Carne', desc: 'Carne molida, queso americano y verduras fritas', image: '🥟' },
    { id: 2, name: 'Pastelillo de Queso', desc: 'Queso fresco y crema, receta tradicional puertorriqueña', image: '🧀' },
    { id: 3, name: 'Pastelillo de Jamón y Queso', desc: 'Jamón serrano premium, queso y pimienta', image: '🍖' },
  ],
  'Gourmet': [
    { id: 4, name: 'Pastelillo Camarones', desc: 'Camarones frescos, cilantro y limón fresco', image: '🦐' },
    { id: 5, name: 'Pastelillo Picante Crab', desc: 'Cangrejo de roca, especias picantes y sriracha', image: '🦀' },
    { id: 6, name: 'Pastelillo Relleno Mixto', desc: 'Combinación especial de carnes y quesos', image: '🍖' },
  ],
  'Especiales': [
    { id: 7, name: 'Pastelillo Vegetariano', desc: 'Champiñones, espinaca fresca y queso ricotta', image: '🥬' },
    { id: 8, name: 'Pastelillo BBQ Cerdo', desc: 'Cerdo desmenuzado lentamente con salsa BBQ casera', image: '🍗' },
  ],
}

const MERCH_ITEMS = [
  { id: 101, name: 'Camiseta Clásica', price: '$25', image: '👕', category: 'Ropa', color: BRAND_COLORS.naranja },
  { id: 102, name: 'Gorra Ladelos', price: '$18', image: '🧢', category: 'Accesorios', color: BRAND_COLORS.turquesa },
  { id: 103, name: 'Taza Pastelillos', price: '$14', image: '☕', category: 'Hogar', color: BRAND_COLORS.azulClaro },
  { id: 104, name: 'Hoodie Premium', price: '$45', image: '🧥', category: 'Ropa', color: BRAND_COLORS.azulOscuro },
]

export default function WebsitePublica() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('Clásicos')

  const toggleCategory = (cat) => {
    setExpandedCategory(expandedCategory === cat ? null : cat)
  }

  return (
    <div style={{ fontFamily: "'Belanosima', serif", backgroundColor: BRAND_COLORS.white, minHeight: '100vh' }}>
      {/* HEADER */}
      <header style={{
        backgroundColor: BRAND_COLORS.azulClaro,
        padding: '1rem',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          {/* LOGO */}
          <div style={{
            fontSize: '28px',
            fontWeight: 900,
            color: BRAND_COLORS.white,
            fontStyle: 'italic',
            letterSpacing: '-1px',
          }}>
            Ladelos
          </div>

          {/* DESKTOP MENU */}
          <nav style={{ display: 'none' }}>
            <div style={{ display: 'flex', gap: '2rem', color: BRAND_COLORS.white }}>
              {['Inicio', 'Menú', 'Merch', 'Contacto'].map(item => (
                <button key={item} style={{
                  background: 'none',
                  border: 'none',
                  color: BRAND_COLORS.white,
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  {item}
                </button>
              ))}
            </div>
          </nav>

          {/* MOBILE MENU BUTTON */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: 'none',
              border: 'none',
              color: BRAND_COLORS.white,
              cursor: 'pointer',
              fontSize: '24px',
            }}
          >
            {menuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* MOBILE MENU */}
        {menuOpen && (
          <div style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: `2px solid ${BRAND_COLORS.white}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}>
            {['Inicio', 'Menú', 'Merch', 'Contacto'].map(item => (
              <button key={item} style={{
                background: 'none',
                border: 'none',
                color: BRAND_COLORS.white,
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                padding: '0.5rem 0',
              }}>
                {item}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* HERO - GIAN MAUROS STYLE */}
      <section style={{
        background: `linear-gradient(135deg, ${BRAND_COLORS.azulClaro} 0%, ${BRAND_COLORS.turquesa} 40%, ${BRAND_COLORS.naranja} 100%)`,
        padding: '5rem 1rem 4rem',
        textAlign: 'center',
        color: BRAND_COLORS.white,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative pastelillo elements */}
        <div style={{
          position: 'absolute',
          top: '5%',
          right: '5%',
          fontSize: '140px',
          opacity: 0.08,
          transform: 'rotate(-20deg)',
          animation: 'float 4s ease-in-out infinite',
        }}>🥟</div>
        <div style={{
          position: 'absolute',
          bottom: '8%',
          left: '3%',
          fontSize: '110px',
          opacity: 0.07,
          transform: 'rotate(30deg)',
          animation: 'float 5s ease-in-out infinite 0.5s',
        }}>✨</div>
        <div style={{
          position: 'absolute',
          top: '20%',
          left: '8%',
          fontSize: '90px',
          opacity: 0.06,
          animation: 'float 6s ease-in-out infinite 1s',
        }}>🍖</div>

        <div style={{ maxWidth: '680px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{
            fontSize: '80px',
            marginBottom: '1.5rem',
            animation: 'bounce 2.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
          }}>🥟</div>
          <h1 style={{
            fontSize: 'clamp(36px, 8vw, 56px)',
            fontWeight: 900,
            marginBottom: '1rem',
            fontStyle: 'italic',
            letterSpacing: '-1px',
            textShadow: '3px 3px 6px rgba(0,0,0,0.25)',
            lineHeight: 1.1,
          }}>
            Pastelillos Artesanales<br />Hechos con 💜
          </h1>
          <p style={{
            fontSize: '20px',
            marginBottom: '1rem',
            fontWeight: 800,
            textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
          }}>
            Más de 40 sabores auténticos
          </p>
          <p style={{
            fontSize: '16px',
            marginBottom: '2.5rem',
            lineHeight: 1.7,
            opacity: 0.98,
            maxWidth: '500px',
            margin: '0 auto 2.5rem',
          }}>
            Cada pastelillo es preparado diariamente en Puerto Rico con ingredientes frescos y amor. Desde clásicos tradicionales hasta creaciones gourmet, tenemos tu nuevo favorito.
          </p>

          <div style={{ display: 'flex', gap: '1.2rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <button style={{
              backgroundColor: BRAND_COLORS.naranja,
              color: BRAND_COLORS.white,
              border: 'none',
              padding: '1.2rem 2.5rem',
              fontSize: '17px',
              fontWeight: 800,
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              flex: '1',
              minWidth: '180px',
              maxWidth: '300px',
              boxShadow: '0 6px 20px rgba(255, 160, 53, 0.4)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.08) translateY(-2px)';
              e.target.style.boxShadow = '0 10px 30px rgba(255, 160, 53, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1) translateY(0)';
              e.target.style.boxShadow = '0 6px 20px rgba(255, 160, 53, 0.4)';
            }}
            >
              Realizar Pedido 🎉
            </button>
            <button style={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              color: BRAND_COLORS.azulOscuro,
              border: 'none',
              padding: '1.2rem 2.5rem',
              fontSize: '17px',
              fontWeight: 800,
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              flex: '1',
              minWidth: '180px',
              maxWidth: '300px',
              boxShadow: '0 4px 15px rgba(255,255,255,0.5)',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = BRAND_COLORS.white;
              e.target.style.transform = 'scale(1.08) translateY(-2px)';
              e.target.style.boxShadow = '0 10px 30px rgba(6, 57, 148, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'rgba(255,255,255,0.95)';
              e.target.style.transform = 'scale(1) translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(255,255,255,0.5)';
            }}
            >
              Ver Catálogo 📋
            </button>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-15px) rotate(-2deg); }
          50% { transform: translateY(-25px) rotate(0deg); }
          75% { transform: translateY(-15px) rotate(2deg); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(var(--rotation, 0deg)); }
          50% { transform: translateY(-20px) rotate(var(--rotation, 0deg)); }
        }

        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
      `}</style>

      {/* MENU SECTION - GIAN MAUROS COLORFUL STYLE */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 1rem 3rem',
        backgroundColor: '#fafafa',
        borderRadius: '0',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem',
          animation: 'slideInUp 0.6s ease-out',
        }}>
          <div style={{
            display: 'inline-block',
            fontSize: '13px',
            fontWeight: 800,
            color: BRAND_COLORS.naranja,
            marginBottom: '0.75rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}>
            ✨ Nuestros Favoritos ✨
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 6vw, 48px)',
            fontWeight: 900,
            marginBottom: '1rem',
            textAlign: 'center',
            color: BRAND_COLORS.azulOscuro,
            lineHeight: 1.1,
            fontStyle: 'italic',
          }}>
            Clásicos que nunca fallan
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#666',
            marginTop: '1rem',
            maxWidth: '500px',
            margin: '1rem auto 0',
          }}>
            Probados y aprobados por nuestros clientes. Recetas auténticas hechas con amor.
          </p>
        </div>

        {/* CATEGORY TABS - COLORFUL */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '3.5rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {Object.keys(MENU_ITEMS).map((cat, idx) => {
            const colors = [
              { bg: BRAND_COLORS.naranja, text: BRAND_COLORS.white },
              { bg: BRAND_COLORS.turquesa, text: BRAND_COLORS.white },
              { bg: BRAND_COLORS.azulClaro, text: BRAND_COLORS.white },
            ];
            const color = colors[idx];
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '1rem 2.2rem',
                  border: '3px solid transparent',
                  borderRadius: '50px',
                  fontSize: '16px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: selectedCategory === cat ? color.bg : '#f0f0f0',
                  color: selectedCategory === cat ? color.text : '#555',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: selectedCategory === cat ? `0 6px 20px ${color.bg}50` : '0 2px 8px rgba(0,0,0,0.08)',
                  transform: selectedCategory === cat ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* MENU ITEMS GRID - COLORFUL */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem',
        }}>
          {MENU_ITEMS[selectedCategory].map((item, idx) => {
            const bgColors = [BRAND_COLORS.crema, '#FFE5E5', '#E5F0FF', '#FFF5EB'];
            const borderColors = [BRAND_COLORS.naranja, BRAND_COLORS.turquesa, BRAND_COLORS.azulClaro, BRAND_COLORS.rosaClaro];
            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: bgColors[idx % 4],
                  borderRadius: '24px',
                  padding: '2.5rem 2rem',
                  border: `5px solid ${borderColors[idx % 4]}`,
                  textAlign: 'center',
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                  animation: `slideInUp 0.6s ease-out ${idx * 0.1}s backwards`,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-12px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 12px 35px rgba(0,0,0,0.18)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{ fontSize: '64px', marginBottom: '1.2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>{item.image}</div>
                <h3 style={{
                  fontSize: '22px',
                  fontWeight: 900,
                  marginBottom: '0.75rem',
                  color: BRAND_COLORS.azulOscuro,
                  lineHeight: 1.2,
                }}>
                  {item.name}
                </h3>
                <p style={{
                  fontSize: '15px',
                  color: '#555',
                  marginBottom: '1.5rem',
                  lineHeight: 1.7,
                  minHeight: '60px',
                }}>
                  {item.desc}
                </p>
                <div style={{
                  padding: '0.9rem',
                  backgroundColor: borderColors[idx % 4],
                  borderRadius: '12px',
                  color: BRAND_COLORS.white,
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: `0 4px 12px ${borderColors[idx % 4]}40`,
                }}>
                  ⏱️ Requiere 2 días de anticipación
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div style={{
          textAlign: 'center',
          marginBottom: '3rem',
          animation: 'slideInUp 0.6s ease-out 0.3s backwards',
        }}>
          <button style={{
            backgroundColor: BRAND_COLORS.naranja,
            color: BRAND_COLORS.white,
            border: 'none',
            padding: '1.3rem 3.5rem',
            fontSize: '18px',
            fontWeight: 900,
            borderRadius: '50px',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 8px 25px rgba(255, 160, 53, 0.5)',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.1) translateY(-3px)';
            e.target.style.boxShadow = '0 12px 35px rgba(255, 160, 53, 0.7)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1) translateY(0)';
            e.target.style.boxShadow = '0 8px 25px rgba(255, 160, 53, 0.5)';
          }}
          >
            Ver Todos los Sabores 🎉
          </button>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '2.5rem 2rem',
          backgroundColor: '#fff',
          borderRadius: '20px',
          border: `4px dashed ${BRAND_COLORS.turquesa}`,
          color: BRAND_COLORS.azulOscuro,
          boxShadow: '0 4px 15px rgba(0,0,0,0.07)',
          animation: 'slideInUp 0.6s ease-out 0.4s backwards',
        }}>
          <p style={{ marginBottom: '0.7rem', fontSize: '18px', fontWeight: 800 }}>
            ℹ️ El menú es ilustrativo
          </p>
          <p style={{ fontSize: '15px', margin: 0, color: '#666' }}>
            Para realizar tu pedido con 2 días de anticipación, escríbenos por WhatsApp
          </p>
        </div>
      </section>

      {/* MERCH SECTION - COLORFUL */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '4rem 1rem 3rem',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '3.5rem',
          animation: 'slideInUp 0.6s ease-out',
        }}>
          <div style={{
            display: 'inline-block',
            fontSize: '13px',
            fontWeight: 800,
            color: BRAND_COLORS.azulClaro,
            marginBottom: '0.75rem',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}>
            🎁 Exclusiva 🎁
          </div>
          <h2 style={{
            fontSize: 'clamp(32px, 6vw, 48px)',
            fontWeight: 900,
            marginBottom: '1rem',
            textAlign: 'center',
            color: BRAND_COLORS.azulOscuro,
            fontStyle: 'italic',
          }}>
            Merch Oficial Ladelos
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#666',
            marginBottom: '0',
            fontWeight: 700,
          }}>
            ✈️ Envío inmediato a cualquier lugar del mundo
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2.2rem',
        }}>
          {MERCH_ITEMS.map((item, idx) => {
            const colorMap = [
              { border: BRAND_COLORS.naranja, bg: '#FFF5EB' },
              { border: BRAND_COLORS.turquesa, bg: '#E8F8F5' },
              { border: BRAND_COLORS.azulClaro, bg: '#EBF5FB' },
              { border: BRAND_COLORS.azulOscuro, bg: '#F0F3FF' },
            ];
            const colors = colorMap[idx % 4];
            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: colors.bg,
                  border: `5px solid ${colors.border}`,
                  borderRadius: '24px',
                  padding: '2.5rem 2rem',
                  textAlign: 'center',
                  transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                  animation: `slideInUp 0.6s ease-out ${idx * 0.1}s backwards`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-12px) scale(1.02)';
                  e.currentTarget.style.boxShadow = `0 12px 35px ${colors.border}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)';
                }}
              >
                <div style={{ fontSize: '80px', marginBottom: '1rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>{item.image}</div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  marginBottom: '0.5rem',
                  color: BRAND_COLORS.azulOscuro,
                }}>
                  {item.name}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#999',
                  marginBottom: '1.2rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {item.category}
                </p>
                <div style={{
                  fontSize: '28px',
                  fontWeight: 900,
                  color: colors.border,
                  marginBottom: '1.5rem',
                }}>
                  {item.price}
                </div>
                <button style={{
                  width: '100%',
                  padding: '1.1rem',
                  backgroundColor: colors.border,
                  color: BRAND_COLORS.white,
                  border: 'none',
                  borderRadius: '14px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  boxShadow: `0 6px 18px ${colors.border}50`,
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.08) translateY(-2px)';
                  e.target.style.boxShadow = `0 10px 28px ${colors.border}70`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1) translateY(0)';
                  e.target.style.boxShadow = `0 6px 18px ${colors.border}50`;
                }}
                >
                  🛒 Comprar Ahora
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* CONTACT SECTION - COLORFUL */}
      <section style={{
        background: `linear-gradient(135deg, ${BRAND_COLORS.azulOscuro} 0%, ${BRAND_COLORS.azulClaro} 100%)`,
        color: BRAND_COLORS.white,
        padding: '5rem 1rem 4rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative pastelillo elements */}
        <div style={{
          position: 'absolute',
          top: '10%',
          right: '5%',
          fontSize: '120px',
          opacity: 0.06,
          animation: 'float 5s ease-in-out infinite',
        }}>🥟</div>
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '5%',
          fontSize: '100px',
          opacity: 0.05,
          animation: 'float 6s ease-in-out infinite 0.5s',
        }}>✨</div>

        <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 1, animation: 'slideInUp 0.6s ease-out' }}>
          <h2 style={{
            fontSize: 'clamp(32px, 6vw, 48px)',
            fontWeight: 900,
            marginBottom: '1.5rem',
            fontStyle: 'italic',
          }}>
            ¿Por qué elegir Ladelos?
          </h2>
          <p style={{
            fontSize: '18px',
            marginBottom: '3rem',
            opacity: 0.98,
            lineHeight: 1.8,
          }}>
            Pastelillos hechos con amor, ingredientes frescos y tradición puertorriqueña. Contáctanos para disfrutar 💜
          </p>

          <div style={{
            display: 'grid',
            gap: '1.3rem',
            marginBottom: '3rem',
          }}>
            <a href="https://wa.me/17871234567" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '17px',
              fontWeight: 800,
              padding: '1.2rem',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '16px',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              💬 WhatsApp
            </a>

            <a href="https://instagram.com/ladelospr" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '17px',
              fontWeight: 800,
              padding: '1.2rem',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '16px',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              📷 Instagram
            </a>

            <a href="https://maps.google.com" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '17px',
              fontWeight: 800,
              padding: '1.2rem',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '16px',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              backdropFilter: 'blur(10px)',
              border: '2px solid rgba(255,255,255,0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              📍 San Juan, PR
            </a>
          </div>

          <button style={{
            width: '100%',
            maxWidth: '380px',
            padding: '1.4rem 2rem',
            backgroundColor: BRAND_COLORS.naranja,
            color: BRAND_COLORS.white,
            border: 'none',
            borderRadius: '50px',
            fontSize: '18px',
            fontWeight: 900,
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            boxShadow: '0 8px 25px rgba(255, 160, 53, 0.5)',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.1) translateY(-3px)';
            e.target.style.boxShadow = '0 12px 35px rgba(255, 160, 53, 0.7)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1) translateY(0)';
            e.target.style.boxShadow = '0 8px 25px rgba(255, 160, 53, 0.5)';
          }}
          >
            💬 Escríbeme por WhatsApp
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        backgroundColor: BRAND_COLORS.azulOscuro,
        color: BRAND_COLORS.white,
        padding: '3rem 1rem',
        textAlign: 'center',
        fontSize: '14px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          bottom: '-20px',
          right: '-20px',
          fontSize: '80px',
          opacity: 0.04,
        }}>🥟</div>
        <p style={{ fontSize: '15px', fontWeight: 600, marginBottom: '0.5rem', position: 'relative', zIndex: 1 }}>
          © 2025 Ladelos Pastelillos. Hecho en 🇵🇷 con amor y tradición.
        </p>
        <p style={{ fontSize: '13px', opacity: 0.8, margin: 0, position: 'relative', zIndex: 1 }}>
          Todos los derechos reservados 💜
        </p>
      </footer>
    </div>
  )
}
