export const offer = {
  name: "Curso completo de bachata",
  price: "29,99",
  previousPrice: "45",
  currency: "€",
  email: "chocobachata10@gmail.com",
  checkoutUrl:
    process.env.NEXT_PUBLIC_CHECKOUT_URL ||
    "https://choco.lemonsqueezy.com/checkout/buy/f8942fd3-b7a2-48be-a032-cb7acea8a267?media=0&desc=0&discount=0",
  levels: [
    {
      name: "Nivel 1 · Fundamentos y ritmo",
      detail:
        "Paso básico lateral y caminado, giros a ambos lados, cuadrado y piquete. Además, aprenderás a contar la música para seguir la canción sin perderte.",
    },
    {
      name: "Nivel 2 · Agilidad y juego de pies",
      detail:
        "5 clases para ganar rapidez y soltura con la música, dejar atrás la rigidez y conseguir que cada paso fluya con naturalidad.",
    },
    {
      name: "Nivel 3 · Combinaciones y estilo",
      detail:
        "4 clases con secuencias para la pista, mini coreografías y tu primera onda corporal: el movimiento tipo dolphin.",
    },
  ],
} as const;
