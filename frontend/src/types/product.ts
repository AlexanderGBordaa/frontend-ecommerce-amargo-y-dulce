export type Product = {
  id: string;
  title: string;
  slug: string;
  description?: string;
  price: number;
  discount?: number;
  stock?: number;
  images?: string[];
  rating?: number;
  featured?: boolean;
};
