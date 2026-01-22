import { getComments } from "@/lib/comments";
import CommentList from "./CommentList";
import CommentForm from "./CommentForm";

export default async function CommentsSection({
  productId,
}: {
  productId: string;
}) {
  const comments = await getComments(productId);

  return (
    <section className="mt-10">
      <h3 className="text-xl font-semibold mb-4">
        Opiniones de clientes
      </h3>

      <CommentList comments={comments} />

      <div className="mt-6">
        <h4 className="font-medium mb-2"></h4>
        <CommentForm />
      </div>
    </section>
  );
}
