import { useState } from 'react'
import { ChevronDown, Menu, X, ShoppingCart, Instagram, MapPin, Phone } from 'lucide-react'

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
  amarilloClaro: '#FFD700',
}

const MENU_ITEMS = {
  'Clásicos': [
    { id: 1, name: 'Pastelillo de Carne', desc: 'Carne molida, queso americano y verduras', image: '🥟' },
    { id: 2, name: 'Pastelillo de Queso', desc: 'Queso fresco y crema, receta tradicional', image: '🧀' },
    { id: 3, name: 'Pastelillo de Jamón y Queso', desc: 'Jamón serrano, queso y pimienta', image: '🍖' },
  ],
  'Gourmet': [
    { id: 4, name: 'Pastelillo Camarones', desc: 'Camarones frescos, cilantro y limón', image: '🦐' },
    { id: 5, name: 'Pastelillo Picante Crab', desc: 'Cangrejo, especias y sriracha', image: '🦀' },
    { id: 6, name: 'Pastelillo Pizza', desc: 'Mozzarella, pepperoni y salsa italiana', image: '🍕' },
  ],
  'Especiales': [
    { id: 7, name: 'Pastelillo Vegetariano', desc: 'Champiñones, espinaca y queso ricotta', image: '🥬' },
    { id: 8, name: 'Pastelillo Barbecue', desc: 'Cerdo desmenuzado con salsa BBQ', image: '🍖' },
  ],
}

