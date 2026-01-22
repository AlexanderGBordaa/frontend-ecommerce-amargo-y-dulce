import { Comment } from "@/types/comment";

export default function CommentItem({ comment }: { comment: Comment }) {
  return (
    <div className="border-b pb-4">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{comment.user}</span>

        {/* ⭐ estrellas */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={
                star <= comment.rating
                  ? "text-yellow-400"
                  : "text-neutral-300"
              }
            >
              ★
            </span>
          ))}
        </div>
      </div>

      <p className="mt-1 text-sm text-gray-700">{comment.message}</p>
    </div>
  );
}
