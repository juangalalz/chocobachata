export const offer = {
  name: "Curso completo de bachata",
  price: "29,99",
  previousPrice: "45",
  currency: "€",
  email: "chocobachata10@gmail.com",
  socials: [
    { name: "Instagram", url: "https://www.instagram.com/chocobach_" },
    { name: "TikTok", url: "https://www.tiktok.com/@chocobach_" },
    { name: "Facebook", url: "https://www.facebook.com/yorvys.mena.7" },
  ],
  checkoutUrl:
    process.env.NEXT_PUBLIC_CHECKOUT_URL ||
    "https://pago.chocobachata.com/checkout/buy/f5a0e2b7-b15d-4a74-875f-de00c8136a60?media=0&discount=0",
  // País que Lemon trae marcado en la facturación. Con España solo pide el código
  // postal; sin él marca Estados Unidos y pide dirección, estado, ciudad y ZIP.
  checkoutCountry: "ES",
  levels: [
    {
      name: "Nivel 1 · Básico: fundamentos y ritmo",
      detail:
        "Paso básico lateral y caminado, giros a ambos lados, cuadrado y piquete. Además, aprenderás a contar la música para seguir la canción sin perderte.",
    },
    {
      name: "Nivel 2 · Intermedio: agilidad y juego de pies",
      detail:
        "5 clases para ganar rapidez y soltura con la música, dejar atrás la rigidez y conseguir que cada paso fluya con naturalidad.",
    },
    {
      name: "Nivel 3 · Avanzado: combinaciones y estilo",
      detail:
        "4 clases con secuencias para la pista, mini coreografías y tu primera onda corporal: el movimiento tipo dolphin.",
    },
  ],
} as const;
