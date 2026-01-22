"use client";

import { useState } from "react";
import StarRating from "./StarRating";

export default function CommentForm() {
  const [rating, setRating] = useState(5);
  const [message, setMessage] = useState("");

  return (
    <form className="mt-6 space-y-4">
      <h4 className="font-semibold">Dejá tu opinión</h4>

      {/* ⭐ estrellas */}
      <StarRating value={rating} onChange={setRating} />

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribí tu comentario"
        className="w-full rounded-lg border p-3 text-sm"
        rows={4}
      />

      <button
        type="submit"
        className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700"
      >
        Enviar comentario
      </button>
    </form>
  );
}
