import React from "react";
import { api } from "../api/nestxApi";
import type { MeProfile } from "../api/nestxApi";

import FedRightWidget from "../components/profile/FedRightWidget";
import AdvRightWidget from "../components/profile/AdvRightWidget";
import ShowcaseRightWidget from "../components/profile/ShowcaseRightWidget";
import UpdatesRightWidget from "../components/profile/UpdatesRightWidget";

export default function ProfileRightPage() {
  const [me, setMe] = React.useState<MeProfile | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const m = await api.meProfile();
        if (!alive) return;
        setMe(m);
      } catch {
        if (!alive) return;
        setMe(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const emailVerified = Boolean(me?.emailVerifiedAt);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <FedRightWidget me={me} />
      {emailVerified ? <AdvRightWidget /> : null}
      {emailVerified ? <ShowcaseRightWidget /> : null}
      <UpdatesRightWidget />
    </div>
  );
}