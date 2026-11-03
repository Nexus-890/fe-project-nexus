import { notFound } from "next/navigation";
import SessionProbe from "../../tests/SessionProbe";

export default function SessionProbePage() {
  if (process.env.NODE_ENV === "production" || process.env.NEXUS_TEST_AUTH_PROBE !== "true") notFound();
  return <SessionProbe />;
}
