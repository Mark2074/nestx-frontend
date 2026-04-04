import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type MeProfile } from "../api/nestxApi";
import PostCard from "../components/feed/PostCard";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeProfile | null>(null);
  const [post, setPost] = useState<any | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!id) {
        setErrMsg("Post not found");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrMsg(null);

      try {
        const [meRes, postRes] = await Promise.allSettled([api.meProfile(), api.getPostById(id)]);

        if (!alive) return;

        if (meRes.status === "fulfilled") setMe(meRes.value);
        // postRes: backend might return { item } or { data } or direct post
        if (postRes.status === "fulfilled") {
          const raw = postRes.value;
          const p = raw?.item || raw?.data || raw;
          setPost(p || null);
        } else {
          const e: any = postRes.reason;
          const status = Number(e?.status || 0);
          if (status === 403) setErrMsg("This post is not available");
          else if (status === 404) setErrMsg("Post not found");
          else setErrMsg("Failed to load post");
          setPost(null);
        }
      } catch (e) {
        if (!alive) return;
        console.error(e);
        setErrMsg("Failed to load post");
        setPost(null);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [id]);

  const boxStyle: React.CSSProperties = {
    padding: 18,
    maxWidth: 860,
    margin: "0 auto",
  };

  if (loading) {
    return <div style={boxStyle}>Loading…</div>;
  }

  if (!post) {
    return <div style={boxStyle}>{errMsg || "Post not found"}</div>;
  }

  return (
    <div style={boxStyle}>
      <PostCard item={{ type: "posts", data: post }} me={me as any} context={"feed"} />
    </div>
  );
}
