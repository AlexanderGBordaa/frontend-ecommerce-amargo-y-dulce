import { Comment } from "@/types/comment";

export async function getComments(productId: string): Promise<Comment[]> {
  // Luego esto va a tu backend (Strapi)
  return [
    {
      id: 1,
      user: "Juan",
      message: "Excelente producto, muy buena calidad",
      rating: 5,
      createdAt: "2026-01-20",
    },
    {
      id: 2,
      user: "Ana",
      message: "Llegó rápido y bien embalado",
      rating: 4,
      createdAt: "2026-01-21",
    },
  ];
}
