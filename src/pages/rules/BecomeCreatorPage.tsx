import { Link } from "react-router-dom";

export default function BecomeCreatorPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px" }}>
      <Link to="/app/tokens" style={{ textDecoration: "underline", display: "inline-block", marginBottom: 12 }}>
        ← Back to Tokens
      </Link>
      <h1>Become a creator on NestX</h1>

      <p>
        Becoming a creator allows you to earn Redeemable tokens and request payouts.
        This process is separate from the verified user badge.
      </p>

      <h2>How it works</h2>
      <ol>
        <li>Start the creator onboarding process.</li>
        <li>Complete identity and payout verification via Stripe.</li>
        <li>NestX reviews your account for any pending issues.</li>
        <li>If approved, you can withdraw your Redeemable tokens.</li>
      </ol>

      <h2>Important notes</h2>
      <ul>
        <li>Payout eligibility depends on Stripe verification and NestX approval.</li>
      </ul>

      <p>
        Creator onboarding will be available once the token economy is live.
      </p>
    </div>
  );
}