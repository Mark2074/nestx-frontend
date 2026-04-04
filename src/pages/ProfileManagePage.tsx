import ProfilePayoutCard from "../components/profile/ProfilePayoutCard.tsx";

export default function ProfileManagePage() {
  return (
    <div style={{ padding: 20, maxWidth: 820, margin: "0 auto" }}>
      <h1>Creator / Payout</h1>

      <div style={{ marginTop: 12 }}>
        <ProfilePayoutCard />
      </div>
    </div>
  );
}