const MERCH_ITEMS = [
  { id: 101, name: 'Camiseta Clásica', price: '$25', image: '👕', category: 'Ropa' },
  { id: 102, name: 'Gorra Ladelos', price: '$18', image: '🧢', category: 'Accesorios' },
  { id: 103, name: 'Taza Pastelillos', price: '$14', image: '☕', category: 'Hogar' },
  { id: 104, name: 'Hoodie Premium', price: '$45', image: '🧥', category: 'Ropa' },
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
        background: `linear-gradient(135deg, ${BRAND_COLORS.azulClaro} 0%, ${BRAND_COLORS.turquesa} 50%, ${BRAND_COLORS.naranja} 100%)`,
        padding: '3rem 1rem',
        textAlign: 'center',
        color: BRAND_COLORS.white,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          fontSize: '120px',
          opacity: 0.1,
          transform: 'rotate(-15deg)',
        }}>🌮</div>
        <div style={{
          position: 'absolute',
          bottom: '-30px',
          left: '-30px',
          fontSize: '100px',
          opacity: 0.1,
          transform: 'rotate(25deg)',
        }}>✨</div>

        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '64px', marginBottom: '1rem', animation: 'bounce 2s infinite' }}>🌮</div>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 900,
            marginBottom: '1rem',
            fontStyle: 'italic',
            letterSpacing: '-2px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
          }}>
            Hechas a Mano<br />Cada Día
          </h1>
          <p style={{
            fontSize: '18px',
            marginBottom: '0.5rem',
            fontWeight: 700,
          }}>
            Más de 40 sabores frescos
          </p>
          <p style={{
            fontSize: '14px',
            marginBottom: '2rem',
            lineHeight: 1.6,
            opacity: 0.95,
          }}>
            Desde Carne y Queso hasta Carbonara, Montecristo, Cubano y Philly Cheesesteak. Siempre hay un nuevo favorito por descubrir.
          </p>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button style={{
              backgroundColor: BRAND_COLORS.naranja,
              color: BRAND_COLORS.white,
              border: 'none',
              padding: '1rem 2rem',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              flex: '1',
              minWidth: '150px',
              maxWidth: '280px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
            }}
            >
              Ordena Ahora
            </button>
            <button style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              color: BRAND_COLORS.azulOscuro,
              border: 'none',
              padding: '1rem 2rem',
              fontSize: '16px',
              fontWeight: 700,
              borderRadius: '50px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flex: '1',
              minWidth: '150px',
              maxWidth: '280px',
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = BRAND_COLORS.white}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.9)'}
            >
              Ver Menú
            </button>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>

      {/* MENU SECTION - GIAN MAUROS COLORFUL STYLE */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 1rem',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '2rem',
        }}>
          <div style={{
            display: 'inline-block',
            fontSize: '14px',
            fontWeight: 700,
            color: BRAND_COLORS.naranja,
            marginBottom: '0.5rem',
          }}>
            ✨ NUESTROS FAVORITOS ✨
          </div>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 900,
            marginBottom: '0.5rem',
            textAlign: 'center',
            color: BRAND_COLORS.azulOscuro,
            lineHeight: 1.2,
          }}>
            Clásicos que<br />nunca fallan 🤤
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#666',
            marginTop: '1rem',
          }}>
            Probados y aprobados por nuestros clientes
          </p>
        </div>

        {/* CATEGORY TABS - COLORFUL */}
        <div style={{
          display: 'flex',
          gap: '0.8rem',
          marginBottom: '2.5rem',
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
                  padding: '0.9rem 2rem',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '15px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  backgroundColor: selectedCategory === cat ? color.bg : '#f0f0f0',
                  color: selectedCategory === cat ? color.text : '#666',
                  transition: 'all 0.3s',
                  boxShadow: selectedCategory === cat ? `0 4px 15px ${color.bg}40` : 'none',
                  transform: selectedCategory === cat ? 'scale(1.05)' : 'scale(1)',
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.8rem',
          marginBottom: '2.5rem',
        }}>
          {MENU_ITEMS[selectedCategory].map((item, idx) => {
            const bgColors = [BRAND_COLORS.crema, '#FFE5E5', '#E5F0FF'];
            const borderColors = [BRAND_COLORS.naranja, BRAND_COLORS.turquesa, BRAND_COLORS.azulClaro];
            return (
              <div
                key={item.id}
                style={{
                  backgroundColor: bgColors[idx % 3],
                  borderRadius: '20px',
                  padding: '2rem 1.5rem',
                  border: `4px solid ${borderColors[idx % 3]}`,
                  textAlign: 'center',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                }}
              >
                <div style={{ fontSize: '56px', marginBottom: '1rem' }}>{item.image}</div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  marginBottom: '0.5rem',
                  color: BRAND_COLORS.azulOscuro,
                }}>
                  {item.name}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#555',
                  marginBottom: '1.2rem',
                  lineHeight: 1.6,
                  minHeight: '50px',
                }}>
                  {item.desc}
                </p>
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: borderColors[idx % 3],
                  borderRadius: '10px',
                  color: BRAND_COLORS.white,
                  fontSize: '12px',
                  fontWeight: 700,
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
          marginBottom: '2rem',
        }}>
          <button style={{
            backgroundColor: BRAND_COLORS.naranja,
            color: BRAND_COLORS.white,
            border: 'none',
            padding: '1.2rem 3rem',
            fontSize: '17px',
            fontWeight: 800,
            borderRadius: '50px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: '0 4px 15px rgba(255, 160, 53, 0.4)',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.08)';
            e.target.style.boxShadow = '0 6px 25px rgba(255, 160, 53, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 15px rgba(255, 160, 53, 0.4)';
          }}
          >
            Explorar Todos los Sabores →
          </button>
        </div>

        <div style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: '#f8f8f8',
          borderRadius: '16px',
          border: `3px dashed ${BRAND_COLORS.turquesa}`,
          color: '#666',
        }}>
          <p style={{ marginBottom: '0.5rem', fontSize: '16px', fontWeight: 700 }}>
            ℹ️ El menú es ilustrativo
          </p>
          <p style={{ fontSize: '14px', margin: 0 }}>
            Para hacer tu pedido con anticipación, escríbenos por WhatsApp
          </p>
        </div>
      </section>

      {/* MERCH SECTION - COLORFUL */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 1rem',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '2.5rem',
        }}>
          <div style={{
            display: 'inline-block',
            fontSize: '14px',
            fontWeight: 700,
            color: BRAND_COLORS.azulClaro,
            marginBottom: '0.5rem',
          }}>
            🎁 EXCLUSIVA 🎁
          </div>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 900,
            marginBottom: '1rem',
            textAlign: 'center',
            color: BRAND_COLORS.azulOscuro,
          }}>
            Merch Oficial Ladelos
          </h2>
          <p style={{
            fontSize: '16px',
            color: '#666',
            marginBottom: '0.5rem',
            fontWeight: 600,
          }}>
            ✈️ Envío inmediato a cualquier lugar
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.8rem',
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
                  border: `3px solid ${colors.border}`,
                  borderRadius: '18px',
                  padding: '2rem 1.5rem',
                  textAlign: 'center',
                  transition: 'all 0.3s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-8px)';
                  e.currentTarget.style.boxShadow = `0 8px 25px ${colors.border}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                }}
              >
                <div style={{ fontSize: '72px', marginBottom: '1rem' }}>{item.image}</div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  marginBottom: '0.3rem',
                  color: BRAND_COLORS.azulOscuro,
                }}>
                  {item.name}
                </h3>
                <p style={{
                  fontSize: '13px',
                  color: '#999',
                  marginBottom: '1rem',
                  fontWeight: 600,
                }}>
                  {item.category}
                </p>
                <div style={{
                  fontSize: '24px',
                  fontWeight: 900,
                  color: colors.border,
                  marginBottom: '1.2rem',
                }}>
                  {item.price}
                </div>
                <button style={{
                  width: '100%',
                  padding: '1rem',
                  backgroundColor: colors.border,
                  color: BRAND_COLORS.white,
                  border: 'none',
                  borderRadius: '12px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: '15px',
                  transition: 'all 0.2s',
                  boxShadow: `0 4px 12px ${colors.border}40`,
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'scale(1.05)';
                  e.target.style.boxShadow = `0 6px 18px ${colors.border}60`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'scale(1)';
                  e.target.style.boxShadow = `0 4px 12px ${colors.border}40`;
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
        padding: '4rem 1rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative elements */}
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          fontSize: '80px',
          opacity: 0.05,
        }}>🌮</div>

        <div style={{ maxWidth: '600px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <h2 style={{
            fontSize: '40px',
            fontWeight: 900,
            marginBottom: '1rem',
          }}>
            ¿Por qué elegir Ladelos?
          </h2>
          <p style={{
            fontSize: '18px',
            marginBottom: '2.5rem',
            opacity: 0.95,
            lineHeight: 1.6,
          }}>
            Contacta con nosotros y ten tus pastelillos favoritos listos para disfrutar 💜
          </p>

          <div style={{
            display: 'grid',
            gap: '1.2rem',
            marginBottom: '2.5rem',
          }}>
            <a href="https://wa.me/17871234567" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 700,
              padding: '1rem',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
            >
              💬 WhatsApp: +1 (787) 123-4567
            </a>

            <a href="https://instagram.com/ladelospr" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 700,
              padding: '1rem',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
            >
              📷 Instagram: @ladelospr
            </a>

            <a href="https://maps.google.com" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 700,
              padding: '1rem',
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: '12px',
              transition: 'all 0.3s',
              backdropFilter: 'blur(10px)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
            >
              📍 San Juan, PR
            </a>
          </div>

          <button style={{
            width: '100%',
            maxWidth: '350px',
            padding: '1.3rem',
            backgroundColor: BRAND_COLORS.naranja,
            color: BRAND_COLORS.white,
            border: 'none',
            borderRadius: '50px',
            fontSize: '17px',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: '0 4px 15px rgba(255, 160, 53, 0.4)',
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'scale(1.08)';
            e.target.style.boxShadow = '0 6px 25px rgba(255, 160, 53, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'scale(1)';
            e.target.style.boxShadow = '0 4px 15px rgba(255, 160, 53, 0.4)';
          }}
          >
            💬 Escribir por WhatsApp
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        backgroundColor: BRAND_COLORS.azulOscuro,
        color: BRAND_COLORS.white,
        padding: '2rem 1rem',
        textAlign: 'center',
        fontSize: '14px',
      }}>
        <p>© 2025 Ladelos Pastelillos. Todos los derechos reservados. 💜</p>
      </footer>
    </div>
  )
}
