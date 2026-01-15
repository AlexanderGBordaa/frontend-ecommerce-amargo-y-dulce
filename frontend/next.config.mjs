/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Strapi local (dev)
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/uploads/**",
      },

      // 🔒 Producción (dejalo comentado hasta deploy)
      {
        protocol: "https",
        hostname: "strapi-backend-ecommerce-qete.onrender.com",
        pathname: "/uploads/**",
      },

      // 🔁 ngrok (si exponés Strapi)
      // {
      //   protocol: "https",
      //   hostname: "xxxx.ngrok-free.app",
      //   pathname: "/uploads/**",
      // },
    ],
  },
};

export default nextConfig;
