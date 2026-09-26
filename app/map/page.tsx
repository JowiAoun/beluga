import type { Metadata } from "next";
import Dashboard from "./Dashboard";

export const metadata: Metadata = { title: "beluga for cities" };

export default function MapPage() {
  return <Dashboard />;
}
