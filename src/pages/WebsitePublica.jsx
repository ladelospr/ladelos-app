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

      {/* HERO */}
      <section style={{
        background: `linear-gradient(135deg, ${BRAND_COLORS.azulClaro} 0%, ${BRAND_COLORS.azulOscuro} 100%)`,
        padding: '3rem 1rem',
        textAlign: 'center',
        color: BRAND_COLORS.white,
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🌮</div>
          <h1 style={{
            fontSize: '42px',
            fontWeight: 900,
            marginBottom: '1rem',
            fontStyle: 'italic',
            letterSpacing: '-1px',
          }}>
            Pastelillos Artesanales
          </h1>
          <p style={{
            fontSize: '18px',
            marginBottom: '2rem',
            lineHeight: 1.6,
            opacity: 0.95,
          }}>
            Hechos con amor y los mejores ingredientes. Merch oficial y mucho más.
          </p>
          <button style={{
            backgroundColor: BRAND_COLORS.naranja,
            color: BRAND_COLORS.white,
            border: 'none',
            padding: '1rem 2rem',
            fontSize: '16px',
            fontWeight: 700,
            borderRadius: '50px',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            width: '100%',
            maxWidth: '300px',
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Realizar tu pedido →
          </button>
        </div>
      </section>

      {/* MENU SECTION */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 1rem',
      }}>
        <h2 style={{
          fontSize: '36px',
          fontWeight: 900,
          marginBottom: '2rem',
          textAlign: 'center',
          color: BRAND_COLORS.azulOscuro,
        }}>
          Nuestro Menú 🤤
        </h2>

        {/* CATEGORY TABS */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          {Object.keys(MENU_ITEMS).map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.75rem 1.5rem',
                border: 'none',
                borderRadius: '50px',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: selectedCategory === cat ? BRAND_COLORS.naranja : BRAND_COLORS.turquesa,
                color: BRAND_COLORS.white,
                transition: 'all 0.3s',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* MENU ITEMS GRID */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}>
          {MENU_ITEMS[selectedCategory].map(item => (
            <div
              key={item.id}
              style={{
                backgroundColor: BRAND_COLORS.crema,
                borderRadius: '16px',
                padding: '1.5rem',
                border: `3px solid ${BRAND_COLORS.azulClaro}`,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '48px', marginBottom: '1rem' }}>{item.image}</div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 800,
                marginBottom: '0.5rem',
                color: BRAND_COLORS.azulOscuro,
              }}>
                {item.name}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#555',
                marginBottom: '1rem',
                lineHeight: 1.5,
              }}>
                {item.desc}
              </p>
              <small style={{ color: '#888', fontSize: '12px' }}>
                ⏱️ Requiere 2 días de anticipación
              </small>
            </div>
          ))}
        </div>

        <div style={{
          textAlign: 'center',
          marginTop: '2rem',
          padding: '2rem',
          backgroundColor: BRAND_COLORS.azulClaro,
          borderRadius: '16px',
          color: BRAND_COLORS.white,
        }}>
          <p style={{ marginBottom: '1rem', fontSize: '16px' }}>
            ℹ️ El menú es ilustrativo. Para hacer tu pedido, escríbenos o visita nuestro sitio de compra.
          </p>
        </div>
      </section>

      {/* MERCH SECTION */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 1rem',
      }}>
        <h2 style={{
          fontSize: '36px',
          fontWeight: 900,
          marginBottom: '1rem',
          textAlign: 'center',
          color: BRAND_COLORS.azulOscuro,
        }}>
          Merch Oficial 👕
        </h2>
        <p style={{
          textAlign: 'center',
          marginBottom: '2rem',
          fontSize: '16px',
          color: '#666',
        }}>
          Envío inmediato a cualquier lugar
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
        }}>
          {MERCH_ITEMS.map(item => (
            <div
              key={item.id}
              style={{
                backgroundColor: BRAND_COLORS.white,
                border: `2px solid ${BRAND_COLORS.turquesa}`,
                borderRadius: '12px',
                padding: '1.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '64px', marginBottom: '1rem' }}>{item.image}</div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                marginBottom: '0.5rem',
                color: BRAND_COLORS.azulOscuro,
              }}>
                {item.name}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#888',
                marginBottom: '1rem',
              }}>
                {item.category}
              </p>
              <div style={{
                fontSize: '20px',
                fontWeight: 900,
                color: BRAND_COLORS.naranja,
                marginBottom: '1rem',
              }}>
                {item.price}
              </div>
              <button style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: BRAND_COLORS.naranja,
                color: BRAND_COLORS.white,
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = BRAND_COLORS.azulOscuro}
              onMouseLeave={(e) => e.target.style.backgroundColor = BRAND_COLORS.naranja}
              >
                <ShoppingCart size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
                Comprar
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section style={{
        backgroundColor: BRAND_COLORS.azulClaro,
        color: BRAND_COLORS.white,
        padding: '3rem 1rem',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '32px',
            fontWeight: 900,
            marginBottom: '2rem',
          }}>
            Contáctanos 💬
          </h2>

          <div style={{
            display: 'grid',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}>
            <a href="tel:+1787123456" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
            }}>
              <Phone size={20} /> +1 (787) 123-4567
            </a>

            <a href="https://instagram.com/ladelospr" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
            }}>
              <Instagram size={20} /> @ladelospr
            </a>

            <a href="https://maps.google.com" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              color: BRAND_COLORS.white,
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 600,
            }}>
              <MapPin size={20} /> San Juan, PR
            </a>
          </div>

          <button style={{
            width: '100%',
            maxWidth: '300px',
            padding: '1rem',
            backgroundColor: BRAND_COLORS.naranja,
            color: BRAND_COLORS.white,
            border: 'none',
            borderRadius: '50px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          >
            Escribir por WhatsApp
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
