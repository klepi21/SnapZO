import { PostCard } from "@/components/momento/post-card";
import { DUMMY_POSTS } from "@/lib/dummy/social";

export default function FeedPage() {
  return (
    <main className="pb-24 pt-7">
      {DUMMY_POSTS.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </main>
  );
}
